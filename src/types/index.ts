export type TaskType = 'bug' | 'feature' | 'documentation' | 'optimization' | 'security'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'
export type OpportunityState = 'Open' | 'Approved' | 'Paid' | 'Refunded'
export type SubmissionStatus = 'Pending' | 'Approved' | 'Paid' | 'Rejected'
export type GitHubPrState = 'open' | 'closed' | 'merged'

export interface Project {
  id: string
  onChainId?: number
  name: string
  shortDescription: string
  detailedDescription: string
  category: string
  technologies: string[]
  repoId?: string
  repoUrl: string
  liveDappUrl: string
  demoVideoUrl?: string
  publisherAddress: string
  publisherUserId?: string
  createdAt: string
  opportunitiesCount?: number
  totalBountyEth?: string
}

export interface Opportunity {
  id: string
  onChainId?: number
  projectId: string
  project?: Project
  title: string
  taskType: TaskType
  description: string
  acceptanceCriteria: string
  difficulty: DifficultyLevel
  requiredSkills: string[]
  rewardEth: string
  deadline: string // ISO string or timestamp
  issueUrl?: string
  state: OpportunityState
  publisherAddress: string
  publisherUserId?: string
  txHash?: string
  selectedSubmissionId?: string
  remainingEscrowEth: string
  submissionsCount?: number
  createdAt: string
}

export interface Submission {
  id: string
  onChainId?: number
  opportunityId: string
  opportunity?: Opportunity
  contributorAddress: string
  contributorUserId?: string
  githubUsername: string
  githubPrUrl: string
  prNumber: number
  prTitle: string
  prState: GitHubPrState
  status: SubmissionStatus
  notes?: string
  createdAt: string
  payoutTxHash?: string
  payoutTimestamp?: string
  identityVerified?: boolean
  demo?: boolean
  prCommit?: string
  lastSyncedAt?: string
  syncError?: string
  verifiedRecordId?: string
}

export interface UserIdentity {
  address: string
  githubUsername?: string
  githubUserId?: string
  isLinked: boolean
  linkedAt?: string
}
