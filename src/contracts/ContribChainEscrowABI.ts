// Typed ABI for ContribChainEscrow.sol for viem and wagmi
export const CONTRIB_CHAIN_ESCROW_ABI = [
  {
    inputs: [
      { internalType: "bytes32", name: "projectRef", type: "bytes32" },
      { internalType: "bytes32", name: "metadataHash", type: "bytes32" },
      { internalType: "uint64", name: "deadline", type: "uint64" },
    ],
    name: "createOpportunity",
    outputs: [{ internalType: "uint256", name: "opportunityId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "opportunityId", type: "uint256" },
      { internalType: "bytes32", name: "submissionHash", type: "bytes32" },
    ],
    name: "submitContribution",
    outputs: [{ internalType: "uint256", name: "contributionId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "contributionId", type: "uint256" },
    ],
    name: "approveContribution",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "opportunityId", type: "uint256" },
    ],
    name: "releaseReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "contributionId", type: "uint256" },
    ],
    name: "rejectContribution",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "opportunityId", type: "uint256" },
    ],
    name: "cancelOpportunity",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "escrowBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "opportunities",
    outputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "bytes32", name: "projectRef", type: "bytes32" },
      { internalType: "bytes32", name: "metadataHash", type: "bytes32" },
      { internalType: "address payable", name: "publisher", type: "address" },
      { internalType: "uint256", name: "bounty", type: "uint256" },
      { internalType: "uint256", name: "remainingBounty", type: "uint256" },
      { internalType: "uint64", name: "deadline", type: "uint64" },
      { internalType: "uint256", name: "approvedContributionId", type: "uint256" },
      { internalType: "uint256", name: "pendingContributions", type: "uint256" },
      { internalType: "uint8", name: "status", type: "uint8" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "contributions",
    outputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "uint256", name: "opportunityId", type: "uint256" },
      { internalType: "address", name: "contributor", type: "address" },
      { internalType: "bytes32", name: "submissionHash", type: "bytes32" },
      { internalType: "uint8", name: "status", type: "uint8" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "contributionByWallet",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextOpportunityId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextContributionId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalEscrowed",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalRewardsPaid",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "opportunityId", type: "uint256" },
      { indexed: true, internalType: "bytes32", name: "projectRef", type: "bytes32" },
      { indexed: true, internalType: "address", name: "publisher", type: "address" },
      { indexed: false, internalType: "uint256", name: "bounty", type: "uint256" },
      { indexed: false, internalType: "uint64", name: "deadline", type: "uint64" },
      { indexed: false, internalType: "bytes32", name: "metadataHash", type: "bytes32" },
    ],
    name: "OpportunityCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "contributionId", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "opportunityId", type: "uint256" },
      { indexed: true, internalType: "address", name: "contributor", type: "address" },
      { indexed: false, internalType: "bytes32", name: "submissionHash", type: "bytes32" },
    ],
    name: "ContributionSubmitted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "contributionId", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "opportunityId", type: "uint256" },
      { indexed: false, internalType: "uint8", name: "status", type: "uint8" },
    ],
    name: "ContributionReviewed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "opportunityId", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "contributionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "contributor", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "RewardApproved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "opportunityId", type: "uint256" },
      { indexed: true, internalType: "uint256", name: "contributionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "contributor", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "RewardReleased",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "opportunityId", type: "uint256" },
    ],
    name: "OpportunityCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "opportunityId", type: "uint256" },
      { indexed: true, internalType: "address", name: "publisher", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "BountyRefunded",
    type: "event",
  },
] as const

// Deployed MST Testnet Contract Address
export const MST_TESTNET_ESCROW_ADDRESS = "0x1f3E1E9Bfe08153c5b3bA7311BB2d74415419a01" as const
export const MST_TESTNET_CHAIN_ID = 91562037 as const
export const MST_TESTNET_EXPLORER = "https://testnet.mstscan.com" as const
export const MST_TESTNET_RPC = "https://testnetrpc.mstblockchain.com" as const
export const MST_SYMBOL = "tMSTC" as const

