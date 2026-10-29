// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ContribChain Escrow (workflow-aligned EVM prototype)
/// @notice Keeps bounty funds on-chain while project/opportunity/PR metadata remains off-chain.
/// @dev This Solidity contract is suitable only for an EVM-compatible MST network.
///      GitHub authenticity and live PR status must be handled by the backend, not this contract.
contract ContribChainEscrow {
    enum ContributionStatus {
        NONE,
        PENDING,
        APPROVED,
        REJECTED,
        PAID
    }

    enum OpportunityStatus {
        NONE,
        OPEN,
        REWARD_PENDING,
        PAID,
        CANCELLED
    }

    struct Opportunity {
        uint256 id;
        bytes32 projectRef;       // Stable reference to the off-chain project record
        bytes32 metadataHash;     // Optional integrity commitment to off-chain opportunity metadata
        address payable publisher;
        uint256 bounty;
        uint256 remainingBounty;
        uint64 deadline;
        uint256 approvedContributionId;
        uint256 pendingContributions;
        OpportunityStatus status;
        bool exists;
    }

    struct Contribution {
        uint256 id;
        uint256 opportunityId;
        address contributor;
        bytes32 submissionHash;   // Reference/hash for the off-chain PR submission record
        ContributionStatus status;
        bool exists;
    }

    uint256 public nextOpportunityId = 1;
    uint256 public nextContributionId = 1;

    mapping(uint256 => Opportunity) public opportunities;
    mapping(uint256 => Contribution) public contributions;

    // MVP rule: one submission per wallet per opportunity.
    mapping(uint256 => mapping(address => uint256)) public contributionByWallet;

    uint256 public totalEscrowed;
    uint256 public totalRewardsPaid;

    address payable public platformFeeRecipient;
    uint256 public constant PLATFORM_FEE_BPS = 300; // 3% platform fee

    bool private locked;

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    modifier opportunityExists(uint256 opportunityId) {
        require(opportunities[opportunityId].exists, "Opportunity not found");
        _;
    }

    modifier onlyPublisher(uint256 opportunityId) {
        require(opportunities[opportunityId].exists, "Opportunity not found");
        require(
            opportunities[opportunityId].publisher == msg.sender,
            "Not the publisher"
        );
        _;
    }

    event OpportunityCreated(
        uint256 indexed opportunityId,
        bytes32 indexed projectRef,
        address indexed publisher,
        uint256 bounty,
        uint64 deadline,
        bytes32 metadataHash
    );

    event ContributionSubmitted(
        uint256 indexed contributionId,
        uint256 indexed opportunityId,
        address indexed contributor,
        bytes32 submissionHash
    );

    event ContributionReviewed(
        uint256 indexed contributionId,
        uint256 indexed opportunityId,
        ContributionStatus status
    );

    event RewardApproved(
        uint256 indexed opportunityId,
        uint256 indexed contributionId,
        address indexed contributor,
        uint256 amount
    );

    event RewardReleased(
        uint256 indexed opportunityId,
        uint256 indexed contributionId,
        address indexed contributor,
        uint256 amount
    );

    event OpportunityCancelled(uint256 indexed opportunityId);
    event BountyRefunded(uint256 indexed opportunityId, address indexed publisher, uint256 amount);
    event PlatformFeePaid(uint256 indexed opportunityId, address indexed recipient, uint256 fee);

    constructor(address payable _feeRecipient) {
        platformFeeRecipient = _feeRecipient != address(0) ? _feeRecipient : payable(msg.sender);
    }

    /// @notice Create and fund an opportunity in one atomic transaction.
    /// @param projectRef Stable reference/hash for the project stored in the database.
    /// @param metadataHash Optional hash of the off-chain opportunity metadata; use bytes32(0) if unused.
    /// @param deadline Unix timestamp after which new submissions are not accepted.
    function createOpportunity(
        bytes32 projectRef,
        bytes32 metadataHash,
        uint64 deadline
    ) external payable returns (uint256 opportunityId) {
        require(projectRef != bytes32(0), "Project reference required");
        require(msg.value > 0, "Bounty must be positive");
        require(deadline > block.timestamp, "Invalid deadline");

        opportunityId = nextOpportunityId++;

        opportunities[opportunityId] = Opportunity({
            id: opportunityId,
            projectRef: projectRef,
            metadataHash: metadataHash,
            publisher: payable(msg.sender),
            bounty: msg.value,
            remainingBounty: msg.value,
            deadline: deadline,
            approvedContributionId: 0,
            pendingContributions: 0,
            status: OpportunityStatus.OPEN,
            exists: true
        });

        totalEscrowed += msg.value;

        emit OpportunityCreated(
            opportunityId,
            projectRef,
            msg.sender,
            msg.value,
            deadline,
            metadataHash
        );
    }

    /// @notice Record a contributor's off-chain PR submission reference.
    /// @dev This does not prove that the URL is a genuine GitHub PR. Verify it in the backend.
    function submitContribution(
        uint256 opportunityId,
        bytes32 submissionHash
    ) external opportunityExists(opportunityId) returns (uint256 contributionId) {
        Opportunity storage opportunity = opportunities[opportunityId];

        require(opportunity.status == OpportunityStatus.OPEN, "Opportunity not open");
        require(block.timestamp < opportunity.deadline, "Deadline passed");
        require(opportunity.remainingBounty > 0, "No bounty available");
        require(msg.sender != opportunity.publisher, "Cannot contribute to own opportunity");
        require(submissionHash != bytes32(0), "Submission reference required");
        require(
            contributionByWallet[opportunityId][msg.sender] == 0,
            "Already submitted for this opportunity"
        );

        contributionId = nextContributionId++;

        contributions[contributionId] = Contribution({
            id: contributionId,
            opportunityId: opportunityId,
            contributor: msg.sender,
            submissionHash: submissionHash,
            status: ContributionStatus.PENDING,
            exists: true
        });

        contributionByWallet[opportunityId][msg.sender] = contributionId;
        opportunity.pendingContributions += 1;

        emit ContributionSubmitted(
            contributionId,
            opportunityId,
            msg.sender,
            submissionHash
        );
    }

    /// @notice Publisher approves a pending contribution without transferring funds yet.
    /// @dev The first approved contribution reserves the single-winner bounty.
    function approveContribution(
        uint256 contributionId
    ) external nonReentrant {
        Contribution storage contribution = contributions[contributionId];
        require(contribution.exists, "Contribution not found");

        Opportunity storage opportunity = opportunities[contribution.opportunityId];
        require(opportunity.publisher == msg.sender, "Not the publisher");
        require(opportunity.status == OpportunityStatus.OPEN, "Opportunity not open");
        require(contribution.status == ContributionStatus.PENDING, "Contribution not pending");
        require(opportunity.approvedContributionId == 0, "Winner already approved");
        require(opportunity.remainingBounty > 0, "Bounty unavailable");

        contribution.status = ContributionStatus.APPROVED;
        opportunity.approvedContributionId = contributionId;
        opportunity.status = OpportunityStatus.REWARD_PENDING;
        opportunity.pendingContributions -= 1;

        emit ContributionReviewed(
            contributionId,
            contribution.opportunityId,
            ContributionStatus.APPROVED
        );
        emit RewardApproved(
            opportunity.id,
            contributionId,
            contribution.contributor,
            opportunity.remainingBounty
        );
    }

    /// @notice Publisher releases the approved bounty in a separate transaction.
    function releaseReward(
        uint256 opportunityId
    ) external onlyPublisher(opportunityId) nonReentrant {
        Opportunity storage opportunity = opportunities[opportunityId];

        require(
            opportunity.status == OpportunityStatus.REWARD_PENDING,
            "Reward is not approved for release"
        );

        uint256 contributionId = opportunity.approvedContributionId;
        Contribution storage contribution = contributions[contributionId];

        require(contribution.exists, "Approved contribution not found");
        require(contribution.status == ContributionStatus.APPROVED, "Contribution not approved");

        uint256 reward = opportunity.remainingBounty;
        require(reward > 0, "No bounty remaining");

        uint256 fee = (reward * PLATFORM_FEE_BPS) / 10000;
        uint256 contributorPayout = reward - fee;

        // Update state before external transfers. A failed transfer reverts all changes.
        opportunity.remainingBounty = 0;
        opportunity.status = OpportunityStatus.PAID;
        contribution.status = ContributionStatus.PAID;
        totalEscrowed -= reward;
        totalRewardsPaid += reward;

        emit RewardReleased(
            opportunityId,
            contributionId,
            contribution.contributor,
            reward
        );

        if (fee > 0 && platformFeeRecipient != address(0)) {
            (bool feeSuccess, ) = platformFeeRecipient.call{value: fee}("");
            require(feeSuccess, "Platform fee transfer failed");
            emit PlatformFeePaid(opportunityId, platformFeeRecipient, fee);
        }

        (bool success, ) = payable(contribution.contributor).call{value: contributorPayout}("");
        require(success, "Reward transfer failed");
    }

    /// @notice Reject a pending contribution without paying it.
    /// @dev Other pending submissions can still be rejected after a winner is approved.
    function rejectContribution(
        uint256 contributionId
    ) external {
        Contribution storage contribution = contributions[contributionId];
        require(contribution.exists, "Contribution not found");

        Opportunity storage opportunity = opportunities[contribution.opportunityId];
        require(opportunity.publisher == msg.sender, "Not the publisher");
        require(
            opportunity.status == OpportunityStatus.OPEN ||
            opportunity.status == OpportunityStatus.REWARD_PENDING,
            "Opportunity not reviewable"
        );
        require(contribution.status == ContributionStatus.PENDING, "Contribution not pending");

        contribution.status = ContributionStatus.REJECTED;
        opportunity.pendingContributions -= 1;

        emit ContributionReviewed(
            contributionId,
            contribution.opportunityId,
            ContributionStatus.REJECTED
        );
    }

    /// @notice Refund an expired opportunity if no submissions remain pending and no reward is approved.
    function cancelOpportunity(
        uint256 opportunityId
    ) external onlyPublisher(opportunityId) nonReentrant {
        Opportunity storage opportunity = opportunities[opportunityId];

        require(opportunity.status == OpportunityStatus.OPEN, "Opportunity not cancellable");
        require(block.timestamp >= opportunity.deadline, "Wait until deadline");
        require(opportunity.pendingContributions == 0, "Pending submissions must be reviewed");

        uint256 refund = opportunity.remainingBounty;

        opportunity.remainingBounty = 0;
        opportunity.status = OpportunityStatus.CANCELLED;
        totalEscrowed -= refund;

        emit OpportunityCancelled(opportunityId);
        emit BountyRefunded(opportunityId, msg.sender, refund);

        if (refund > 0) {
            (bool success, ) = opportunity.publisher.call{value: refund}("");
            require(success, "Refund failed");
        }
    }

    /// @notice Actual native-currency balance held by this contract.
    function escrowBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

