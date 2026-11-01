'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatEther, parseEther } from 'viem'
import { useAccount } from 'wagmi'
import { ArrowRight, CheckCircle2, ExternalLink, GitPullRequest, Plus, Wallet, X } from 'lucide-react'
import { SubmissionProgress } from '@/components/SubmissionProgress'
import { IdentityPanel, FeedStatus, TransactionStatus } from '@/components/PlatformStatus'
import { PublisherActions } from '@/components/PublisherActions'
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui/AppUI'
import { getSubmissionPresentation } from '@/lib/submission-presentation'
import { useFeed, useIdentity, useTransaction, useNow, useActiveNetwork } from '@/lib/use-platform'
import { explorerUrl, currencySymbol, networkName, isMainnet } from '@/lib/contract'

function isValidGithubPr(url?: string | null): boolean {
  if (!url) return false
  return /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/pull\/\d+/i.test(url)
}

type HubTab = 'projects' | 'submissions' | 'rewards' | 'refunds'

export default function PublisherHubPage() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<HubTab>('projects')
  const [mounted, setMounted] = useState(false)
  const net = useActiveNetwork()

  useEffect(() => {
    setMounted(true)
  }, [])
  const { data } = useFeed()
  const identity = useIdentity()
  const tx = useTransaction()
  const now = useNow()
  const projects = data.projects.filter(p =>
    p.publisherAddress.toLowerCase() === address?.toLowerCase() ||
    (!!p.publisherUserId && p.publisherUserId === identity.session?.userId)
  )
  const opportunities = data.opportunities.filter(o =>
    o.publisherAddress.toLowerCase() === address?.toLowerCase() ||
    (!!o.publisherUserId && o.publisherUserId === identity.session?.userId)
  )
  const submissions = data.submissions.filter(s =>
    opportunities.some(o =>
      o.id === s.opportunityId ||
      (o.onChainId && String(o.onChainId) === s.opportunityId) ||
      (o.txHash && o.txHash.toLowerCase() === s.opportunityId.toLowerCase())
    )
  )
  const totalEscrow = formatEther(opportunities.reduce((sum, o) => sum + parseEther(o.remainingEscrowEth || '0'), 0n))
  const awaitingPayment = opportunities.filter(o => o.state === 'Approved').length
  const refundable = opportunities.filter(o => o.state === 'Open' && new Date(o.deadline).getTime() <= now).length
  const history = data.transactions.filter(t => t.wallet.toLowerCase() === address?.toLowerCase())
  const tabs: { id: HubTab; label: string; count: number }[] = [
    { id: 'projects', label: 'My projects', count: projects.length },
    { id: 'submissions', label: 'Submissions', count: submissions.length },
    { id: 'rewards', label: 'Rewards', count: opportunities.filter(o => o.state === 'Approved' || o.state === 'Paid').length },
    { id: 'refunds', label: 'Refunds', count: refundable },
  ]

  return (
    <div className="cc-page">
      <PageHeader
        eyebrow="Workspace / Publisher"
        title="Publisher hub."
        description="Build in the open on MST Blockchain. Fund bounties upfront. Reward contributors directly via smart contract escrow."
        action={
          <Link href="/publisher/projects/new" className="cc-btn cc-btn-primary">
            <Plus size={16} /> Register project
          </Link>
        }
      />
      <IdentityPanel />
      <FeedStatus />
      <TransactionStatus tx={tx} />

      {!mounted || !isConnected || !address ? (
        <EmptyState
          title="Your workspace starts with your wallet."
          description="Connect your BridgeKey or injected wallet from the navigation to see your projects, review contributions and manage {networkName} escrow."
          action={
            <span className="cc-badge">
              <Wallet size={14} /> Wallet connection required
            </span>
          }
        />
      ) : (
        <>
          <div className="cc-stats mb-8">
            <div className="cc-stat">
              <p>Listed projects</p>
              <strong>{projects.length.toString().padStart(2, '0')}</strong>
            </div>
            <div className="cc-stat">
              <p>Active opportunities</p>
              <strong>{opportunities.filter(o => o.state === 'Open' || o.state === 'Approved').length.toString().padStart(2, '0')}</strong>
            </div>
            <div className="cc-stat">
              <p>Locked in escrow</p>
              <strong>{totalEscrow}</strong>
              <small>{currencySymbol} ({networkName.toUpperCase()})</small>
            </div>
            <div className="cc-stat">
              <p>Awaiting review</p>
              <strong>
                {submissions.filter(s => {
                  const opp = opportunities.find(o =>
                    o.id === s.opportunityId ||
                    (o.onChainId && String(o.onChainId) === s.opportunityId) ||
                    (o.txHash && o.txHash.toLowerCase() === s.opportunityId.toLowerCase()) ||
                    (isMainnet && o.onChainId === 2 && (s.opportunityId === '2' || s.onChainId === 1))
                  )
                  return getSubmissionPresentation(s, opp, now).action === 'review'
                }).length.toString().padStart(2, '0')}
              </strong>
            </div>
          </div>

          {awaitingPayment > 0 && activeTab !== 'rewards' && (
            <div role="status" className="cc-panel mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="space-y-2">
                <StatusBadge status="Approved">Payment pending</StatusBadge>
                <h2 className="text-lg font-semibold">Your winner is approved. Finish the reward.</h2>
                <p className="text-sm text-neutral-400">
                  {data.demoMode ? 'Simulate the demo PR merge, then confirm the payout.' : 'After the PR is merged on GitHub, confirm the payout in your wallet.'} Funds remain safely in escrow until confirmation.
                </p>
              </div>
              <button type="button" onClick={() => setActiveTab('rewards')} className="cc-btn cc-btn-primary shrink-0">
                Continue to payment <ArrowRight size={16} />
              </button>
            </div>
          )}

          <div className="cc-tabs mb-8" role="tablist" aria-label="Publisher workspace">
            {tabs.map(tab => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="publisher-content"
                data-active={activeTab === tab.id}
                className="cc-tab"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label} <span className="opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>

          <div id="publisher-content" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {activeTab === 'projects' && (
              <div className="cc-list">
                {projects.map(project => (
                  <article key={project.id} className="cc-card flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="min-w-0 space-y-3">
                      <span className="cc-badge">{project.category}</span>
                      <h2 className="text-2xl font-semibold tracking-tight">{project.name}</h2>
                      <p className="text-sm leading-relaxed text-neutral-400">{project.shortDescription}</p>
                      <a href={project.repoUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 text-xs text-neutral-500 hover:text-white">
                        <GitPullRequest size={14} className="shrink-0" />
                        <span className="truncate">{project.repoUrl.replace('https://github.com/', '')}</span>
                        <ExternalLink size={12} className="shrink-0" />
                      </a>
                      {opportunities.filter(opportunity => opportunity.projectId === project.id && opportunity.txHash).map(opportunity => (
                        <a
                          key={opportunity.id + '-escrow-tx'}
                          href={`${explorerUrl}/tx/${opportunity.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex max-w-full flex-wrap items-center gap-2 text-[11px] text-indigo-300 hover:text-indigo-200"
                        >
                          <span className="shrink-0">{opportunity.title} · escrow transaction</span>
                          <code className="truncate font-mono">{opportunity.txHash}</code>
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                      ))}
                    </div>
                    <div className="cc-inline shrink-0">
                      <Link href={`/publisher/projects/${project.id}/opportunities/new`} className="cc-btn cc-btn-secondary">
                        <Plus size={15} /> Add opportunity
                      </Link>
                      <Link href={`/projects/${project.id}`} className="cc-btn cc-btn-ghost">
                        View project <ArrowRight size={15} />
                      </Link>
                    </div>
                  </article>
                ))}
                {projects.length === 0 && (
                  <EmptyState
                    title="Make room for your next big idea."
                    description="Register a public repository and live dApp, then create an opportunity for contributors."
                    action={
                      <Link href="/publisher/projects/new" className="cc-btn cc-btn-primary">
                        Register your first project <ArrowRight size={16} />
                      </Link>
                    }
                  />
                )}
              </div>
            )}

            {activeTab === 'submissions' && (
              <div className="cc-list">
                {submissions.map(submission => {
                  const opportunity = opportunities.find(o =>
                    o.id === submission.opportunityId ||
                    (o.onChainId && String(o.onChainId) === submission.opportunityId) ||
                    (o.txHash && o.txHash.toLowerCase() === submission.opportunityId.toLowerCase()) ||
                    (isMainnet && o.onChainId === 2 && (submission.opportunityId === '2' || submission.onChainId === 1))
                  )
                  const presentation = getSubmissionPresentation(submission, opportunity, now)
                  return (
                    <article key={submission.id} className="cc-card space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="cc-inline">
                          <span className="cc-badge">PR #{submission.prNumber}</span>
                          <span className="text-sm text-neutral-400">@{submission.githubUsername}</span>
                          {submission.demo && <span className="cc-badge" data-tone="warning">Simulated PR · demo</span>}
                        </div>
                        <StatusBadge status={presentation.status} />
                      </div>
                      <div>
                        <p className="cc-eyebrow mb-2">{opportunity?.title || `Opportunity ${submission.opportunityId}`}</p>
                        <h2 className="text-xl font-semibold tracking-tight">{submission.prTitle}</h2>
                      </div>

                      {presentation.status === 'Paid' ? (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5 space-y-3">
                          <p className="flex items-center gap-2 font-semibold text-emerald-300">
                            <CheckCircle2 size={18} /> Reward paid · confirmed on {networkName}
                          </p>
                          <p className="text-3xl font-semibold tracking-tight">
                            {presentation.rewardEth ?? '—'} <span className="text-base font-normal text-neutral-400">{net.currencySymbol}</span>
                          </p>
                          <p className="text-xs text-neutral-400">
                            Recipient <span className="mt-1 block break-all font-mono text-neutral-300">{presentation.recipient}</span>
                          </p>
                          {presentation.receiptUrl ? (
                            <a href={presentation.receiptUrl} target="_blank" rel="noreferrer" className="cc-btn cc-btn-secondary">
                              View payment receipt on MSTScan <ExternalLink size={14} />
                            </a>
                          ) : (
                            <p className="text-xs text-neutral-400">Confirmed payout. Transaction receipt is synchronizing.</p>
                          )}
                          {submission.demo && <p className="text-xs text-amber-300">The PR was simulated; this payout transferred real {net.currencySymbol} on {net.name}.</p>}
                        </div>
                      ) : (
                        <SubmissionProgress submission={submission} opportunity={opportunity} />
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
                        <div className="min-w-0 text-xs text-neutral-500">
                          <span className="block mb-1">Contributor wallet</span>
                          <span className="break-all font-mono">{submission.contributorAddress}</span>
                        </div>
                        <div className="cc-inline">
                          {!submission.demo && submission.githubPrUrl && isValidGithubPr(submission.githubPrUrl) && (
                            <a href={submission.githubPrUrl} target="_blank" rel="noreferrer" className="cc-btn cc-btn-ghost">
                              View pull request <ExternalLink size={14} />
                            </a>
                          )}
                          {presentation.action === 'review' && (
                            <>
                              <button
                                type="button"
                                disabled={tx.busy}
                                onClick={() =>
                                  void tx.send('actions/prepare', {
                                    action: 'approveContribution',
                                    opportunityId: opportunity?.onChainId ? String(opportunity.onChainId) : (opportunity?.id || submission.opportunityId),
                                    submissionId: submission.onChainId ? String(submission.onChainId) : submission.id,
                                  }).catch(() => {})
                                }
                                className="cc-btn cc-btn-primary"
                              >
                                <CheckCircle2 size={15} /> Approve winner
                              </button>
                              <button
                                type="button"
                                disabled={tx.busy}
                                onClick={() =>
                                  void tx.send('actions/prepare', {
                                    action: 'rejectContribution',
                                    opportunityId: opportunity?.onChainId ? String(opportunity.onChainId) : (opportunity?.id || submission.opportunityId),
                                    submissionId: submission.onChainId ? String(submission.onChainId) : submission.id,
                                  }).catch(() => {})
                                }
                                className="cc-btn cc-btn-danger"
                              >
                                <X size={15} /> Reject
                              </button>
                            </>
                          )}
                          {presentation.action === 'payment' && (
                            <button type="button" onClick={() => setActiveTab('rewards')} className="cc-btn cc-btn-primary">
                              Continue to payment <ArrowRight size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
                {submissions.length === 0 && (
                  <EmptyState
                    title="The next contribution starts here."
                    description="Pull requests submitted to your opportunities will appear here for review."
                    action={
                      <Link href="/explore" className="cc-btn cc-btn-secondary">
                        Explore the ecosystem <ArrowRight size={16} />
                      </Link>
                    }
                  />
                )}
              </div>
            )}
            {activeTab === 'rewards' && <PublisherActions mode="rewards" opportunities={opportunities} submissions={submissions} tx={tx} />}
            {activeTab === 'refunds' && <PublisherActions mode="refunds" opportunities={opportunities} submissions={submissions} tx={tx} />}
          </div>

          <details className="mt-10 border-t border-white/10 pt-5 text-sm text-neutral-400">
            <summary className="cursor-pointer hover:text-white">Transaction history ({history.length})</summary>
            <div className="mt-4 space-y-3">
              {history.map(transaction => (
                <a
                  key={transaction.hash}
                  className="flex flex-wrap items-center gap-2 break-all text-xs hover:text-white"
                  href={`${explorerUrl}/tx/${transaction.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="cc-badge">{transaction.status}</span>
                  <span className="font-mono">{transaction.hash}</span>
                  <ExternalLink size={13} />
                </a>
              ))}
              {history.length === 0 && <p className="text-xs">Confirmed transactions from this wallet on {networkName} will appear here.</p>}
            </div>
          </details>
        </>
      )}
    </div>
  )
}
