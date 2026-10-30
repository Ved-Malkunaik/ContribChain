import { formatEther, parseEther } from 'viem'
import { bountyAbi, contractAddress } from '../contract'
import { chainClient, chainConfig, reconcile } from './chain'
import { db } from './db'
import { refreshDuePulls } from './github'
import { demoMode } from './auth'
import type { Project, Opportunity, Submission } from '@/types'

export async function feed() {
  const configured = Boolean(contractAddress)
  const empty = {
    projects: [] as Project[],
    opportunities: [] as Opportunity[],
    submissions: [] as Submission[],
    transactions: [] as { hash: string; wallet: string; status: string }[],
    configured,
    demoMode: demoMode(),
    syncError: null as string | null,
  }

  // 1. Fetch persistent database records
  const dbProjects = await db.project.findMany({
    include: { opportunities: true },
    orderBy: { createdAt: 'desc' },
  }).catch(() => [])

  const mappedProjects: Project[] = dbProjects.map(p => {
    let techs: string[] = []
    try {
      techs = JSON.parse(p.technologies)
    } catch {
      techs = p.technologies ? p.technologies.split(',').map(s => s.trim()).filter(Boolean) : []
    }
    return {
      id: p.id,
      onChainId: p.onChainId || 0,
      name: p.name,
      shortDescription: p.shortDescription,
      detailedDescription: p.detailedDescription,
      category: p.category,
      technologies: techs,
      repoId: p.repoId,
      repoUrl: p.repoUrl,
      liveDappUrl: p.liveDappUrl,
      demoVideoUrl: p.demoVideoUrl || undefined,
      publisherAddress: p.publisherAddress,
      publisherUserId: p.publisherUserId || undefined,
      opportunitiesCount: p.opportunities.length,
      createdAt: p.createdAt.toISOString(),
    }
  })

  const dbOpps = await db.opportunity.findMany({
    // A prepared database record is not a funded bounty. Only expose records
    // whose create-and-fund transaction was indexed from the escrow contract.
    where: { onChainId: { not: null }, txHash: { not: null } },
    include: { project: true, submissions: true },
    orderBy: { createdAt: 'desc' },
  }).catch(() => [])

  const mappedOpps: Opportunity[] = dbOpps.map(o => {
    let skills: string[] = []
    try {
      skills = JSON.parse(o.requiredSkills)
    } catch {
      skills = o.requiredSkills ? o.requiredSkills.split(',').map(s => s.trim()).filter(Boolean) : []
    }
    return {
      id: o.id,
      onChainId: o.onChainId || 0,
      projectId: o.projectId,
      publisherAddress: o.publisherAddress,
      publisherUserId: o.publisherUserId || undefined,
      txHash: o.txHash || undefined,
      title: o.title,
      taskType: o.taskType as Opportunity['taskType'],
      description: o.description,
      acceptanceCriteria: o.acceptanceCriteria,
      difficulty: o.difficulty as Opportunity['difficulty'],
      requiredSkills: skills,
      rewardEth: o.rewardEth,
      remainingEscrowEth: o.rewardEth,
      deadline: o.deadline.toISOString(),
      issueUrl: o.issueUrl || undefined,
      state: (o.state === 'OPEN' ? 'Open' : o.state === 'APPROVED' ? 'Approved' : o.state === 'PAID' ? 'Paid' : o.state === 'REFUNDED' ? 'Refunded' : o.state) as Opportunity['state'],
      selectedSubmissionId: o.selectedSubmissionId || undefined,
      createdAt: o.createdAt.toISOString(),
    }
  })

  const dbSubs = await db.submission.findMany({
    orderBy: { createdAt: 'desc' },
  }).catch(() => [])
  const submissionWalletLinks = await db.walletLink.findMany({
    where: { address: { in: [...new Set(dbSubs.map(submission => submission.contributorAddress.toLowerCase()))] } },
  }).catch(() => [])

  const mappedSubs: Submission[] = dbSubs.map(s => ({
    id: s.id,
    onChainId: s.onChainId || 0,
    opportunityId: s.opportunityId,
    contributorAddress: s.contributorAddress,
    contributorUserId: s.contributorUserId || undefined,
    githubUsername: s.githubUsername || 'Contributor',
    githubPrUrl: s.prUrl,
    prNumber: s.prNumber,
    prTitle: `${s.repoOwner}/${s.repoName} #${s.prNumber}`,
    prState: s.isMerged ? 'merged' : 'open',
    status: (s.status === 'PENDING' ? 'Pending' : s.status === 'APPROVED' ? 'Approved' : s.status === 'REJECTED' ? 'Rejected' : s.status === 'PAID' ? 'Paid' : s.status) as Submission['status'],
    notes: s.notes || undefined,
    createdAt: s.createdAt.toISOString(),
    payoutTxHash: s.paidTxHash || undefined,
    identityVerified: submissionWalletLinks.some(link =>
      link.address === s.contributorAddress.toLowerCase() &&
      (!s.contributorUserId || link.userId === s.contributorUserId) &&
      link.githubId === s.githubUserId
    ),
    demo: Boolean(s.githubUsername?.startsWith('demo:')),
    verifiedRecordId: s.id,
  }))

  empty.projects = mappedProjects
  empty.opportunities = mappedOpps
  empty.submissions = mappedSubs

  // 2. Synchronize with live MST Testnet escrow contract if configured
  if (configured) {
    try {
      await reconcile()
      await refreshDuePulls()
      const trackedPulls = await db.verifiedSubmission.findMany({
        where: { id: { in: empty.submissions.map(submission => submission.id) } },
        select: { id: true, prState: true, commit: true, syncedAt: true, syncError: true },
      }).catch(() => [])
      const trackedById = new Map(trackedPulls.map(pull => [pull.id, pull]))
      for (const submission of empty.submissions) {
        const tracked = trackedById.get(submission.id)
        if (!tracked) continue
        submission.prState = tracked.prState as Submission['prState']
        submission.prCommit = tracked.commit || undefined
        submission.lastSyncedAt = tracked.syncedAt.toISOString()
        submission.syncError = tracked.syncError || undefined
      }
    } catch (error) {
      empty.syncError = error instanceof Error ? error.message : 'MST Testnet sync unavailable'
    }

    // Read on-chain opportunity states for any linked opportunities
    for (const opp of empty.opportunities) {
      if (!opp.onChainId) continue
      try {
        const onChain = await chainClient.readContract({
          address: chainConfig(),
          abi: bountyAbi,
          functionName: 'opportunities',
          args: [BigInt(opp.onChainId)],
        })
        if (onChain && onChain[10]) { // exists is index 10
          opp.rewardEth = formatEther(onChain[4])
          opp.remainingEscrowEth = formatEther(onChain[5])
          opp.deadline = new Date(Number(onChain[6]) * 1000).toISOString()
          const status = Number(onChain[9])
          opp.state = status === 1 ? 'Open' : status === 2 ? 'Approved' : status === 3 ? 'Paid' : status === 4 ? 'Refunded' : opp.state
          if (onChain[7] > 0n) {
            opp.selectedSubmissionId = onChain[7].toString()
          }
        }
      } catch {
        // Contract call fallback to db representation
      }
    }

    // Read on-chain contribution states for linked submissions
    for (const sub of empty.submissions) {
      if (!sub.onChainId) continue
      try {
        const onChain = await chainClient.readContract({
          address: chainConfig(),
          abi: bountyAbi,
          functionName: 'contributions',
          args: [BigInt(sub.onChainId)],
        })
        if (onChain && onChain[5]) { // exists
          const status = Number(onChain[4])
          sub.status = status === 1 ? 'Pending' : status === 2 ? 'Approved' : status === 3 ? 'Rejected' : status === 4 ? 'Paid' : sub.status
        }
      } catch {
        // Fallback to db
      }
    }

    // Pull verified submissions that might not have a direct db.submission record yet
    const verifiedList = await db.verifiedSubmission.findMany({
      where: { chainAddress: chainConfig().toLowerCase() },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).catch(() => [])

    for (const v of verifiedList) {
      if (empty.submissions.some(s => s.id === v.id || (v.chainRef && s.onChainId === Number(v.chainRef)))) {
        continue
      }
      const paid = await db.chainEvent.findFirst({
        where: {
          contractAddress: chainConfig().toLowerCase(),
          eventName: 'RewardReleased',
          payload: { contains: `"contributionId":"${v.chainRef}"` },
        },
      })
      const isDemo = v.githubId.startsWith('demo:')
      empty.submissions.push({
        id: v.id,
        onChainId: v.chainRef ? Number(v.chainRef) : 0,
        opportunityId: v.opportunityId,
        contributorAddress: v.wallet,
        githubUsername: v.login,
        githubPrUrl: v.url,
        prNumber: v.prNumber,
        prTitle: v.title,
        prState: v.prState as Submission['prState'],
        status: paid ? 'Paid' : 'Pending',
        notes: v.notes,
        createdAt: v.createdAt.toISOString(),
        payoutTxHash: paid?.transactionHash,
        identityVerified: false,
        demo: isDemo,
        prCommit: v.commit,
        lastSyncedAt: v.syncedAt.toISOString(),
        syncError: v.syncError || undefined,
        verifiedRecordId: v.id,
      })
    }
  }

  // 3. Compute stats
  for (const p of empty.projects) {
    const open = empty.opportunities.filter(o => o.projectId === p.id && o.state === 'Open')
    p.opportunitiesCount = open.length
    p.totalBountyEth = formatEther(open.reduce((sum, o) => sum + parseEther(o.remainingEscrowEth || '0'), 0n))
  }
  for (const o of empty.opportunities) {
    o.submissionsCount = empty.submissions.filter(s => s.opportunityId === o.id).length
  }

  empty.transactions = await db.transaction.findMany({
    where: { contractAddress: chainConfig().toLowerCase() },
    take: 100,
    orderBy: { updatedAt: 'desc' },
    select: { hash: true, wallet: true, status: true },
  }).catch(() => [])

  return empty
}
