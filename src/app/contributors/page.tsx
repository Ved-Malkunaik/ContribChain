'use client'

import { useState, useEffect } from 'react'

import { formatEther, parseEther } from 'viem'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ExternalLink, GitPullRequest, Wallet } from 'lucide-react'
import { useFeed, useIdentity } from '@/lib/use-platform'
import { getSubmissionPresentation } from '@/lib/submission-presentation'
import { IdentityPanel, FeedStatus } from '@/components/PlatformStatus'
import { SubmissionProgress } from '@/components/SubmissionProgress'
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui/AppUI'
import { GithubIcon } from '@/components/icons/GithubIcon'
import { currencySymbol, networkName } from '@/lib/contract'

export default function ContributorsHubPage() {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  const { data } = useFeed()
  const identity = useIdentity()
  const githubUser = identity.githubLinked ? identity.session?.githubUsername : undefined
  const userSubmissions = data.submissions.filter(s =>
    s.contributorAddress.toLowerCase() === address?.toLowerCase() ||
    (!!s.contributorUserId && s.contributorUserId === identity.session?.userId)
  )
  const paidSubmissions = userSubmissions.filter(s => s.status === 'Paid' && s.payoutTxHash)
  const earnedRewardsEth = formatEther(paidSubmissions.reduce((sum, s) => sum + parseEther(data.opportunities.find(o => o.id === s.opportunityId)?.rewardEth || '0'), 0n))
  const handleLinkGitHub = () => {
    if (identity.githubLinked) void identity.link()
    else document.getElementById('github-signin')?.click()
  }

  return (
    <div className="cc-page">
      <PageHeader eyebrow="Workspace / Contributor" title="Contributors hub." description="Every contribution counts. Follow your pull requests from the first review to the final reward." action={<Link href="/explore" className="cc-btn cc-btn-primary">Find opportunities <ArrowRight size={16} /></Link>} />
      <IdentityPanel />
      <FeedStatus />
      <form action="/api/auth/signin" method="get" className="hidden"><button id="github-signin">Sign in</button></form>

      {!mounted || !isConnected || !address ? (
        <EmptyState title="Your next chapter starts here." description="Connect your BridgeKey or wallet from the navigation to track your submissions and confirmed {networkName} rewards." action={<span className="cc-badge"><Wallet size={14} /> Wallet connection required</span>} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
            <div className="cc-card space-y-5">
              <div className="cc-inline text-neutral-400"><Wallet size={18} /><span className="cc-eyebrow">Your wallet</span></div>
              <p className="font-mono text-xl">{address.slice(0, 6)}...{address.slice(-4)}</p>
              <StatusBadge status="Connected">Wallet connected</StatusBadge>
            </div>
            <div className="cc-card space-y-5">
              <div className="cc-inline text-neutral-400"><GithubIcon className="h-[18px] w-[18px]" /><span className="cc-eyebrow">GitHub identity</span></div>
              <p className="text-xl font-semibold break-words">{githubUser ? `@${githubUser}` : 'GitHub link optional'}</p>
              {identity.linked
                ? <StatusBadge status="Verified"><CheckCircle2 size={13} /> Verified contributor</StatusBadge>
                : <button onClick={handleLinkGitHub} type="button" className="cc-btn cc-btn-secondary">{identity.githubLinked ? 'Link GitHub to wallet' : 'Link GitHub (optional)'} <ArrowRight size={14} /></button>}
            </div>
            <div className="cc-card space-y-5">
              <p className="cc-eyebrow">Confirmed rewards</p>
              <p className="text-4xl font-semibold tracking-tight">{earnedRewardsEth} <span className="text-base font-normal text-neutral-500">{currencySymbol}</span></p>
              <p className="text-xs leading-relaxed text-neutral-500">{paidSubmissions.length} confirmed {paidSubmissions.length === 1 ? 'payout' : 'payouts'} on {networkName}. Only released rewards count toward this balance.</p>
            </div>
          </div>

          <div className="cc-panel-header mb-5"><div><p className="cc-eyebrow mb-2">Your contribution history</p><h2 className="text-2xl font-semibold tracking-tight">My submissions</h2></div><span className="cc-badge">{userSubmissions.length} {userSubmissions.length === 1 ? 'contribution' : 'contributions'}</span></div>
          <div className="cc-list">
            {userSubmissions.map(submission => {
              const opportunity = data.opportunities.find(o => o.id === submission.opportunityId)
              const presentation = getSubmissionPresentation(submission, opportunity)
              return (
                <article key={submission.id} className="cc-card space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div className="cc-inline"><span className="cc-badge"><GitPullRequest size={13} /> PR #{submission.prNumber}</span><span className="text-xs text-neutral-500">Submitted {new Date(submission.createdAt).toLocaleDateString()}</span>{submission.demo && <span className="cc-badge" data-tone="warning">Simulated PR · demo</span>}</div><StatusBadge status={presentation.status} /></div>
                  <div><p className="cc-eyebrow mb-2">{opportunity?.title || `Opportunity ${submission.opportunityId}`}</p><h3 className="text-xl font-semibold tracking-tight">{submission.prTitle}</h3></div>
                  <SubmissionProgress submission={presentation.status === 'Paid' ? { ...submission, status: 'Paid' } : submission} opportunity={opportunity} />
                  {presentation.status === 'Paid' && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4 space-y-2"><p className="text-sm font-semibold text-emerald-300">{presentation.rewardEth ?? '—'} {currencySymbol} received · confirmed on {networkName}</p><p className="text-xs text-neutral-400 break-all">Recipient <span className="font-mono">{presentation.recipient}</span></p>{presentation.receiptUrl && <a href={presentation.receiptUrl} target="_blank" rel="noreferrer" className="cc-btn cc-btn-secondary">View payment receipt on MSTScan <ExternalLink size={14} /></a>}</div>}
                  <div className="cc-inline border-t border-white/10 pt-5">
                    <Link href={`/opportunities/${submission.opportunityId}`} className="cc-btn cc-btn-secondary">View opportunity <ArrowRight size={14} /></Link>
                    {!submission.demo && submission.githubPrUrl && <a href={submission.githubPrUrl} target="_blank" rel="noreferrer" className="cc-btn cc-btn-ghost">View pull request <ExternalLink size={14} /></a>}
                  </div>
                </article>
              )
            })}
            {userSubmissions.length === 0 && <EmptyState title="Great projects need your perspective." description="Find an opportunity that fits your skills. Your first submitted pull request will appear here." action={<Link href="/explore" className="cc-btn cc-btn-primary">Find your first opportunity <ArrowRight size={16} /></Link>} />}
          </div>
        </>
      )}
    </div>
  )
}
