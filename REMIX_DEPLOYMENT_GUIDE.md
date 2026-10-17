# ContribChain Smart Contract Deployment & Testing Guide (Remix IDE)

This guide walks you through compiling, testing in the Remix VM, and deploying `ContributionBounty.sol` to **Ethereum Sepolia** using **Remix IDE** and **MetaMask**.

---

## 1. Compiler Settings

1. Open [https://remix.ethereum.org](https://remix.ethereum.org).
2. In the File Explorer tab, create a new file: `contracts/ContributionBounty.sol`.
3. Copy the full contents of [ContributionBounty.sol](file:///c:/Users/vedma/OneDrive/Desktop/Hackathon%20Project/contracts/src/ContributionBounty.sol) into Remix.
4. Navigate to the **Solidity Compiler** tab (icon with Solidity "S"):
   - **Compiler Version**: `0.8.20+commit.a1b79de6` (Select `0.8.20`).
   - **Language**: `Solidity`.
   - **EVM Version**: `default` or `paris`.
   - **Enable Optimization**: Checked (`200` runs).
5. Click **Compile ContributionBounty.sol**.
   - A green checkmark appears on the compiler tab.

---

## 2. Testing in Remix VM (First Phase)

Always test functionality using Remix's local virtual machine before spending Sepolia testnet ETH:

1. Go to the **Deploy & Run Transactions** tab.
2. In the **Environment** dropdown, select **Remix VM (Prague)** or **Remix VM (Shanghai)**.
3. Remix provides 10 accounts funded with 100 fake ETH:
   - **Account #1 (Publisher)**: `0x5B38Da6a701c568545dCfcB03FcB875f56beddC4`
   - **Account #2 (Contributor)**: `0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2`
   - **Account #3 (Unauthorized)**: `0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db`
4. Select `ContributionBounty` from the **Contract** dropdown.
5. Click **Deploy**.
6. Expand the deployed contract under **Deployed Contracts**:

### Test Scenario A: Register Project & Create Opportunity
- Switch to **Account #1 (Publisher)**.
- Expand `registerProject`:
  - `repoId`: `"acme/cool-dapp"`
  - `metadataURI`: `"ipfs://QmTest123"`
  - `metadataHash`: `0x24c249d809d276015d1dde014b7c5275e23061a62b957a02764d3311f2afd1ba`
  - Click `transact`. Notice `ProjectRegistered` event with `projectId = 1`.
- Expand `createOpportunity`:
  - In the top **VALUE** field: set value to `1` and dropdown to `Ether`.
  - In `createOpportunity` inputs:
    - `projectId`: `1`
    - `rewardAmount`: `1000000000000000000` (1 Ether in wei)
    - `deadline`: Set to a future timestamp (e.g. current unix timestamp + `86400`).
    - `metadataURI`: `"ipfs://QmOpp456"`
    - `metadataHash`: `0x24c249d809d276015d1dde014b7c5275e23061a62b957a02764d3311f2afd1ba`
  - Click `transact`. The contract balance becomes `1 Ether`.

### Test Scenario B: Submit PR
- Switch to **Account #2 (Contributor)**.
- Set **VALUE** back to `0 Wei`.
- Expand `submitContribution`:
  - `opportunityId`: `1`
  - `prReference`: `"https://github.com/acme/cool-dapp/pull/1"`
  - Click `transact`. `Submission 1` created.

### Test Scenario C: Approve & Release
- Switch back to **Account #1 (Publisher)**.
- Call `approveSubmission(1, 1)`. Opportunity status becomes `Approved`.
- Call `releaseReward(1)`.
  - Contributor Account #2 receives `1 ETH`.
  - Opportunity state becomes `Paid`.

---

## 3. Deploying to Ethereum Sepolia via MetaMask

When ready to deploy on the public testnet:

1. **MetaMask Setup**:
   - Open MetaMask extension.
   - Switch network to **Sepolia** (Chain ID: `11155111`).
   - Ensure your account has Sepolia ETH (from Google Cloud Faucet, Infura Faucet, or Sepolia PoW Faucet).
2. **Connect Remix to MetaMask**:
   - In Remix **Deploy & Run Transactions** tab, change **Environment** to:
     `Injected Provider - MetaMask`.
   - MetaMask will prompt you to connect. Confirm the prompt.
   - Verify that your MetaMask address and Sepolia network (`11155111`) are displayed.
3. **Deploy Contract**:
   - Ensure `ContributionBounty` is selected in the Contract dropdown.
   - Ensure **VALUE** is `0`.
   - Click the orange **Deploy** button.
   - MetaMask will pop up showing the estimated gas fee. Click **Confirm**.
4. **Record Deployment Info**:
   - Once the transaction is mined, look at the Remix terminal:
     - **Contract Address**: e.g., `0x1234...`
     - **Transaction Hash**: e.g., `0xabcd...`
   - Copy the deployed address.
5. **Configure ContribChain**:
   - Open `contribchain/.env.local`
   - Add/update:
     ```bash
     NEXT_PUBLIC_CONTRACT_ADDRESS="0xYourDeployedSepoliaContractAddress"
     NEXT_PUBLIC_SEPOLIA_CHAIN_ID="11155111"
     ```
   - Also update `contribchain/src/contracts/ContributionBountyABI.ts` if you want a fallback constant.

---

## 4. Inspecting Transactions on Sepolia Etherscan

1. Open [https://sepolia.etherscan.io](https://sepolia.etherscan.io).
2. Paste your deployed contract address into the search bar.
3. Check the **Internal Txns** tab to see native Sepolia ETH escrow releases.
4. Check the **Events** tab to verify:
   - `ProjectRegistered`
   - `OpportunityCreated`
   - `ContributionSubmitted`
   - `SubmissionApproved`
   - `RewardReleased`
   - `OpportunityRefunded`

---

## 5. Verification Status

| Step | Status | Evidence / Notes |
| :--- | :--- | :--- |
| **Solidity Code Implementation** | ✅ Verified | `contracts/src/ContributionBounty.sol` with ReentrancyGuard and Checks-Effects-Interactions |
| **Hardhat Automated Tests** | ✅ Verified | **23/23 tests passing** via `npx hardhat test` covering authorization, boundaries, single winner, reentrancy, and refund isolation |
| **Remix VM Walkthrough** | 📋 Ready for user | Documented in Section 2 above |
| **Sepolia Testnet Deployment** | ⏳ Pending User Action | Requires user's MetaMask test account with Sepolia ETH |
