'use client'
import type { Submission, Opportunity } from '@/types'
import { ArrowUpRight } from 'lucide-react'
import { explorerUrl, currencySymbol } from '@/lib/contract'

export function SubmissionProgress({
  submission: s,
  opportunity: o,
}: {
  submission: Submission
  opportunity?: Opportunity
}) {
  const isSelected =
    !!o?.selectedSubmissionId &&
    o.selectedSubmissionId !== '0' &&
    (o.selectedSubmissionId === s.id ||
      (s.onChainId && String(s.onChainId) === String(o.selectedSubmissionId)) ||
      (s.verifiedRecordId && s.verifiedRecordId === o.selectedSubmissionId))
  const notSelected = !!o?.selectedSubmissionId && o.selectedSubmissionId !== '0' && !isSelected
  const paid = s.status === 'Paid' || !!s.payoutTxHash
  const review = notSelected
    ? 'Not selected'
    : paid || s.status === 'Approved' || isSelected
    ? 'Winner approved'
    : s.status === 'Pending'
    ? 'Awaiting review'
    : s.status

  return (
    <div className="mt-4 space-y-3">
      <div className="cc-workflow">
        <div>
          <p>01 · Publisher review</p>
          <strong>{review}</strong>
        </div>
        <div>
          <p>02 · {s.demo ? 'Demo PR' : 'GitHub PR'}</p>
          <strong>
            {s.demo
              ? 'Simulated ' + s.prState
              : s.prState === 'merged'
              ? 'Merged'
              : s.prState || 'Unknown'}
          </strong>
        </div>
        <div>
          <p>03 · Escrow payment</p>
          <strong className={paid ? '!text-[#b0e5c5]' : ''}>
            {paid ? 'Paid on MST Testnet' : o?.state === 'Refunded' ? 'Refunded' : s.status === 'Approved' ? 'Awaiting publisher' : 'Not paid'}
          </strong>
        </div>
      </div>
      {s.payoutTxHash && (
        <a className="cc-link inline-flex items-center gap-1 text-[10px]" href={`${explorerUrl}/tx/${s.payoutTxHash}`} target="_blank" rel="noreferrer">
          Payment receipt on MSTScan <ArrowUpRight className="w-3 h-3" />
        </a>
      )}
      {s.demo && (
        <p className="text-[10px] text-[#93856d]">
          Demo PR · GitHub identity and merge are simulated. Wallet payments are real {currencySymbol} on MST Testnet.
        </p>
      )}
      {!s.demo && <p className="text-[10px] text-[#656571]">Last sync: {s.lastSyncedAt || 'Pending'} · Commit: {s.prCommit?.slice(0, 12) || 'Unknown'}</p>}
      {s.syncError && <p className="text-[11px] text-[#e8cc95]">{s.syncError}</p>}
      {!s.identityVerified && !s.demo && (
        <p className="text-[11px] text-[#e8cc95]">Public PR status is tracked. This wallet is not linked to the GitHub author, so the publisher should verify the contribution before approval.</p>
      )}
    </div>
  )
}
