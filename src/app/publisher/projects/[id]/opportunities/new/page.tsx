'use client'

import { use, useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFeed, useTransaction } from '@/lib/use-platform'
import { IdentityPanel, FeedStatus, TransactionStatus } from '@/components/PlatformStatus'

import { useAccount } from 'wagmi'
import { parseEther } from 'viem'
import { PageHeader } from '@/components/ui/AppUI'
import {
  ArrowLeft,
  Coins,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Copy,
  Check,
} from 'lucide-react'
import { currencySymbol, explorerUrl, networkName } from '@/lib/contract'

function NewOpportunityContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const projectId = resolvedParams.id
  const router = useRouter()
  const tx = useTransaction()
  const { data } = useFeed()
  const { isConnected, address } = useAccount()

  const project = data.projects.find((p) => p.id === projectId || p.repoId === projectId || (!!p.onChainId && String(p.onChainId) === projectId))

  const [formData, setFormData] = useState({
    title: '',
    taskType: 'feature',
    description: '',
    acceptanceCriteria: '',
    difficulty: 'intermediate',
    requiredSkills: '',
    rewardEth: '0.05',
    deadlineDays: '14',
    issueUrl: '',
  })

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedTx, setCopiedTx] = useState(false)
  const funded = tx.confirmedFor('createOpportunity', projectId)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.title.trim()) errs.title = 'Title is required'
    if (!formData.description.trim()) errs.description = 'Task description is required'
    if (!formData.acceptanceCriteria.trim())
      errs.acceptanceCriteria = 'Acceptance criteria is required'
    if (!formData.requiredSkills.trim())
      errs.requiredSkills = 'At least one required skill is required'

    try {
      if (!/^\d+(\.\d{1,18})?$/.test(formData.rewardEth) || parseEther(formData.rewardEth) <= 0n) throw new Error()
    } catch {
      errs.rewardEth = `Enter positive ${currencySymbol} with at most 18 decimal places`
    }

    const days = parseInt(formData.deadlineDays, 10)
    if (isNaN(days) || days < 1) {
      errs.deadlineDays = 'Deadline must be at least 1 day in the future'
    }

    if (
      formData.issueUrl &&
      !formData.issueUrl.startsWith('https://github.com/')
    ) {
      errs.issueUrl = 'Issue URL must be a valid GitHub issue link'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      await tx.send('opportunities/prepare', { ...formData, projectId })
    } catch {
      /* TransactionStatus displays the actionable error. */
    } finally {
      setIsSubmitting(false)
    }
  }

  const estimatedGasEth = 'Calculated before wallet confirmation'

  return (
    <div className="cc-page" style={{ maxWidth: 1000 }}>
      <Link href={'/projects/' + projectId} className="cc-btn cc-btn-ghost mb-6">
        <ArrowLeft size={15} /> Back to {project?.name || 'project'}
      </Link>
      <PageHeader
        eyebrow="Publisher / New opportunity"
        title="Make the next move."
        description="Define a meaningful task, set a fair reward in {currencySymbol} and give your next contributor everything they need to begin."
      />
      <IdentityPanel />
      <FeedStatus />
      <TransactionStatus tx={tx} />
      <div className="cc-inline mb-6">
        <span className="cc-badge">{project?.name || 'Selected project'}</span>
        <span className="cc-badge">{networkName}</span>
      </div>
      {mounted && !isConnected && (
        <div className="cc-panel mb-6 flex items-start gap-3 text-sm text-neutral-400">
          <AlertCircle size={18} className="shrink-0 text-amber-300" />
          <p>
            <span className="font-medium text-white">Connect your BridgeKey wallet.</span> You’ll confirm the bounty deposit in your wallet before the opportunity is funded on {networkName}.
          </p>
        </div>
      )}

      {mounted && address && project && address.toLowerCase() !== project.publisherAddress.toLowerCase() ? (
        <div className="cc-panel p-8 text-center space-y-4" role="alert">
          <AlertCircle className="mx-auto text-amber-400" size={44} />
          <h2 className="text-xl font-semibold text-white">Publisher Permission Required</h2>
          <p className="text-sm text-neutral-400 max-w-md mx-auto">
            Only the publisher of <strong>{project.name}</strong> ({project.publisherAddress.slice(0, 6)}...{project.publisherAddress.slice(-4)}) can create and fund opportunities for it.
          </p>
          <p className="text-xs text-neutral-500">
            Connected as: <span className="font-mono text-neutral-300">{address}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-3">
            <Link href="/publisher/projects/new" className="cc-btn cc-btn-primary">
              Publish your independent project
            </Link>
            <Link href={`/projects/${projectId}`} className="cc-btn cc-btn-secondary">
              View opportunities to contribute
            </Link>
          </div>
        </div>
      ) : funded ? (
        <div className="cc-panel py-10 px-6 max-w-xl mx-auto text-center space-y-6 animate-in fade-in duration-300" role="status">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(16,185,129,0.15)]">
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Opportunity Live & Escrow Funded!</h2>
            <p className="text-sm text-neutral-400 max-w-md mx-auto">
              Your bounty of <strong className="text-white font-mono">{formData.rewardEth} {currencySymbol}</strong> is safely locked on-chain in the ContribChainEscrow contract on {networkName}.
            </p>
          </div>

          {/* On-Chain Transaction Receipt */}
          <div className="p-4 rounded-2xl bg-black/50 border border-white/10 text-left space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-medium text-white flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                {networkName} Transaction Receipt
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Confirmed on-chain
              </span>
            </div>

            <div>
              <p className="text-[11px] text-neutral-500 mb-1">Transaction Hash</p>
              <p className="font-mono text-xs text-neutral-200 break-all bg-white/[0.03] p-2.5 rounded-xl border border-white/5 select-all">
                {tx.hash || `Transaction confirmed on ${networkName}`}
              </p>
            </div>

            {tx.hash && (
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={`${explorerUrl}/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 font-medium underline"
                >
                  <span>View on MSTScan Explorer</span>
                  <ArrowUpRight size={13} />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    if (tx.hash) {
                      navigator.clipboard.writeText(tx.hash)
                      setCopiedTx(true)
                      setTimeout(() => setCopiedTx(false), 2000)
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {copiedTx ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedTx ? 'Copied!' : 'Copy Hash'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href={'/projects/' + projectId} className="cc-btn cc-btn-primary">
              Return to Project
            </Link>
            {tx.hash && (
              <a
                href={`${explorerUrl}/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="cc-btn cc-btn-secondary"
              >
                <span>Open in MSTScan</span>
                <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="cc-panel space-y-6" aria-labelledby="task-details-heading">
            <div className="cc-panel-header">
              <div>
                <p className="cc-eyebrow mb-2">01 / The contribution</p>
                <h2 id="task-details-heading" className="text-xl font-semibold">
                  Define the task
                </h2>
              </div>
              <span className="text-xs text-neutral-500">* Required fields</span>
            </div>
            <div className="cc-field">
              <label htmlFor="opportunity-title">Opportunity title *</label>
              <input
                id="opportunity-title"
                className="cc-input"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Implement EIP-712 permit verification"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'error-title' : undefined}
              />
              {errors.title && <span id="error-title" className="text-xs text-rose-300">{errors.title}</span>}
            </div>
            <div className="cc-form-grid">
              <div className="cc-field">
                <label htmlFor="opportunity-type">Task type *</label>
                <select
                  id="opportunity-type"
                  className="cc-input"
                  value={formData.taskType}
                  onChange={e => setFormData({ ...formData, taskType: e.target.value })}
                >
                  <option value="feature">Feature</option>
                  <option value="bug">Bug fix</option>
                  <option value="documentation">Documentation</option>
                  <option value="optimization">Optimization</option>
                  <option value="security">Security</option>
                </select>
              </div>
              <div className="cc-field">
                <label htmlFor="opportunity-difficulty">Difficulty *</label>
                <select
                  id="opportunity-difficulty"
                  className="cc-input"
                  value={formData.difficulty}
                  onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="cc-field">
              <label htmlFor="opportunity-description">Task description *</label>
              <textarea
                id="opportunity-description"
                className="cc-input"
                rows={4}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Explain the technical scope, context and what a successful contribution looks like."
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'error-description' : undefined}
              />
              {errors.description && <span id="error-description" className="text-xs text-rose-300">{errors.description}</span>}
            </div>
            <div className="cc-field">
              <label htmlFor="opportunity-criteria">Acceptance criteria *</label>
              <textarea
                id="opportunity-criteria"
                className="cc-input"
                rows={4}
                value={formData.acceptanceCriteria}
                onChange={e => setFormData({ ...formData, acceptanceCriteria: e.target.value })}
                placeholder={'Include unit tests\nPass continuous integration\nMerge into the repository main branch'}
                aria-invalid={!!errors.acceptanceCriteria}
                aria-describedby={errors.acceptanceCriteria ? 'error-criteria' : 'criteria-help'}
              />
              <p id="criteria-help">One criterion per line. Be specific about what you’ll review.</p>
              {errors.acceptanceCriteria && <span id="error-criteria" className="text-xs text-rose-300">{errors.acceptanceCriteria}</span>}
            </div>
            <div className="cc-form-grid">
              <div className="cc-field">
                <label htmlFor="opportunity-skills">Required skills *</label>
                <input
                  id="opportunity-skills"
                  className="cc-input"
                  value={formData.requiredSkills}
                  onChange={e => setFormData({ ...formData, requiredSkills: e.target.value })}
                  placeholder="Solidity, TypeScript"
                  aria-invalid={!!errors.requiredSkills}
                  aria-describedby={errors.requiredSkills ? 'error-skills' : 'skills-help'}
                />
                <p id="skills-help">Separate skills with commas.</p>
                {errors.requiredSkills && <span id="error-skills" className="text-xs text-rose-300">{errors.requiredSkills}</span>}
              </div>
              <div className="cc-field">
                <label htmlFor="opportunity-issue">
                  GitHub issue <span className="text-neutral-600">optional</span>
                </label>
                <input
                  id="opportunity-issue"
                  type="url"
                  className="cc-input"
                  value={formData.issueUrl}
                  onChange={e => setFormData({ ...formData, issueUrl: e.target.value })}
                  placeholder="https://github.com/owner/repo/issues/42"
                  aria-invalid={!!errors.issueUrl}
                  aria-describedby={errors.issueUrl ? 'error-issue' : undefined}
                />
                {errors.issueUrl && <span id="error-issue" className="text-xs text-rose-300">{errors.issueUrl}</span>}
              </div>
            </div>
          </section>

          <section className="cc-panel space-y-6" aria-labelledby="funding-heading">
            <div>
              <p className="cc-eyebrow mb-2">02 / The reward</p>
              <h2 id="funding-heading" className="text-xl font-semibold">
                Funding &amp; timeline
              </h2>
              <p className="mt-2 text-sm text-neutral-500">Your exact bounty is locked in the smart contract when the transaction confirms.</p>
            </div>
            <div className="cc-form-grid">
              <div className="cc-field">
                <label htmlFor="opportunity-reward">Bounty reward ({currencySymbol}) *</label>
                <input
                  id="opportunity-reward"
                  type="number"
                  step="0.001"
                  min="0.001"
                  className="cc-input font-mono"
                  value={formData.rewardEth}
                  onChange={e => setFormData({ ...formData, rewardEth: e.target.value })}
                  aria-invalid={!!errors.rewardEth}
                  aria-describedby={errors.rewardEth ? 'error-reward' : undefined}
                />
                {errors.rewardEth && <span id="error-reward" className="text-xs text-rose-300">{errors.rewardEth}</span>}
              </div>
              <div className="cc-field">
                <label htmlFor="opportunity-deadline">Deadline (days from now) *</label>
                <input
                  id="opportunity-deadline"
                  type="number"
                  min="1"
                  max="90"
                  className="cc-input"
                  value={formData.deadlineDays}
                  onChange={e => setFormData({ ...formData, deadlineDays: e.target.value })}
                  aria-invalid={!!errors.deadlineDays}
                  aria-describedby={errors.deadlineDays ? 'error-deadline' : undefined}
                />
                {errors.deadlineDays && <span id="error-deadline" className="text-xs text-rose-300">{errors.deadlineDays}</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-5">
              <p className="cc-inline text-sm font-medium">
                <ShieldCheck size={17} /> Escrow at a glance
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-neutral-500">Deposit</p>
                  <p className="mt-2 text-xl font-semibold">
                    {formData.rewardEth || '0'} <span className="text-sm font-normal text-neutral-500">{currencySymbol}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Network fee</p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">{estimatedGasEth}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Refund eligibility</p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">After the deadline, if no winner is approved</p>
                </div>
              </div>
              <p className="border-t border-white/10 pt-4 text-xs leading-relaxed text-neutral-500">
                Approving a winner reserves the reward for that contributor. {data.demoMode ? 'After simulating the demo PR merge, confirm the real {networkName} payout in your wallet.' : 'After their PR is merged, confirm the payout in your wallet.'} Once a winner is approved, the reward cannot be refunded.
              </p>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-5 border-t border-white/10 pt-6">
            <p className="max-w-sm text-xs leading-relaxed text-neutral-500">
              Confirming in your wallet transfers the bounty into real {currencySymbol} escrow on {networkName}.
            </p>
            <div className="cc-inline">
              <Link href={'/projects/' + projectId} className="cc-btn cc-btn-secondary">
                Cancel
              </Link>
              <button type="submit" disabled={isSubmitting || tx.busy} className="cc-btn cc-btn-primary">
                <Coins size={16} />
                {isSubmitting || tx.busy ? 'Confirming escrow…' : 'Fund escrow & create'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

export default function NewOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="cc-page text-neutral-400" role="status">Loading opportunity creator…</div>}>
      <NewOpportunityContent params={params} />
    </Suspense>
  )
}
