'use client'

import { use, useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { formatEther, parseEther } from 'viem'
import { useAccount } from 'wagmi'
import { currencySymbol, explorerUrl, isMainnet } from '@/lib/contract'
import { ExternalLink, Globe, Video, Calendar, ChevronRight, Plus, ArrowUpRight } from 'lucide-react'
import { useFeed } from '@/lib/use-platform'
import { FeedStatus } from '@/components/PlatformStatus'
import { PageHeader, StatusBadge, EmptyState } from '@/components/ui/AppUI'
import { GithubIcon } from '@/components/icons/GithubIcon'

function parseList(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter(Boolean).map(String)
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String)
    } catch { }
    return val.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function ProjectContent({ params }: { params: Promise<{ id: string }> }) {
  const { data, isLoading } = useFeed()
  const projectId = use(params).id
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const project = data.projects.find((p) =>
    p.id === projectId ||
    p.repoId === projectId ||
    (!!p.onChainId && String(p.onChainId) === projectId)
  )
  const opportunities = data.opportunities.filter((o) => o.projectId === projectId || (project && o.projectId === project.id))
  const isPublisher = mounted && !!address && !!project && address.toLowerCase() === project.publisherAddress.toLowerCase()
  if (isLoading) return <div className="cc-page"><p className="cc-empty" role="status">Loading project…</p></div>
  if (!project) return <div className="cc-page"><FeedStatus /><EmptyState title="Project not found" description="This project does not exist or has not been synced yet." action={<Link href="/explore" className="cc-btn cc-btn-primary">Return to explore</Link>} /></div>
  const totalEscrow = formatEther(
    opportunities.reduce((sum, o) => {
      try {
        return sum + parseEther(o.remainingEscrowEth || o.rewardEth || '0')
      } catch {
        return sum
      }
    }, 0n)
  )
  const techList = parseList(project.technologies)

  return (
    <div className="cc-page">
      <FeedStatus />
      <nav aria-label="Breadcrumb" className="mb-8 flex min-w-0 items-center gap-2 text-xs text-neutral-500"><Link href="/explore" className="transition-colors hover:text-white">Explore</Link><ChevronRight size={13} /><span className="truncate text-neutral-300">{project.name}</span></nav>
      <PageHeader eyebrow={`${project.category} · PROJECT ${project.onChainId ? `#${project.onChainId}` : 'AWAITING SYNC'}`} title={project.name} description={project.shortDescription}
        action={<a href={project.liveDappUrl} target="_blank" rel="noopener noreferrer" className="cc-btn cc-btn-primary"><Globe size={16} />Open dApp<ArrowUpRight size={15} /></a>} />
      <div className="mb-10 grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <section className="cc-panel min-w-0">
          <p className="cc-eyebrow mb-5">THE PROJECT</p><h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Built in the open.</h2>
          <p className="whitespace-pre-line text-sm leading-8 text-neutral-400">{project.detailedDescription}</p>
          <div className="mt-7 flex flex-wrap gap-2">{techList.map((tech) => <span key={tech} className="cc-badge !font-mono">{tech}</span>)}</div>
          <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="cc-btn cc-btn-secondary"><GithubIcon className="h-4 w-4" />GitHub repository<ExternalLink size={13} /></a>
            {project.demoVideoUrl && <a href={project.demoVideoUrl} target="_blank" rel="noopener noreferrer" className="cc-btn cc-btn-ghost"><Video size={16} />Watch demo<ExternalLink size={13} /></a>}
          </div>
        </section>
        <aside className="cc-panel min-w-0">
          <p className="cc-eyebrow mb-5">ON-CHAIN SNAPSHOT</p><p className="mb-1 text-sm text-neutral-400">Remaining opportunity escrow</p>
          <p className="mb-7 break-words text-4xl font-medium tracking-tight text-white">{totalEscrow} <span className="text-lg text-neutral-500">{currencySymbol}</span></p>
          <dl className="space-y-5 border-t border-white/10 pt-6 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-neutral-500">Opportunities</dt><dd className="text-white">{opportunities.length}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-neutral-500">Listed</dt><dd className="text-neutral-300">{new Date(project.createdAt).toLocaleDateString()}</dd></div>
            <div><dt className="mb-2 text-neutral-500">Publisher wallet</dt><dd className="break-all font-mono text-xs leading-6 text-neutral-300">{project.publisherAddress}</dd></div>
          </dl>
          {isPublisher ? (
            <Link href={`/publisher/projects/${project.id}/opportunities/new`} className="cc-btn cc-btn-secondary mt-7 w-full"><Plus size={16} />Create opportunity</Link>
          ) : (
            <Link href="/publisher/projects/new" className="cc-btn cc-btn-secondary mt-7 w-full"><Plus size={16} />Publish your independent project</Link>
          )}
        </aside>
      </div>
      <section>
        <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="cc-eyebrow mb-3">MAKE YOUR CONTRIBUTION</p><h2 className="text-2xl font-semibold tracking-tight text-white">Opportunities <span className="ml-2 text-base text-neutral-500">{opportunities.length}</span></h2><p className="mt-2 text-sm leading-6 text-neutral-400">Find a task, review its criteria, and bring your skills.</p></div>
          {isPublisher ? (
            <Link href={`/publisher/projects/${project.id}/opportunities/new`} className="cc-btn cc-btn-primary"><Plus size={16} />Fund opportunity</Link>
          ) : (
            <Link href="/publisher/projects/new" className="cc-btn cc-btn-secondary"><Plus size={16} />Publish a project</Link>
          )}
        </div>
        <div className="space-y-4">
          {opportunities.map((opp) => <article key={opp.id} className="cc-card flex min-w-0 flex-col gap-7 !p-6 md:!flex-row md:items-center sm:!p-8">
            <div className="min-w-0 flex-1">
              <div className="mb-4 flex flex-wrap gap-2"><span className="cc-badge">{opp.taskType}</span><span className="cc-badge">{opp.difficulty}</span><StatusBadge status={opp.state} /></div>
              <h3 className="text-xl font-semibold tracking-tight text-white">{opp.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-7 text-neutral-400">{opp.description}</p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-2"><Calendar size={14} />Due {new Date(opp.deadline).toLocaleDateString()}</span>
                <span>{opp.submissionsCount || 0} submissions</span>
                {opp.txHash && (
                  <a
                    href={`${explorerUrl}/tx/${opp.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200 underline font-mono text-[11px]"
                  >
                    Escrow on MSTScan: {opp.txHash.slice(0, 8)}…{opp.txHash.slice(-4)} <ArrowUpRight size={11} />
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-5 border-t border-white/10 pt-6 md:w-48 md:flex-col md:items-stretch md:border-l md:border-t-0 md:pl-7 md:pt-0">
              <div><p className="mb-1 text-xs text-neutral-500">Bounty reward</p><p className="text-2xl font-medium text-white">{opp.rewardEth} <span className="text-sm text-neutral-500">{currencySymbol}</span></p></div>
              <Link href={`/opportunities/${opp.id}`} className="cc-btn cc-btn-secondary">View task<ArrowUpRight size={15} /></Link>
            </div>
          </article>)}
          {opportunities.length === 0 && <EmptyState title="The next opportunity starts here" description={isPublisher ? "No funded opportunities are listed for your project yet. Create a task and fund its escrow." : "No funded opportunities are listed for this project yet. External developers can contribute once the publisher funds tasks."} action={isPublisher ? <Link href={`/publisher/projects/${project.id}/opportunities/new`} className="cc-btn cc-btn-secondary">Create opportunity<Plus size={15} /></Link> : <Link href="/publisher/projects/new" className="cc-btn cc-btn-secondary">Publish your own project<Plus size={15} /></Link>} />}
        </div>
      </section>
    </div>
  )
}

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="cc-page"><p className="cc-empty" role="status">Loading project details…</p></div>}><ProjectContent params={params} /></Suspense>
}
