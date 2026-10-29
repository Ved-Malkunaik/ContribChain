import type { Opportunity, Submission } from '@/types'
import { explorerUrl } from './contract'

export function getSubmissionPresentation(
  submission: Submission,
  opportunity?: Opportunity,
  now = Date.now()
) {
  const selected = opportunity?.selectedSubmissionId
  const hasWinner = !!selected && selected !== '0'
  const isWinner = hasWinner && selected === submission.id
  const paid = !!submission.payoutTxHash || submission.status === 'Paid' || (isWinner && opportunity?.state === 'Paid')
  let status: string = submission.status
  let action: 'review' | 'payment' | null = null

  if (paid) {
    status = 'Paid'
  } else if (hasWinner && !isWinner) {
    status = submission.status === 'Rejected' ? 'Rejected' : 'Not selected'
  } else if (opportunity?.state === 'Refunded') {
    status = 'Opportunity refunded'
  } else if (opportunity && (submission.status === 'Approved' || (isWinner && opportunity.state === 'Approved'))) {
    status = 'Approved'
    action = 'payment'
  } else if (
    submission.status === 'Pending' &&
    opportunity?.state === 'Open' &&
    submission.identityVerified && !submission.demo
  ) {
    const deadline = new Date(opportunity.deadline).getTime()
    if (now > 0 && deadline > now) action = 'review'
    else if (now > 0 && deadline <= now) status = 'Deadline passed'
  }

  const rewardNum = opportunity?.rewardEth ? parseFloat(opportunity.rewardEth) : 0
  const feeEth = rewardNum > 0 ? (rewardNum * 0.03).toFixed(4) : undefined
  const payoutEth = rewardNum > 0 ? (rewardNum * 0.97).toFixed(4) : undefined

  return {
    status,
    action,
    receiptUrl: submission.payoutTxHash ? `${explorerUrl}/tx/${submission.payoutTxHash}` : undefined,
    rewardEth: opportunity?.rewardEth,
    platformFeeEth: feeEth,
    contributorPayoutEth: payoutEth,
    recipient: submission.contributorAddress,
  }
}
