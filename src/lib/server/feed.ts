import { formatEther, parseEther } from 'viem'
import { bountyAbi, getNetworkConfig, type NetworkConfig } from '../contract'
import { getChainContext, reconcile } from './chain'
import { db } from './db'
import { refreshDuePulls } from './github'
import { demoMode } from './auth'
import { readFeedCollection } from './feed-read'
import { parsePull } from '../security'
import type { Project, Opportunity, Submission } from '@/types'

function isValidGithubPr(url?: string | null): boolean {
  if (!url) return false
  return /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/pull\/\d+/i.test(url)
}

export async function feed(targetChainId?: number | null) {
  const { net, client, address } = getChainContext(targetChainId)
  const configured = Boolean(address)
  const empty = {
    projects: [] as Project[],
    opportunities: [] as Opportunity[],
    submissions: [] as Submission[],
    transactions: [] as { hash: string; wallet: string; status: string }[],
    configured,
    demoMode: demoMode(),
    syncError: null as string | null,
    chainId: net.chainId,
    currencySymbol: net.currencySymbol,
    networkName: net.name,
    explorerUrl: net.explorerUrl,
  }

  // 1. Fetch persistent database records
  const dbProjects = await readFeedCollection('projects', () => db.project.findMany({
    include: { opportunities: true },
    orderBy: { createdAt: 'desc' },
  }))

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

  const dbOpps = await readFeedCollection('opportunities', () => db.opportunity.findMany({
    include: { project: true, submissions: true },
    orderBy: { createdAt: 'desc' },
  }))

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

  const dbSubs = await readFeedCollection('submissions', () => db.submission.findMany({
    orderBy: { createdAt: 'desc' },
  }))
  const submissionWalletLinks = await readFeedCollection('wallet links', () => db.walletLink.findMany({
    where: { address: { in: [...new Set(dbSubs.map(submission => submission.contributorAddress.toLowerCase()))] } },
  }))

  const mappedSubs: Submission[] = dbSubs.map(s => ({
    id: s.id,
    onChainId: s.onChainId || 0,
    opportunityId: s.opportunityId,
    contributorAddress: s.contributorAddress,
    contributorUserId: s.contributorUserId || undefined,
    githubUsername: s.githubUsername || 'Contributor',
    githubPrUrl: isValidGithubPr(s.prUrl) ? s.prUrl : undefined,
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

  const mockProjectNames = new Set([
    'uniswap v4 periphery & hooks',
    'chainlink functions web3 toolkit',
    'safe account modules',
    'test dapp',
    'stellarpoll',
  ])
  const mockProjectIds = new Set([
    'proj-1',
    'proj-2',
    'proj-3',
    'cmvc9booi00017aw0yi9ytmcr',
    '69f67dba-3838-4578-8ae8-cae0b2eb7de6',
    'f9be845b-8773-4dd2-92b7-e3bb89deee19',
  ])
  const mockOppTitles = new Set([
    'refactor ui components & state management',
    'enhance poll analytics & export',
    'gas-optimized twap hook with dynamic tick intervals',
    'cross-chain state proof verifier with ccip callback',
    'change the ui/ux',
    'stellarpoll feature #1',
    'stellarpoll feature #2',
    'stellarpoll feature #3',
    'stellarpoll feature #4',
    'stellarpoll feature #5',
    'stellarpoll feature #6',
    'stellarpoll feature #7',
  ])
  const mockOppIds = new Set([
    'opp-1', 'opp-2', '60405f67-d042-40da-b3e9-90b96a4a3173', '0946ff23-488d-4ba4-b56a-46887c06219d',
    'onchain-opp-1', 'onchain-opp-2', 'onchain-opp-3', 'onchain-opp-4', 'onchain-opp-5', 'onchain-opp-6', 'onchain-opp-7', 'onchain-opp-8', 'onchain-opp-9',
  ])

  // Fresh start: Only include real user-created projects and opportunities
  empty.projects = mappedProjects.filter(p =>
    !mockProjectIds.has(p.id) &&
    !mockProjectNames.has(p.name.toLowerCase().trim())
  )

  empty.opportunities = mappedOpps.filter(o =>
    !mockOppIds.has(o.id) &&
    !mockOppTitles.has(o.title.toLowerCase().trim()) &&
    (!o.onChainId || BigInt(o.onChainId) >= net.freshStartOppMinId)
  )

  empty.submissions = mappedSubs.filter(s =>
    !mockOppIds.has(s.opportunityId) &&
    empty.opportunities.some(o => o.id === s.opportunityId || (o.onChainId && String(o.onChainId) === s.opportunityId))
  )

  // 2. Synchronize with live escrow contract for active network
  if (configured) {
    try {
      await reconcile()
    } catch (error) {
      empty.syncError = error instanceof Error ? error.message : `${net.name} sync unavailable`
    }

    try {
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
      empty.syncError ||= error instanceof Error ? error.message : 'GitHub PR sync unavailable'
    }

    let nextOppId = 0n
    let nextContribId = 0n

    try {
      const [nOpp, nContrib] = await Promise.all([
        client.readContract({ address, abi: bountyAbi, functionName: 'nextOpportunityId' }).catch(() => 0n),
        client.readContract({ address, abi: bountyAbi, functionName: 'nextContributionId' }).catch(() => 0n),
      ])
      nextOppId = BigInt(nOpp || 0)
      nextContribId = BigInt(nContrib || 0)
    } catch {
      // RPC fallback
    }

    // Only scan on-chain opportunities created from freshStartOppMinId onwards
    for (let i = net.freshStartOppMinId; i < nextOppId; i++) {
      try {
        const onChain = await client.readContract({
          address,
          abi: bountyAbi,
          functionName: 'opportunities',
          args: [i],
        })
        if (!onChain || !onChain[10]) continue // exists is index 10

        const oppIdNum = Number(i)
        const onChainMetadataHash = String(onChain[2]).toLowerCase()
        const publisherAddr = String(onChain[3]).toLowerCase()
        const reward = formatEther(onChain[4])
        const remaining = formatEther(onChain[5])
        const deadlineDate = new Date(Number(onChain[6]) * 1000).toISOString()
        const selectedId = onChain[7] > 0n ? onChain[7].toString() : undefined
        const statusNum = Number(onChain[9])
        const stateStr: Opportunity['state'] =
          statusNum === 1 ? 'Open' : statusNum === 2 ? 'Approved' : statusNum === 3 ? 'Paid' : statusNum === 4 ? 'Refunded' : 'Open'

        const existing = empty.opportunities.find(o =>
          o.onChainId === oppIdNum ||
          (o.metadataHash && o.metadataHash.toLowerCase() === onChainMetadataHash)
        )
        if (existing) {
          existing.onChainId = oppIdNum
          existing.rewardEth = reward
          existing.remainingEscrowEth = remaining
          existing.deadline = deadlineDate
          existing.state = stateStr
          if (selectedId) existing.selectedSubmissionId = selectedId

          await db.opportunity.updateMany({
            where: { id: existing.id },
            data: {
              onChainId: oppIdNum,
              state: statusNum === 1 ? 'OPEN' : statusNum === 2 ? 'APPROVED' : statusNum === 3 ? 'PAID' : 'REFUNDED',
              rewardEth: reward,
              selectedSubmissionId: selectedId || null,
            },
          }).catch(() => {})
        } else {
          const dbOpp = await db.opportunity.findFirst({
            where: {
              OR: [
                { onChainId: oppIdNum },
                { metadataHash: onChainMetadataHash },
              ],
            },
          }).catch(() => null)

          const snap = await db.snapshot.findFirst({ where: { hash: onChainMetadataHash } }).catch(() => null)
          if (!snap && !dbOpp) {
            // No metadata available for an unmapped opportunity; skip
            continue
          }

          let title = dbOpp?.title || `Opportunity #${i}`
          let description = dbOpp?.description || `Bounty opportunity on ${net.name}`
          let acceptanceCriteria = dbOpp?.acceptanceCriteria || 'Merge GitHub PR and meet acceptance criteria'
          let difficulty = dbOpp?.difficulty || 'intermediate'
          let requiredSkills = dbOpp?.requiredSkills ? (() => { try { return JSON.parse(dbOpp.requiredSkills) } catch { return [] } })() : []
          let taskType = dbOpp?.taskType || 'feature'
          let projId = dbOpp?.projectId || (empty.projects[0]?.id || '')

          if (snap) {
            try {
              const meta = JSON.parse(snap.canonical)
              if (meta.title) title = meta.title
              if (meta.description) description = meta.description
              if (meta.acceptanceCriteria) acceptanceCriteria = meta.acceptanceCriteria
              if (meta.difficulty) difficulty = meta.difficulty
              if (meta.requiredSkills) requiredSkills = meta.requiredSkills
              if (meta.taskType) taskType = meta.taskType
              if (meta.projectId && empty.projects.some(p => p.id === meta.projectId)) {
                projId = meta.projectId
              }
            } catch {}
          }

          const createdOpp: Opportunity = {
            id: dbOpp?.id || (snap?.id || `onchain-opp-${i}`),
            onChainId: oppIdNum,
            projectId: projId,
            publisherAddress: publisherAddr,
            title,
            description,
            taskType: taskType as Opportunity['taskType'],
            acceptanceCriteria,
            difficulty: difficulty as Opportunity['difficulty'],
            requiredSkills,
            rewardEth: reward,
            remainingEscrowEth: remaining,
            deadline: deadlineDate,
            state: stateStr,
            selectedSubmissionId: selectedId,
            createdAt: dbOpp?.createdAt ? dbOpp.createdAt.toISOString() : new Date().toISOString(),
            metadataHash: onChainMetadataHash,
          }
          empty.opportunities.push(createdOpp)
        }
      } catch {}
    }

    // Only scan contributions created from freshStartContribMinId onwards
    for (let j = net.freshStartContribMinId; j < nextContribId; j++) {
      try {
        const c = await client.readContract({
          address,
          abi: bountyAbi,
          functionName: 'contributions',
          args: [j],
        })
        if (!c || !c[5]) continue // exists is index 5
        const contribIdNum = Number(j)
        const contribOppIdStr = c[1].toString()
        const contributorAddr = String(c[2]).toLowerCase()
        const contribStatusNum = Number(c[4])
        const contribStatus: Submission['status'] =
          contribStatusNum === 1 ? 'Pending' : contribStatusNum === 2 ? 'Approved' : contribStatusNum === 3 ? 'Rejected' : contribStatusNum === 4 ? 'Paid' : 'Pending'

        const matchedOpp = empty.opportunities.find(o => o.onChainId === Number(c[1]))
        const oppIdToLink = matchedOpp?.id || contribOppIdStr

        const existingSub = empty.submissions.find(s =>
          s.onChainId === contribIdNum ||
          s.id === `contrib-${j}` ||
          (s.contributorAddress.toLowerCase() === contributorAddr && s.opportunityId === oppIdToLink)
        )
        if (existingSub) {
          existingSub.onChainId = contribIdNum
          existingSub.status = contribStatus
          existingSub.contributorAddress = contributorAddr
        } else {
          const v = await db.verifiedSubmission.findFirst({
            where: {
              OR: [
                { chainRef: contribIdNum.toString() },
                { opportunityId: contribOppIdStr },
                ...(matchedOpp ? [{ opportunityId: matchedOpp.id }] : []),
              ],
            },
          }).catch(() => null)

          if (v && isValidGithubPr(v.url)) {
            const parsed = parsePull(v.url)
            empty.submissions.push({
              id: v.id,
              onChainId: contribIdNum,
              opportunityId: oppIdToLink,
              contributorAddress: contributorAddr,
              githubUsername: v.login || `${contributorAddr.slice(0, 6)}...${contributorAddr.slice(-4)}`,
              githubPrUrl: v.url,
              prNumber: v.prNumber,
              prTitle: v.title || `Pull Request #${v.prNumber}`,
              prState: (v.prState as any) || 'open',
              status: contribStatus,
              notes: v.notes || `${net.name} contribution`,
              createdAt: v.createdAt ? v.createdAt.toISOString() : new Date().toISOString(),
              identityVerified: true,
              demo: false,
              prCommit: v.commit || undefined,
              lastSyncedAt: new Date().toISOString(),
              verifiedRecordId: v.id,
            })
          }
        }
      } catch {}
    }

    // Refresh on-chain states for opportunities
    for (const opp of empty.opportunities) {
      if (!opp.onChainId) continue
      try {
        const onChain = await client.readContract({
          address,
          abi: bountyAbi,
          functionName: 'opportunities',
          args: [BigInt(opp.onChainId)],
        })
        if (onChain && onChain[10]) {
          opp.rewardEth = formatEther(onChain[4])
          opp.remainingEscrowEth = formatEther(onChain[5])
          opp.deadline = new Date(Number(onChain[6]) * 1000).toISOString()
          const status = Number(onChain[9])
          opp.state = status === 1 ? 'Open' : status === 2 ? 'Approved' : status === 3 ? 'Paid' : status === 4 ? 'Refunded' : opp.state
          if (onChain[7] > 0n) {
            opp.selectedSubmissionId = onChain[7].toString()
          }
        }
      } catch {}
    }

    // Refresh on-chain states for submissions
    for (const sub of empty.submissions) {
      if (!sub.onChainId) continue
      try {
        const onChain = await client.readContract({
          address,
          abi: bountyAbi,
          functionName: 'contributions',
          args: [BigInt(sub.onChainId)],
        })
        if (onChain && onChain[5]) {
          const status = Number(onChain[4])
          sub.status = status === 1 ? 'Pending' : status === 2 ? 'Approved' : status === 3 ? 'Rejected' : status === 4 ? 'Paid' : sub.status
        }
      } catch {}
    }
  }

  // Final cleanup of opportunitiesCount
  for (const project of empty.projects) {
    project.opportunitiesCount = empty.opportunities.filter(o => o.projectId === project.id).length
  }

  return empty
}
