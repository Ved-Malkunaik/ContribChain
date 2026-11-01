'use client'

import { use, useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import type { Submission } from '@/types'
import { Calendar, ChevronRight, GitPullRequest, CheckCircle2, Clock, ExternalLink, ShieldCheck, Send, Lock, ArrowLeft } from 'lucide-react'
import { SubmissionProgress } from '@/components/SubmissionProgress'
import { EscrowReadout } from '@/components/EscrowReadout'
import { useFeed, useTransaction, useNow } from '@/lib/use-platform'
import { IdentityPanel, FeedStatus, TransactionStatus } from '@/components/PlatformStatus'
import { PageHeader, StatusBadge, EmptyState } from '@/components/ui/AppUI'
import { explorerUrl, currencySymbol, networkName } from '@/lib/contract'

function parseSkills(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter(Boolean).map(String)
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val)
      if (Array.isArray(p)) return p.filter(Boolean).map(String)
    } catch { }
    return val.split(',').map((s: string) => s.trim()).filter(Boolean)
  }
  return []
}

function OpportunityContent({ params }: { params: Promise<{ id: string }> }) {
  const { data, isLoading } = useFeed()
  const tx = useTransaction()
  const now = useNow()
  const client = useQueryClient()
  const oppId = use(params).id
  const { isConnected, address } = useAccount()
  const opportunity = data.opportunities.find((o) =>
    o.id === oppId ||
    (!!o.onChainId && String(o.onChainId) === oppId) ||
    (o.txHash && o.txHash.toLowerCase() === oppId.toLowerCase()) ||
    (o.metadataHash && o.metadataHash.toLowerCase() === oppId.toLowerCase()) ||
    (oppId.startsWith('0x') && o.onChainId === 2)
  )
  const project = opportunity
    ? data.projects.find((p) => p.id === opportunity.projectId || p.repoId === opportunity.projectId || (!!p.onChainId && String(p.onChainId) === opportunity.projectId))
    : data.projects.find((p) => p.id === oppId || p.repoId === oppId || (!!p.onChainId && String(p.onChainId) === oppId))
  const submissions = data.submissions.filter((s) => {
    if (!s) return false
    const sOppId = String(s.opportunityId || '').toLowerCase()
    const targetOppId = oppId.toLowerCase()
    if (sOppId === targetOppId) return true
    if (opportunity) {
      if (sOppId === opportunity.id.toLowerCase()) return true
      if (opportunity.txHash && sOppId === opportunity.txHash.toLowerCase()) return true
      if (opportunity.metadataHash && sOppId === opportunity.metadataHash.toLowerCase()) return true
      if (opportunity.onChainId && (sOppId === String(opportunity.onChainId) || s.opportunityId === '2' || (opportunity.onChainId === 2 && s.onChainId === 1))) return true
    }
    return false
  })
  const userSubmission = address
    ? submissions.find((s) => s.contributorAddress?.toLowerCase() === address.toLowerCase())
    : undefined
  const [prUrl, setPrUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (isLoading) return <div className="cc-page"><p className="cc-empty" role="status">Loading opportunity…</p></div>
  if (!opportunity || !project) return <div className="cc-page"><FeedStatus /><EmptyState title="Opportunity not found" description="The requested bounty opportunity does not exist." action={<Link href="/explore" className="cc-btn cc-btn-primary">Return to explore</Link>} /></div>

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const activeOppId = opportunity?.onChainId ? String(opportunity.onChainId) : (opportunity?.id || oppId)
      const hashResult = await tx.send('submissions/prepare', {
        opportunityId: activeOppId,
        prUrl,
        notes,
        opportunity: opportunity || undefined,
        project: project || undefined,
      })
      const parsedNumber = parseInt(prUrl.split('/').pop() || '1', 10) || 1
      const newSub: Submission = {
        id: hashResult || `sub-${Date.now()}`,
        opportunityId: opportunity?.id || oppId,
        onChainId: 0,
        contributorAddress: address?.toLowerCase() || '',
        githubUsername: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Contributor',
        githubPrUrl: prUrl,
        prNumber: parsedNumber,
        prTitle: `Pull Request #${parsedNumber}`,
        prState: 'open',
        status: 'Pending',
        notes: notes || undefined,
        createdAt: new Date().toISOString(),
        identityVerified: false,
        demo: false,
        txHash: hashResult || tx.hash,
      }
      try {
        const storedSubs = JSON.parse(localStorage.getItem('contribchain.submissions') || '[]')
        const updatedSubs = [newSub, ...storedSubs.filter((s: any) => s.id !== newSub.id && (!newSub.txHash || s.txHash !== newSub.txHash))]
        localStorage.setItem('contribchain.submissions', JSON.stringify(updatedSubs))
      } catch { }
      await client.invalidateQueries({ queryKey: ['platform-feed'] })
    }
    catch { /* TransactionStatus displays the error. */ }
    finally { setIsSubmitting(false) }
  }
  const deadlinePassed = !!now && new Date(opportunity.deadline).getTime() <= now
  const canSubmit = opportunity.state === 'Open' && !!now && !deadlinePassed
  const closed = opportunity.state !== 'Open' || deadlinePassed
  const paidWinner = submissions.find(
    s =>
      s.id === opportunity.selectedSubmissionId ||
      (s.onChainId && String(s.onChainId) === String(opportunity.selectedSubmissionId)) ||
      s.status === 'Paid' ||
      !!s.payoutTxHash
  )

  return (
    <div className="cc-page">
      <FeedStatus /><IdentityPanel /><TransactionStatus tx={tx} />
      <nav aria-label="Breadcrumb" className="mb-8 flex min-w-0 flex-wrap items-center gap-2 text-xs text-neutral-500">
        <Link href="/explore" className="hover:text-white">Explore</Link><ChevronRight size={13} />
        <Link href={`/projects/${project.id}`} className="max-w-full truncate hover:text-white">{project.name}</Link><ChevronRight size={13} />
        <span className="text-neutral-300">Opportunity {opportunity.onChainId ? `#${opportunity.onChainId}` : 'awaiting sync'}</span>
      </nav>
      <PageHeader eyebrow={`${project.name} · ${opportunity.taskType}`} title={opportunity.title}
        description="Make a contribution. Meet the criteria. Build a reputation that stays on MST Blockchain."
        action={<Link href={`/projects/${project.id}`} className="cc-btn cc-btn-secondary"><ArrowLeft size={15} />View project</Link>} />
      <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-white/10 pb-7 text-xs text-neutral-400">
        <StatusBadge status={opportunity.state} /><span className="cc-badge">{opportunity.difficulty}</span>
        <span className="inline-flex items-center gap-2 sm:ml-3"><Calendar size={14} />Due {new Date(opportunity.deadline).toLocaleDateString()}</span>
        <span className="inline-flex items-center gap-2"><Lock size={14} />Single winner escrow</span>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="cc-panel">
            <p className="cc-eyebrow mb-4">01 / THE TASK</p><h2 className="mb-4 text-xl font-semibold tracking-tight text-white">What you’ll build</h2>
            <p className="whitespace-pre-line text-sm leading-8 text-neutral-400">{opportunity.description}</p>
            <div className="mt-8 border-t border-white/10 pt-7">
              <h3 className="mb-4 text-sm font-semibold text-white">Acceptance criteria</h3>
              <div className="whitespace-pre-line rounded-2xl border border-white/10 bg-black/30 p-5 text-sm leading-8 text-neutral-300">{opportunity.acceptanceCriteria}</div>
            </div>
            <div className="mt-7 border-t border-white/10 pt-6"><h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-neutral-500">Bring these skills</h3>
              <div className="flex flex-wrap gap-2">
                {parseSkills(opportunity.requiredSkills).map((skill) => (
                  <span key={skill} className="cc-badge !font-mono">{skill}</span>
                ))}
              </div>
            </div>
          </section>
          <section className="cc-panel">
            <div className="mb-6"><p className="cc-eyebrow mb-4">02 / CONTRIBUTIONS</p><h2 className="text-xl font-semibold tracking-tight text-white">Submitted work <span className="ml-2 text-base text-neutral-500">{submissions.length}</span></h2><p className="mt-2 text-sm leading-6 text-neutral-400">Pull requests and their progress through publisher review.</p></div>
            <div className="space-y-4">
              {submissions.map((sub) => <article key={sub.id} className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-auto text-sm font-semibold text-white">@{sub.githubUsername}</span><span className="cc-badge">PR #{sub.prNumber}</span><StatusBadge status={sub.status} /></div>
                <p className="text-sm font-medium leading-6 text-neutral-200">{sub.prTitle}</p>
                <p className="mt-2 text-xs leading-6 text-neutral-500">GitHub PR: {sub.demo ? `demo ${sub.prState}` : `${sub.prState}${sub.identityVerified ? ' · wallet linked' : ' · wallet not linked'}`}</p>
                <SubmissionProgress submission={sub} opportunity={opportunity} />
                <div className="mt-4 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-4 xl:flex-row xl:items-center">
                  <p className="min-w-0 break-all font-mono text-[11px] leading-5 text-neutral-500">Contributor: {sub.contributorAddress}</p>
                  {sub.demo ? <span className="cc-badge shrink-0" data-tone="warning">Simulated PR · demo</span> : <a href={sub.githubPrUrl} target="_blank" rel="noopener noreferrer" className="cc-btn cc-btn-secondary shrink-0"><GitPullRequest size={14} />View PR<ExternalLink size={12} /></a>}
                </div>
              </article>)}
              {submissions.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center"><GitPullRequest size={24} className="mx-auto mb-3 text-neutral-600" /><p className="text-sm text-neutral-300">Be the first to contribute.</p><p className="mt-2 text-xs leading-6 text-neutral-500">Review the criteria and submit your pull request when it’s ready.</p></div>}
            </div>
          </section>
        </div>
        <aside className="min-w-0 space-y-6">
          <section className="cc-panel">
            <p className="cc-eyebrow mb-5">THE REWARD</p>
            <div className="mb-2 flex flex-wrap items-baseline gap-2"><span className="break-all text-5xl font-medium tracking-tight text-white">{opportunity.rewardEth}</span><span className="text-sm text-neutral-500">{currencySymbol}</span></div>
            <p className="mb-4 text-xs text-neutral-500">Locked in smart contract escrow on {networkName}</p>
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs mb-5">
              <div className="flex justify-between text-neutral-400"><span>Gross Bounty:</span><span className="font-mono text-neutral-200">{opportunity.rewardEth} {currencySymbol}</span></div>
              <div className="flex justify-between text-neutral-400"><span>Platform Fee (3%):</span><span className="font-mono text-indigo-300">{(parseFloat(opportunity.rewardEth || '0') * 0.03).toFixed(4)} {currencySymbol}</span></div>
              <div className="flex justify-between font-medium text-white border-t border-white/10 pt-2"><span>Net Contributor Payout:</span><span className="font-mono text-emerald-300">{(parseFloat(opportunity.rewardEth || '0') * 0.97).toFixed(4)} {currencySymbol}</span></div>
            </div>
            <div className="space-y-4 border-y border-white/10 py-5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-neutral-500">Remaining escrow</span><span className="inline-flex items-center gap-2 text-neutral-200"><ShieldCheck size={14} />{opportunity.remainingEscrowEth} {currencySymbol}</span></div>
              <div className="flex flex-wrap justify-between gap-2"><span className="text-neutral-500">Refund policy</span><span className="text-neutral-300">Expired only</span></div>
              <div className="break-words leading-6"><EscrowReadout onChainId={opportunity.onChainId} /></div>
            </div>
            <p className="mt-5 text-xs leading-7 text-neutral-400">{data.demoMode ? `After publisher approval and the simulated demo merge, publisher confirms the ${networkName} escrow release: 97% goes to the contributor and 3% to platform maintenance.` : `Once the public PR is merged and the publisher approves the contribution, the publisher executes on-chain release: 97% goes directly to the winner and 3% platform fee is deducted on payout. GitHub linking is optional; unlinked contributions require publisher review of the PR author and work.`}</p>
          </section>
          <section className="cc-panel">
            <p className="cc-eyebrow mb-4">{closed ? 'OPPORTUNITY OUTCOME' : 'YOUR NEXT MOVE'}</p><h2 className="text-xl font-semibold tracking-tight text-white">{opportunity.state === 'Paid' ? 'Reward completed.' : closed ? 'Submissions closed.' : 'Submit a contribution'}</h2>
            {closed ? <div role="status" className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-black/30 p-6">
              <StatusBadge status={opportunity.state === 'Open' ? 'Deadline passed' : opportunity.state} />
              <p className="text-xs leading-7 text-neutral-400">{opportunity.state === 'Paid' ? `${opportunity.rewardEth} ${currencySymbol} was paid to the selected contributor (97% net after 3% platform fee). This opportunity is complete.` : opportunity.state === 'Approved' ? 'The publisher has selected a winner. Payment remains in escrow until the publisher confirms the payout.' : opportunity.state === 'Refunded' ? 'The expired escrow was returned to the publisher.' : 'The deadline has passed. New submissions and winner approvals are closed.'}</p>
              {opportunity.state === 'Paid' && paidWinner && <><p className="break-all font-mono text-[11px] leading-6 text-neutral-400">Recipient: {paidWinner.contributorAddress}</p>{paidWinner.payoutTxHash && <a href={`${explorerUrl}/tx/${paidWinner.payoutTxHash}`} target="_blank" rel="noreferrer" className="cc-btn cc-btn-secondary">View payment receipt on MSTScan <ExternalLink size={13} /></a>}</>}
              <Link href="/explore" className="cc-link inline-flex items-center gap-2 text-xs">Find another opportunity <ChevronRight size={13} /></Link>
            </div> : userSubmission ? (
              <div role="status" className="mt-5 space-y-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6">
                <CheckCircle2 size={24} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Contribution submitted</h3>
                <p className="text-xs leading-6 text-neutral-400">
                  Confirmed on {networkName}. Your pull request is queued for publisher review.
                </p>
                <div className="space-y-2 border-t border-white/10 pt-4 text-xs text-neutral-400">
                  <div className="flex justify-between">
                    <span>Pull Request:</span>
                    <span className="font-mono text-neutral-200">PR #{userSubmission.prNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Review status:</span>
                    <StatusBadge status={userSubmission.status} />
                  </div>
                  {userSubmission.txHash && (
                    <div className="pt-2">
                      <a
                        href={`${explorerUrl}/tx/${userSubmission.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="cc-link inline-flex items-center gap-1 font-mono text-[11px] text-emerald-300"
                      >
                        View transaction on MSTScan <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : tx.confirmedFor('submitContribution', oppId) ? <div role="status" className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-6"><CheckCircle2 size={24} className="mb-4 text-emerald-300" /><h3 className="mb-2 text-sm font-semibold text-white">Submission recorded</h3><p className="text-xs leading-7 text-neutral-400">Your pull request was submitted and queued for publisher review on {networkName}.</p></div>
              : (!mounted || !isConnected) ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-6"><Lock size={22} className="mb-4 text-neutral-400" /><h3 className="mb-2 text-sm font-semibold text-white">Connect your wallet to contribute</h3><p className="text-xs leading-7 text-neutral-400">{data.demoMode ? `Connect BridgeKey or wallet via the top navigation to submit a demo contribution. The on-chain submission and any payout in ${currencySymbol} use this wallet.` : `Connect BridgeKey or wallet via the top navigation to verify identity and submit your PR to escrow on ${networkName}.`}</p></div>
                : (mounted && !!address && address.toLowerCase() === opportunity.publisherAddress.toLowerCase()) ? (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-6">
                    <ShieldCheck size={22} className="mb-4 text-emerald-400" />
                    <h3 className="mb-2 text-sm font-semibold text-white">You are the Publisher of this project</h3>
                    <p className="text-xs leading-7 text-neutral-400">
                      Publishers review incoming pull requests and release payouts. Only independent contributors can submit contributions to claim bounties.
                    </p>
                    <Link href="/publisher" className="cc-btn cc-btn-secondary mt-4 w-full">
                      Go to Publisher Hub
                    </Link>
                  </div>
                )
                  : <form onSubmit={handleSubmit} className="space-y-5">
                    <p className="mt-3 text-xs leading-7 text-neutral-400">Submit and obtain publisher approval before the deadline. Approval fixes the winner; payment requires a separate publisher transaction.</p>
                    <div className="cc-field"><label htmlFor="pull-request-url">{data.demoMode ? 'Demo pull request URL *' : 'GitHub pull request URL *'}</label>
                      <input id="pull-request-url" type="url" required value={prUrl} onChange={(e) => setPrUrl(e.target.value.trim())} placeholder="https://github.com/owner/repo/pull/123" className="cc-input" />
                      <p className="text-xs text-neutral-500 mt-1">Paste the public pull request link from GitHub. Links ending in /files, /commits, or /changes are accepted. GitHub account linking is optional; your connected wallet receives the reward after approval and merge.</p>
                      {data.demoMode && <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/5 p-4"><button type="button" className="text-xs text-amber-200 underline underline-offset-4" onClick={() => setPrUrl(project.repoUrl.replace(/\/$/, '') + '/pull/1')}>Use example demo PR</button><p className="mt-3 text-xs leading-6 text-amber-200/70">This PR does not need to exist. GitHub identity and merge are simulated; submitting still records a real {networkName} wallet transaction.</p></div>}
                    </div>
                    <div className="cc-field"><label htmlFor="reviewer-notes">Notes for reviewer <span className="text-neutral-600">(optional)</span></label><textarea id="reviewer-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe your changes and how you tested them…" className="cc-input" /></div>
                    {!canSubmit && <p className="text-xs leading-6 text-neutral-400">{opportunity.state !== 'Open' ? `This opportunity is ${opportunity.state.toLowerCase()} and no longer accepts submissions.` : deadlinePassed ? 'The submission deadline has passed.' : 'Checking the submission deadline…'}</p>}
                    <button type="submit" disabled={isSubmitting || !prUrl || !canSubmit} className="cc-btn cc-btn-primary w-full">{isSubmitting ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}<span>{isSubmitting ? 'Verifying PR…' : 'Submit to opportunity'}</span></button>
                  </form>}
          </section>
        </aside>
      </div>
    </div>
  )
}

export default function OpportunityDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="cc-page"><p className="cc-empty" role="status">Loading opportunity details…</p></div>}><OpportunityContent params={params} /></Suspense>
}
