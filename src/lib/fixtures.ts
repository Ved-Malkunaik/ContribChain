import { Project, Opportunity, Submission } from '@/types'

/**
 * FIXTURE DATA FOR FRONTEND PREVIEW & DEMO
 * Clearly separated from database models and live on-chain queries.
 */
export const FIXTURE_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    onChainId: 1,
    name: 'AetherVault DeFi',
    shortDescription: 'Decentralized multi-signature vault for automated liquidity yield farming.',
    detailedDescription:
      'AetherVault is an open-source decentralized treasury and multi-sig vault protocol running on Ethereum Sepolia. It enables DAOs to programmatically distribute rewards and manage collective asset pools with time-locked execution.',
    category: 'DeFi',
    technologies: ['Solidity', 'Next.js', 'Ethers.js', 'Tailwind CSS'],
    repoUrl: 'https://github.com/example-defi/aethervault-core',
    liveDappUrl: 'https://aethervault-demo.vercel.app',
    demoVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    publisherAddress: '0x71C67Ed375502ab803E0B07A72970a7470211d4A',
    createdAt: '2026-10-10T12:00:00.000Z',
    opportunitiesCount: 2,
    totalBountyEth: '0.08',
  },
  {
    id: 'proj-2',
    onChainId: 2,
    name: 'zkIdentity Protocol',
    shortDescription: 'Zero-knowledge proof verification service for Web3 cross-chain identity.',
    detailedDescription:
      'zkIdentity provides privacy-preserving proof generation for developer credentials, open-source commits, and wallet reputation without exposing raw GitHub tokens or sensitive personal keys.',
    category: 'Identity / ZK',
    technologies: ['Circom', 'TypeScript', 'Viem', 'SnarkJS'],
    repoUrl: 'https://github.com/example-zk/zk-identity-verifier',
    liveDappUrl: 'https://zk-id-preview.network',
    publisherAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    createdAt: '2026-10-12T15:30:00.000Z',
    opportunitiesCount: 1,
    totalBountyEth: '0.05',
  },
]

export const FIXTURE_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-1',
    onChainId: 1,
    projectId: 'proj-1',
    title: 'Implement EIP-712 Permit Verification for Vault Withdrawals',
    taskType: 'feature',
    description:
      'Add gasless signature approvals for LP token withdrawals using EIP-712 typed data signatures. Write unit tests covering valid permits, expired timestamps, and replay attempts.',
    acceptanceCriteria:
      '- Add verifyPermit() inside VaultManager.sol\n- Comprehensive tests in Hardhat with >95% coverage\n- Pull request merged into main branch of repo\n- Clean TypeScript integration helpers included',
    difficulty: 'intermediate',
    requiredSkills: ['Solidity', 'EIP-712', 'Hardhat'],
    rewardEth: '0.05',
    deadline: '2026-11-01T23:59:59.000Z',
    issueUrl: 'https://github.com/example-defi/aethervault-core/issues/14',
    state: 'Open',
    publisherAddress: '0x71C67Ed375502ab803E0B07A72970a7470211d4A',
    remainingEscrowEth: '0.05',
    submissionsCount: 1,
    createdAt: '2026-10-14T09:00:00.000Z',
  },
  {
    id: 'opp-2',
    onChainId: 2,
    projectId: 'proj-1',
    title: 'Fix Slippage Rounding in Rebalance Execution',
    taskType: 'bug',
    description:
      'During extreme market volatility, the rebalance calculation truncates basis points causing transactions to revert. Update fixed-point arithmetic to maintain 18-decimal precision.',
    acceptanceCriteria:
      '- Update MathUtils.sol fixed-point multiplier\n- Revert on slippage exceeding tolerance parameter\n- Pull request must pass CI without gas regression',
    difficulty: 'advanced',
    requiredSkills: ['Solidity', 'Math', 'Defi'],
    rewardEth: '0.03',
    deadline: '2026-10-25T23:59:59.000Z',
    state: 'Open',
    publisherAddress: '0x71C67Ed375502ab803E0B07A72970a7470211d4A',
    remainingEscrowEth: '0.03',
    submissionsCount: 0,
    createdAt: '2026-10-15T11:20:00.000Z',
  },
  {
    id: 'opp-3',
    onChainId: 3,
    projectId: 'proj-2',
    title: 'Add Wagmi v2 Frontend React Hooks for Verifier',
    taskType: 'feature',
    description:
      'Integrate the circom zero-knowledge verifier contract with a set of modular React hooks utilizing Wagmi v2 and Viem. Include demo component in the documentation.',
    acceptanceCriteria:
      '- Typed hooks useProofVerify() and useCredentialStatus()\n- Supports Ethereum Sepolia chain\n- PR opened against zk-identity-verifier repository',
    difficulty: 'intermediate',
    requiredSkills: ['React', 'TypeScript', 'Wagmi'],
    rewardEth: '0.05',
    deadline: '2026-10-28T23:59:59.000Z',
    state: 'Open',
    publisherAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    remainingEscrowEth: '0.05',
    submissionsCount: 1,
    createdAt: '2026-10-14T14:45:00.000Z',
  },
]

export const FIXTURE_SUBMISSIONS: Submission[] = [
  {
    id: 'sub-1',
    onChainId: 1,
    opportunityId: 'opp-1',
    contributorAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    githubUsername: 'web3-builder-alice',
    githubPrUrl: 'https://github.com/example-defi/aethervault-core/pull/22',
    prNumber: 22,
    prTitle: 'feat: add EIP-712 permit verification with comprehensive test suite',
    prState: 'open',
    status: 'Pending',
    notes: 'Implemented signature verification with domain separator matching EIP-2612 guidelines.',
    createdAt: '2026-10-15T16:00:00.000Z',
  },
]
