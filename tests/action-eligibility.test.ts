import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertReleaseRewardEligible } from '../src/lib/server/action-eligibility.ts'

const eligible = () => ({
  requester: '0xpublisher',
  publisher: '0xpublisher',
  opportunityLinked: true,
  escrowSufficient: true,
  contributionLinked: true,
  prMerged: true,
  publisherApproved: true,
  winnerFinalized: false,
  payoutStatus: 'none' as const,
})

test('release requires the authenticated opportunity publisher', () => {
  assert.throws(() => assertReleaseRewardEligible({ ...eligible(), requester: '0ximpostor' }), /publisher/)
})

test('release requires a linked opportunity, contributor, and sufficient escrow', () => {
  assert.throws(() => assertReleaseRewardEligible({ ...eligible(), opportunityLinked: false }), /[Oo]pportunity/)
  assert.throws(() => assertReleaseRewardEligible({ ...eligible(), contributionLinked: false }), /contribution/)
  assert.throws(() => assertReleaseRewardEligible({ ...eligible(), escrowSufficient: false }), /escrow/)
})

test('release requires a merged PR and explicit publisher approval', () => {
  assert.throws(() => assertReleaseRewardEligible({ ...eligible(), prMerged: false }), /merged/)
  assert.throws(() => assertReleaseRewardEligible({ ...eligible(), publisherApproved: false }), /[Aa]pproval/)
})

test('release refuses finalized winners and pending or paid payouts', () => {
  assert.throws(() => assertReleaseRewardEligible({ ...eligible(), winnerFinalized: true }), /winner/)
  assert.throws(() => assertReleaseRewardEligible({ ...eligible(), payoutStatus: 'pending' }), /pending/)
  assert.throws(() => assertReleaseRewardEligible({ ...eligible(), payoutStatus: 'paid' }), /paid/)
})

test('release accepts a fully eligible payout', () => {
  assert.doesNotThrow(() => assertReleaseRewardEligible(eligible()))
})
