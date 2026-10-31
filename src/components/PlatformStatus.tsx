'use client'
import { useIdentity, useTransaction, useFeed } from '@/lib/use-platform'
import { useState } from 'react'
import { ArrowUpRight, CheckCircle2, FlaskConical, RefreshCw, ShieldCheck } from 'lucide-react'
import { explorerUrl, networkName, currencySymbol } from '@/lib/contract'
import { transactionExplorerHref } from '@/lib/transaction-presentation'

export function IdentityPanel() {
  const identity = useIdentity()
  if (identity.session?.demoMode) {
    return (
      <div role="note" className="cc-notice mb-5" data-tone="demo">
        <FlaskConical className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong className="block font-medium text-xs mb-1">Demo PRs. Real {networkName} (${currencySymbol}) rewards.</strong>
          <p className="text-[11px]">GitHub identity and merging can be simulated. Escrow funding, approval and payouts are real on {networkName}.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="cc-notice mb-5">
      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <p>
          GitHub: {identity.githubLinked
            ? identity.session?.githubUsername ? `@${identity.session.githubUsername}` : identity.session?.name || identity.session?.githubId
            : 'Not linked (optional)'}
          <span className="text-[#55555f] mx-2">/</span>
          Wallet: {identity.linked ? 'Verified' : identity.walletReady ? 'Ready' : 'Not connected'}
        </p>
        {!identity.githubLinked ? (
          <form action="/api/auth/signin" method="get">
            <button className="cc-link">Link GitHub (optional)</button>
          </form>
        ) : !identity.linked ? (
          <div className="cc-inline">
            <button disabled={identity.busy} onClick={() => void identity.link()} className="cc-link disabled:opacity-40">
              {identity.busy ? 'Awaiting signature…' : 'Link GitHub to this wallet'}
            </button>
            <form action="/api/auth/signout" method="get">
              <button className="cc-link">Sign out</button>
            </form>
          </div>
        ) : (
          <div className="cc-inline">
            <span className="text-xs text-emerald-300">Wallet and GitHub linked</span>
            <form action="/api/auth/signout" method="get"><button className="cc-link">Sign out</button></form>
          </div>
        )}
        {identity.error && <p role="alert" className="text-[#e5a1a8]">{identity.error}</p>}
      </div>
    </div>
  )
}

export function FeedStatus() {
  const feed = useFeed()
  const error = feed.error?.message || feed.data.syncError
  return (
    <>
      <div className="cc-statusbar" role="status">
        <div className="cc-inline">
          <span className={'w-1.5 h-1.5 rounded-full ' + (error ? 'bg-[#d7b777]' : 'bg-[#a8d7bb]')} />
          <span>{feed.isLoading ? 'Loading chain data' : feed.isFetching ? `Syncing with ${networkName}` : networkName}</span>
          {feed.data.demoMode && (
            <>
              <span className="cc-badge">DEMO PR FLOW</span>
              <span className="hidden sm:inline">Simulated GitHub · real MST escrow</span>
            </>
          )}
        </div>
        <div className="cc-inline">
          <span className="hidden lg:inline">Updates every 15 seconds</span>
          <button type="button" disabled={feed.isFetching} onClick={() => void feed.refetch()}>
            <RefreshCw className={'w-3 h-3 ' + (feed.isFetching ? 'animate-spin' : '')} />Refresh
          </button>
        </div>
      </div>
      {error && <p role="alert" className="cc-notice mb-5" data-tone="error">{error} Displayed data may be stale; payment requires a fresh check.</p>}
    </>
  )
}

const confirmations: Record<string, string> = {
  registerProject: 'Project registered',
  createOpportunity: 'Opportunity funded',
  submitContribution: 'Contribution submitted',
  approveSubmission: 'Winner approved — payment is in escrow',
  approveContribution: 'Winner approved — payment is in escrow',
  rejectSubmission: 'Submission rejected',
  rejectContribution: 'Submission rejected',
  releaseReward: `Payment confirmed on ${networkName}`,
  refundExpiredOpportunity: `Refund confirmed on ${networkName}`,
  cancelOpportunity: `Refund confirmed on ${networkName}`,
}

export function TransactionStatus({ tx }: { tx: ReturnType<typeof useTransaction> }) {
  const [replacementHash, setReplacementHash] = useState('')
  return (
    <div aria-live="polite" className="mb-6 space-y-3 text-xs break-words">
      {tx.message && (
        <div role="status" className="cc-notice" data-tone={tx.confirmedFunction ? 'success' : undefined}>
          {tx.confirmedFunction && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
          <div>
            {tx.confirmedFunction && <strong className="block mb-1 font-medium">{confirmations[tx.confirmedFunction] || 'Transaction confirmed'}</strong>}
            <p>{tx.message}</p>
          </div>
        </div>
      )}
      {tx.error && (
        <div role="alert" className="cc-notice flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" data-tone="error">
          <p>{tx.error}</p>
          {(tx.error.toLowerCase().includes('refresh this page') || tx.error.toLowerCase().includes('connection was reset')) && (
            <button
              type="button"
              className="cc-btn cc-btn-secondary text-xs shrink-0"
              onClick={() => window.location.reload()}
            >
              Refresh page now
            </button>
          )}
        </div>
      )}
      {tx.hash && transactionExplorerHref(tx.hash, explorerUrl) && (
        <div className="cc-notice space-y-2" data-tone={tx.confirmedFunction ? 'success' : undefined}>
          <p className="text-[11px] text-neutral-400">
            {tx.confirmedFunction === 'createOpportunity' ? 'Escrow funding transaction hash' : tx.confirmedFunction ? 'Confirmed transaction hash' : 'Pending transaction hash'}
          </p>
          <code className="block font-mono text-[11px] text-neutral-200 break-all select-all">{tx.hash}</code>
          <a className="cc-link inline-flex items-center gap-2 text-[11px]" href={transactionExplorerHref(tx.hash, explorerUrl)!} target="_blank" rel="noreferrer">
            View transaction on MSTScan <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      )}
      <details className="text-[#70707b] text-[10px]">
        <summary className="cursor-pointer hover:text-white w-fit">Transaction recovery</summary>
        <div className="mt-3 cc-panel !p-4 max-w-lg">
          <label className="cc-field">
            <span className="text-xs">Replacement hash (optional)</span>
            <input aria-label="Replacement transaction hash" className="cc-input mt-2" value={replacementHash} onChange={e => setReplacementHash(e.target.value)} placeholder="0x… from BridgeKey or MSTScan" />
          </label>
          <div className="flex items-center gap-2 mt-3">
            <button type="button" disabled={tx.busy} className="cc-btn cc-btn-secondary" onClick={() => void tx.recover(replacementHash || undefined)}>
              Check stored transaction
            </button>
            <button
              type="button"
              className="cc-btn cc-btn-ghost text-rose-300 hover:text-rose-200 text-xs"
              onClick={() => {
                localStorage.removeItem('contribchain.pending.v1')
                window.location.reload()
              }}
            >
              Clear pending
            </button>
          </div>
        </div>
      </details>
    </div>
  )
}
