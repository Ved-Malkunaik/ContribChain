export type PayoutStatus = 'none' | 'pending' | 'paid'

export type ReleaseEligibility = {
  requester: string
  publisher: string
  opportunityLinked: boolean
  escrowSufficient: boolean
  contributionLinked: boolean
  prMerged: boolean
  publisherApproved: boolean
  winnerFinalized: boolean
  payoutStatus: PayoutStatus
}

export function assertReleaseRewardEligible(input: ReleaseEligibility): void {
  if (input.requester.toLowerCase() !== input.publisher.toLowerCase()) {
    throw new Error('Only the opportunity publisher can release this reward')
  }
  if (!input.opportunityLinked) throw new Error('Opportunity is not linked to a verified project record')
  if (!input.escrowSufficient) throw new Error('Confirmed escrow is insufficient for this bounty')
  if (!input.contributionLinked) throw new Error('Approved contribution is not linked to a verified contributor')
  if (!input.prMerged) throw new Error('The linked pull request must be confirmed merged before payout')
  if (!input.publisherApproved) throw new Error('Publisher approval is required before payout')
  if (input.winnerFinalized) throw new Error('Another winner has already been finalized')
  if (input.payoutStatus === 'pending') throw new Error('A payout is already pending; reconcile it before retrying')
  if (input.payoutStatus === 'paid') throw new Error('This opportunity has already been paid')
}
