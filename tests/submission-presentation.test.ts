import test from 'node:test'
import assert from 'node:assert/strict'
import { getSubmissionPresentation } from '../src/lib/submission-presentation.ts'
import { explorerUrl } from '../src/lib/contract.ts'
import type { Opportunity, Submission } from '../src/types/index.ts'

const submission: Submission = {
  id: '7', opportunityId: '3', contributorAddress: '0x1234',
  githubUsername: 'builder', githubPrUrl: 'https://github.com/team/app/pull/8',
  prNumber: 8, prTitle: 'Fix wallet connection', prState: 'merged',
  status: 'Pending', identityVerified: true, createdAt: '2026-10-01T00:00:00Z',
}
const opportunity: Opportunity = {
  id: '3', projectId: '1', title: 'Wallet fix', taskType: 'bug',
  description: 'Fix connection', acceptanceCriteria: 'Works', difficulty: 'beginner',
  requiredSkills: ['TypeScript'], rewardEth: '0.01', deadline: '2026-12-01T00:00:00Z',
  state: 'Open', publisherAddress: '0x5678', remainingEscrowEth: '0.01',
  createdAt: '2026-10-01T00:00:00Z',
}

test('paid submissions expose receipt data and no review or payment action', () => {
  const result = getSubmissionPresentation({ ...submission, status: 'Paid', payoutTxHash: '0xreceipt' }, opportunity)
  assert.equal(result.action, null)
  assert.equal(result.status, 'Paid')
  assert.equal(result.receiptUrl, `${explorerUrl}/tx/0xreceipt`)
  assert.equal(result.rewardEth, '0.01')
  assert.equal(result.recipient, '0x1234')
})

test('indexed payout receipt overrides a stale pending review label', () => {
  const result = getSubmissionPresentation({ ...submission, payoutTxHash: '0xreceipt' }, opportunity)
  assert.equal(result.status, 'Paid')
  assert.equal(result.action, null)
})

test('approved winner continues to payment without offering another review', () => {
  const result = getSubmissionPresentation({ ...submission, status: 'Approved' }, { ...opportunity, state: 'Approved', selectedSubmissionId: '7' })
  assert.equal(result.status, 'Approved')
  assert.equal(result.action, 'payment')
})

test('paid opportunity prevents a stale winning submission from releasing funds again', () => {
  const result = getSubmissionPresentation({ ...submission, status: 'Approved' }, { ...opportunity, state: 'Paid', selectedSubmissionId: '7' })
  assert.equal(result.status, 'Paid')
  assert.equal(result.action, null)
})

test('pending verified submission can be reviewed while escrow is open', () => {
  assert.equal(getSubmissionPresentation(submission, opportunity).action, 'review')
})

test('pending submissions cannot be reviewed after another winner is selected or a refund', () => {
  for (const state of ['Approved', 'Paid', 'Refunded'] as const) {
    const result = getSubmissionPresentation(submission, { ...opportunity, state, selectedSubmissionId: state === 'Refunded' ? undefined : '8' })
    assert.equal(result.action, null, state)
    assert.notEqual(result.status, 'Paid', 'another winner’s payout must not become this contributor’s reward')
  }
})

test('simulated submissions cannot be reviewed; unverified submissions allow publisher review', () => {
  assert.equal(getSubmissionPresentation({ ...submission, identityVerified: false }, opportunity).action, 'review')
  assert.equal(getSubmissionPresentation({ ...submission, identityVerified: false, demo: true }, opportunity).action, null)
  assert.equal(getSubmissionPresentation({ ...submission, identityVerified: true, demo: true }, opportunity).action, null)
})

test('rejected submissions and submissions missing an opportunity expose no actions', () => {
  assert.equal(getSubmissionPresentation({ ...submission, status: 'Rejected' }, opportunity).action, null)
  assert.equal(getSubmissionPresentation(submission).action, null)
})

test('review stops exactly at the submission deadline and waits for the client clock', () => {
  const deadline = new Date(opportunity.deadline).getTime()
  assert.equal(getSubmissionPresentation(submission, opportunity, deadline - 1).action, 'review')
  for (const now of [0, deadline, deadline + 1]) {
    assert.equal(getSubmissionPresentation(submission, opportunity, now).action, null)
  }
  assert.equal(getSubmissionPresentation(submission, opportunity, deadline).status, 'Deadline passed')
})

test('an already approved winner can still receive payment after the deadline', () => {
  const result = getSubmissionPresentation({ ...submission, status: 'Approved' }, { ...opportunity, state: 'Approved', selectedSubmissionId: '7' }, new Date(opportunity.deadline).getTime() + 1)
  assert.equal(result.action, 'payment')
})
