'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatEther, parseEther } from 'viem'
import { Search, FolderGit2, ArrowRight, ArrowUpRight } from 'lucide-react'
import { useFeed } from '@/lib/use-platform'
import { FeedStatus } from '@/components/PlatformStatus'
import { PageHeader, EmptyState } from '@/components/ui/AppUI'

export default function ExplorePage() {
  const { data, isLoading } = useFeed()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [technology, setTechnology] = useState('All')
  const categories = useMemo(() => ['All', ...Array.from(new Set(data.projects.map((p) => p.category)))], [data.projects])
  const technologies = useMemo(() => Array.from(new Set(data.projects.flatMap((p) => p.technologies))).sort(), [data.projects])
  const filteredProjects = useMemo(() => data.projects.filter((project) => {
    const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory
    const query = searchQuery.toLowerCase()
    const matchesSearch = project.name.toLowerCase().includes(query)
      || project.shortDescription.toLowerCase().includes(query)
      || project.technologies.some((t) => t.toLowerCase().includes(query))
    return matchesCategory && matchesSearch && (technology === 'All' || project.technologies.includes(technology))
  }), [searchQuery, selectedCategory, technology, data.projects])
  const resetFilters = () => { setSearchQuery(''); setSelectedCategory('All'); setTechnology('All') }

  return (
    <div className="cc-page">
      <FeedStatus />
      <PageHeader eyebrow="THE OPEN SOURCE OPPORTUNITY BOARD · SEPOLIA" title="Find your next contribution."
        description="Discover open-source dApps, find work that fits your skills, and earn from funded opportunities."
        action={<Link href="/publisher/projects/new" className="cc-btn cc-btn-primary">List your dApp <ArrowUpRight size={16} /></Link>} />
      <section className="cc-panel mb-10" aria-label="Filter projects">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="cc-field min-w-0 flex-1">
            <label htmlFor="project-search">Find a project</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input id="project-search" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search projects, skills, or keywords" className="cc-input !pl-11" />
            </div>
          </div>
          <div className="cc-field w-full lg:w-56">
            <label htmlFor="technology-filter">Technology</label>
            <select id="technology-filter" className="cc-input" value={technology} onChange={(e) => setTechnology(e.target.value)}>
              <option value="All">All technologies</option>{technologies.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Project categories">
          {categories.map((cat) => <button key={cat} type="button" onClick={() => setSelectedCategory(cat)} aria-pressed={selectedCategory === cat} data-active={selectedCategory === cat} className="cc-tab">{cat}</button>)}
        </div>
      </section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-white">Explore projects <span className="ml-2 text-sm font-normal text-neutral-500">{filteredProjects.length}</span></h2>
        <p className="text-xs text-neutral-500">Escrow balances reflect confirmed Sepolia activity.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {isLoading && <div className="cc-empty col-span-full" role="status"><p>Loading projects from Sepolia…</p></div>}
        {filteredProjects.map((project) => {
          const projectOpps = data.opportunities.filter((o) => o.projectId === project.id)
          const totalBounty = formatEther(projectOpps.reduce((sum, o) => sum + parseEther(o.remainingEscrowEth), 0n))
          return <article key={project.id} className="cc-card group flex min-w-0 flex-col !p-7 sm:!p-8">
            <div className="mb-7 flex items-center justify-between gap-4"><span className="cc-badge">{project.category}</span><ArrowUpRight size={20} className="text-neutral-600 transition-colors group-hover:text-white" /></div>
            <h3 className="mb-3 text-2xl font-semibold tracking-tight text-white">{project.name}</h3>
            <p className="mb-5 line-clamp-2 text-sm leading-7 text-neutral-400">{project.shortDescription}</p>
            <div className="mb-8 flex flex-wrap gap-2">{project.technologies.map((tech) => <span key={tech} className="cc-badge !font-mono">{tech}</span>)}</div>
            <div className="mt-auto border-t border-white/10 pt-6">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div><p className="mb-1 text-xs text-neutral-500">Available escrow</p><p className="text-2xl font-medium tracking-tight text-white">{totalBounty} <span className="text-sm text-neutral-500">ETH</span></p></div>
                <span className="inline-flex items-center gap-2 text-xs text-neutral-400"><FolderGit2 size={15} />{projectOpps.length} {projectOpps.length===1?'opportunity':'opportunities'}</span>
              </div>
              <Link href={`/projects/${project.id}`} className="cc-btn cc-btn-secondary w-full !justify-between">Explore project <ArrowRight size={16} /></Link>
            </div>
          </article>
        })}
        {!isLoading && filteredProjects.length === 0 && <div className="col-span-full"><EmptyState title="No projects found" description="Try a different keyword, category, or technology to find your next contribution." action={<button type="button" className="cc-btn cc-btn-secondary" onClick={resetFilters}>Clear filters</button>} /></div>}
      </div>
    </div>
  )
}
