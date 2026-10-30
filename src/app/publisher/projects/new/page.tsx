'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, useTransaction } from '@/lib/use-platform'
import { IdentityPanel, FeedStatus, TransactionStatus } from '@/components/PlatformStatus'

import { useAccount } from 'wagmi'
import { contractAddress } from '@/lib/contract'
import {
  ArrowLeft,
  Globe,
  Video,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { GithubIcon } from '@/components/icons/GithubIcon'
import { PageHeader } from '@/components/ui/AppUI'

export default function NewProjectPage() {
  const router = useRouter()
  const tx=useTransaction()
  const { isConnected, address } = useAccount()

  const [formData, setFormData] = useState({
    name: '',
    shortDescription: '',
    detailedDescription: '',
    category: 'DeFi',
    technologies: '',
    repoUrl: '',
    liveDappUrl: '',
    demoVideoUrl: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  const registered=success || tx.confirmedFunction==='registerProject'
  useEffect(()=>{
    if(!registered) return
    const timer=setTimeout(()=>router.push('/publisher'),1200)
    return ()=>clearTimeout(timer)
  },[registered,router])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.name.trim()) errs.name = 'Project name is required'
    if (!formData.shortDescription.trim())
      errs.shortDescription = 'Short description is required'
    if (!formData.detailedDescription.trim())
      errs.detailedDescription = 'Detailed description is required'
    if (!formData.category.trim()) errs.category = 'Category is required'
    if (!formData.technologies.trim())
      errs.technologies = 'At least one technology is required'

    if (!formData.repoUrl.trim()) {
      errs.repoUrl = 'GitHub repository URL is required'
    } else if (!formData.repoUrl.startsWith('https://github.com/')) {
      errs.repoUrl = 'Repository must be a valid public GitHub URL (https://github.com/owner/repo)'
    }

    if (!formData.liveDappUrl.trim()) {
      errs.liveDappUrl = 'Live dApp URL is required for this MVP'
    } else if (
      !formData.liveDappUrl.startsWith('https://') &&
      !formData.liveDappUrl.startsWith('http://')
    ) {
      errs.liveDappUrl = 'Must be a valid web URL'
    }

    if (
      formData.demoVideoUrl &&
      !formData.demoVideoUrl.startsWith('https://') &&
      !formData.demoVideoUrl.startsWith('http://')
    ) {
      errs.demoVideoUrl = 'Must be a valid URL'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      if (contractAddress) {
        await tx.send('projects/prepare', formData)
      } else {
        await api('projects/prepare', formData, address)
      }
      setSuccess(true)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to register project')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="cc-page" style={{ maxWidth: 1000 }}>
      <Link href="/publisher" className="cc-btn cc-btn-ghost mb-6"><ArrowLeft size={15} /> Back to publisher hub</Link>
      <PageHeader eyebrow="Publisher / New project" title="Build something open." description="Give your project a home on ContribChain. Share what you’re building, then invite contributors to move it forward." />
      <IdentityPanel /><FeedStatus /><TransactionStatus tx={tx} />

      {mounted && !isConnected && <div className="cc-panel mb-6 flex items-start gap-3 text-sm text-neutral-400"><AlertCircle size={18} className="shrink-0 text-amber-300" /><p><span className="font-medium text-white">Connect your wallet.</span> Use the navigation to connect BridgeKey or your wallet and anchor the project to your publisher address on MST Testnet.</p></div>}

      {registered ? (
        <div className="cc-panel py-12 text-center space-y-4" role="status"><CheckCircle2 className="mx-auto text-emerald-300" size={40} /><h2 className="text-2xl font-semibold">Your project is registered.</h2><p className="text-sm text-neutral-400">Returning to your publisher hub. You’re ready to create your first funded opportunity.</p><Link href="/publisher" className="cc-btn cc-btn-primary">Go to publisher hub</Link></div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="cc-panel space-y-6" aria-labelledby="project-details-heading">
            <div className="cc-panel-header"><div><p className="cc-eyebrow mb-2">01 / The idea</p><h2 id="project-details-heading" className="text-xl font-semibold">Project details</h2></div><span className="text-xs text-neutral-500">* Required fields</span></div>
            <div className="cc-field"><label htmlFor="project-name">Project name *</label><input id="project-name" className="cc-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. AetherVault" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'error-name' : undefined} />{errors.name && <span id="error-name" className="text-xs text-rose-300">{errors.name}</span>}</div>
            <div className="cc-form-grid">
              <div className="cc-field"><label htmlFor="project-category">Category *</label><select id="project-category" className="cc-input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}><option value="DeFi">DeFi</option><option value="Infrastructure">Infrastructure</option><option value="Gaming">Gaming / Metaverse</option><option value="Identity / ZK">Identity / ZK</option><option value="Tooling">Developer tooling</option><option value="NFT / Social">NFT / Social</option></select></div>
              <div className="cc-field"><label htmlFor="project-technologies">Technologies *</label><input id="project-technologies" className="cc-input" value={formData.technologies} onChange={e => setFormData({ ...formData, technologies: e.target.value })} placeholder="Solidity, React, TypeScript" aria-invalid={!!errors.technologies} aria-describedby={errors.technologies ? 'error-technologies' : 'technologies-help'} /><p id="technologies-help">Separate technologies with commas.</p>{errors.technologies && <span id="error-technologies" className="text-xs text-rose-300">{errors.technologies}</span>}</div>
            </div>
            <div className="cc-field"><label htmlFor="project-summary">One sentence summary *</label><input id="project-summary" className="cc-input" value={formData.shortDescription} onChange={e => setFormData({ ...formData, shortDescription: e.target.value })} placeholder="What does your project make possible?" aria-invalid={!!errors.shortDescription} aria-describedby={errors.shortDescription ? 'error-summary' : undefined} />{errors.shortDescription && <span id="error-summary" className="text-xs text-rose-300">{errors.shortDescription}</span>}</div>
            <div className="cc-field"><label htmlFor="project-description">Tell contributors about your project *</label><textarea id="project-description" className="cc-input" rows={5} value={formData.detailedDescription} onChange={e => setFormData({ ...formData, detailedDescription: e.target.value })} placeholder="Describe the problem, your approach and where you want to take it." aria-invalid={!!errors.detailedDescription} aria-describedby={errors.detailedDescription ? 'error-description' : undefined} />{errors.detailedDescription && <span id="error-description" className="text-xs text-rose-300">{errors.detailedDescription}</span>}</div>
          </section>

          <section className="cc-panel space-y-6" aria-labelledby="project-links-heading">
            <div><p className="cc-eyebrow mb-2">02 / In the open</p><h2 id="project-links-heading" className="text-xl font-semibold">Links &amp; deployment</h2><p className="mt-2 text-sm text-neutral-500">Help contributors explore the code and experience your dApp.</p></div>
            <div className="cc-field">
              <label htmlFor="project-repository" className="cc-inline"><GithubIcon className="h-4 w-4" /> Public GitHub repository *</label>
              <input id="project-repository" type="url" className="cc-input" value={formData.repoUrl} onChange={e => setFormData({ ...formData, repoUrl: e.target.value })} placeholder="https://github.com/owner/repository" aria-invalid={!!errors.repoUrl} aria-describedby={errors.repoUrl ? 'error-repository' : undefined} />
              <p className="text-xs text-neutral-500 mt-1">Any public GitHub repository can be registered with your connected wallet. GitHub account linking is optional.</p>
              {errors.repoUrl && <span id="error-repository" className="text-xs text-rose-300">{errors.repoUrl}</span>}
            </div>
            <div className="cc-field"><label htmlFor="project-live-url" className="cc-inline"><Globe size={16} /> Live dApp URL *</label><input id="project-live-url" type="url" className="cc-input" value={formData.liveDappUrl} onChange={e => setFormData({ ...formData, liveDappUrl: e.target.value })} placeholder="https://your-project.xyz" aria-invalid={!!errors.liveDappUrl} aria-describedby={errors.liveDappUrl ? 'error-live-url' : undefined} />{errors.liveDappUrl && <span id="error-live-url" className="text-xs text-rose-300">{errors.liveDappUrl}</span>}</div>
            <div className="cc-field"><label htmlFor="project-demo-url" className="cc-inline"><Video size={16} /> Demo video <span className="text-neutral-600">optional</span></label><input id="project-demo-url" type="url" className="cc-input" value={formData.demoVideoUrl} onChange={e => setFormData({ ...formData, demoVideoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." aria-invalid={!!errors.demoVideoUrl} aria-describedby={errors.demoVideoUrl ? 'error-demo-url' : undefined} />{errors.demoVideoUrl && <span id="error-demo-url" className="text-xs text-rose-300">{errors.demoVideoUrl}</span>}</div>
          </section>

          {submitError && <div role="alert" className="cc-panel flex items-start gap-3 border-rose-400/25"><AlertCircle className="shrink-0 text-rose-300" size={18} /><div><h3 className="text-sm font-semibold">Registration needs your attention</h3><p className="mt-2 text-sm text-neutral-400">{submitError}</p></div></div>}
          <div className="flex flex-wrap items-center justify-between gap-5 border-t border-white/10 pt-6"><p className="max-w-sm text-xs leading-relaxed text-neutral-500">Project metadata is registered with your connected publisher wallet address. GitHub account linking is optional.</p><div className="cc-inline"><Link href="/publisher" className="cc-btn cc-btn-secondary">Cancel</Link><button type="submit" disabled={isSubmitting || tx.busy} className="cc-btn cc-btn-primary">{tx.busy ? 'Confirming…' : isSubmitting ? 'Registering…' : 'Register project'}</button></div></div>
        </form>
      )}
    </div>
  )
}
