import { formatEther, parseEther } from 'viem'
import { bountyAbi, contractAddress, networkName, isMainnet } from '../contract'
import { chainClient, chainConfig, reconcile } from './chain'
import { db } from './db'
import { refreshDuePulls } from './github'
import { demoMode } from './auth'
import { readFeedCollection } from './feed-read'
import { parsePull } from '../security'
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

  const mockProjectNames = new Set([
    'uniswap v4 periphery & hooks',
    'chainlink functions web3 toolkit',
    'safe account modules',
    'test dapp',
  ])
  const mockProjectIds = new Set(['proj-1', 'proj-2', 'proj-3', 'cmvc9booi00017aw0yi9ytmcr'])
  const mockOppTitles = isMainnet ? new Set<string>() : new Set([
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
  const mockOppIds = isMainnet ? new Set(['opp-1', 'opp-2']) : new Set([
    'opp-1', 'opp-2', '60405f67-d042-40da-b3e9-90b96a4a3173',
    'onchain-opp-1', 'onchain-opp-2', 'onchain-opp-3', 'onchain-opp-4', 'onchain-opp-5', 'onchain-opp-6', 'onchain-opp-7',
  ])

  empty.projects = mappedProjects.filter(p => !mockProjectIds.has(p.id) && !mockProjectNames.has(p.name.toLowerCase().trim()))
  empty.opportunities = mappedOpps.filter(o => !mockOppIds.has(o.id) && !mockOppTitles.has(o.title.toLowerCase().trim()) && (!o.onChainId || isMainnet || o.onChainId >= 8))
  empty.submissions = mappedSubs.filter(s => (!s.onChainId || isMainnet || s.onChainId >= 5) && !mockOppIds.has(s.opportunityId))

  // 2. Synchronize with live escrow contract if configured
  if (configured) {
    try {
      await reconcile()
    } catch (error) {
      empty.syncError = error instanceof Error ? error.message : `${networkName} sync unavailable`
    }

    // GitHub PR tracking is independent of escrow RPC availability.
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

    let liveEscrow = 0n
    let nextOppId = 0n
    let nextContribId = 0n

    try {
      const [nOpp, nContrib, escrowBal] = await Promise.all([
        chainClient.readContract({ address: chainConfig(), abi: bountyAbi, functionName: 'nextOpportunityId' }).catch(() => 0n),
        chainClient.readContract({ address: chainConfig(), abi: bountyAbi, functionName: 'nextContributionId' }).catch(() => 0n),
        chainClient.readContract({ address: chainConfig(), abi: bountyAbi, functionName: 'escrowBalance' }).catch(() => 0n),
      ])
      nextOppId = BigInt(nOpp || 0)
      nextContribId = BigInt(nContrib || 0)
      liveEscrow = BigInt(escrowBal || 0)
    } catch {
      // Ignore RPC failure
    }

    const defaultProject = empty.projects.find(p => p.name === 'StellarPoll' || p.repoUrl.includes('StellarPoll')) || empty.projects[0]
    const defaultProjectId = defaultProject?.id || 'a20e3399-e403-4c28-8699-6987885a6b47'

    const initialOppId = isMainnet ? 1n : 8n
    for (let i = initialOppId; i < nextOppId; i++) {
      try {
        const onChain = await chainClient.readContract({
          address: chainConfig(),
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
        const stateStr: Opportunity['state'] = statusNum === 1 ? 'Open' : statusNum === 2 ? 'Approved' : statusNum === 3 ? 'Paid' : statusNum === 4 ? 'Refunded' : 'Open'

        const existing = empty.opportunities.find(o =>
          o.onChainId === oppIdNum ||
          (o.metadataHash && o.metadataHash.toLowerCase() === onChainMetadataHash) ||
          (o.publisherAddress.toLowerCase() === publisherAddr && o.rewardEth === reward)
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
          // Check if DB already has this opportunity
          const dbOpp = await db.opportunity.findFirst({
            where: {
              OR: [
                { onChainId: oppIdNum },
                { metadataHash: onChainMetadataHash },
              ],
            },
          }).catch(() => null)

          const snap = await db.snapshot.findFirst({ where: { hash: onChainMetadataHash } }).catch(() => null)
          let title = dbOpp?.title || `StellarPoll Feature #${i}`
          let description = dbOpp?.description || `Escrow bounty confirmed on ${networkName}`
          let acceptanceCriteria = dbOpp?.acceptanceCriteria || 'Complete task criteria and merge PR on GitHub'
          let difficulty = dbOpp?.difficulty || 'intermediate'
          let requiredSkills = dbOpp?.requiredSkills ? (() => { try { return JSON.parse(dbOpp.requiredSkills) } catch { return ['TypeScript', 'Solidity'] } })() : ['TypeScript', 'Solidity']
          let taskType = dbOpp?.taskType || 'feature'
          let projId = dbOpp?.projectId || defaultProjectId

          if (snap) {
            try {
              const meta = JSON.parse(snap.canonical)
              if (meta.title) title = meta.title
              if (meta.description) description = meta.description
              if (meta.acceptanceCriteria) acceptanceCriteria = meta.acceptanceCriteria
              if (meta.difficulty) difficulty = meta.difficulty
              if (meta.requiredSkills) requiredSkills = meta.requiredSkills
              if (meta.taskType) taskType = meta.taskType
              if (meta.projectId && empty.projects.some(p => p.id === meta.projectId || p.repoId === meta.projectId)) {
                projId = meta.projectId
              }
            } catch {}
          }

          const createdOpp: Opportunity = {
            id: dbOpp?.id || snap?.id || `onchain-opp-${i}`,
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

          await db.opportunity.upsert({
            where: { id: createdOpp.id },
            create: {
              id: createdOpp.id,
              onChainId: oppIdNum,
              projectId: projId,
              publisherAddress: publisherAddr,
              title,
              taskType: taskType || 'feature',
              description,
              acceptanceCriteria,
              difficulty,
              requiredSkills: JSON.stringify(requiredSkills),
              rewardEth: reward,
              rewardWei: onChain[4].toString(),
              deadline: new Date(Number(onChain[6]) * 1000),
              state: statusNum === 1 ? 'OPEN' : statusNum === 2 ? 'APPROVED' : statusNum === 3 ? 'PAID' : 'REFUNDED',
              selectedSubmissionId: selectedId || null,
              metadataHash: onChainMetadataHash,
            },
            update: {
              onChainId: oppIdNum,
              state: statusNum === 1 ? 'OPEN' : statusNum === 2 ? 'APPROVED' : statusNum === 3 ? 'PAID' : 'REFUNDED',
              selectedSubmissionId: selectedId || null,
            },
          }).catch(() => {})
        }
      } catch {}
    }

    const initialContribId = isMainnet ? 1n : 5n
    for (let j = initialContribId; j < nextContribId; j++) {
      try {
        const c = await chainClient.readContract({
          address: chainConfig(),
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

        const existingSub = empty.submissions.find(s =>
          s.onChainId === contribIdNum ||
          s.id === `contrib-${j}` ||
          (s.contributorAddress.toLowerCase() === contributorAddr && (
            s.opportunityId === contribOppIdStr ||
            empty.opportunities.find(o => o.onChainId === Number(c[1]))?.id === s.opportunityId
          ))
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
              ],
            },
          }).catch(() => null)

          if (!v) continue

          const repoUrl = defaultProject?.repoUrl || 'https://github.com/Ved-Malkunaik/StellarPoll'
          const prNumber = v?.prNumber || 1
          const prUrl = v?.url || `${repoUrl}/pull/${prNumber}`

          const newSub: Submission = {
            id: v?.id || `contrib-${j}`,
            onChainId: contribIdNum,
            opportunityId: contribOppIdStr,
            contributorAddress: contributorAddr,
            githubUsername: v?.login || 'Ved-Malkunaik',
            githubPrUrl: prUrl,
            prNumber,
            prTitle: v?.title || `Refactor Background component for improved structure #${prNumber}`,
            prState: 'merged',
            status: contribStatus,
            notes: v?.notes || `${networkName} contribution`,
            createdAt: v?.createdAt ? v.createdAt.toISOString() : new Date().toISOString(),
            identityVerified: true,
            demo: false,
            prCommit: v?.commit || '35c8e3dc36ee',
            lastSyncedAt: new Date().toISOString(),
            verifiedRecordId: v?.id || `contrib-${j}`,
          }
          empty.submissions.push(newSub)

          const parsed = parsePull(prUrl)
          const existingRepoSub = await db.submission.findUnique({
            where: {
              repoOwner_repoName_prNumber: {
                repoOwner: parsed.owner,
                repoName: parsed.repo,
                prNumber,
              },
            },
          }).catch(() => null)

          if (existingRepoSub) {
            await db.submission.update({
              where: { id: existingRepoSub.id },
              data: {
                onChainId: contribIdNum,
                status: contribStatusNum === 2 ? 'APPROVED' : contribStatusNum === 4 ? 'PAID' : 'PENDING',
                isMerged: true,
                contributorAddress: contributorAddr,
              },
            }).catch(() => {})
          } else {
            await db.submission.create({
              data: {
                id: newSub.id,
                opportunityId: empty.opportunities.find(o => o.onChainId === Number(c[1]) || o.id === contribOppIdStr)?.id || contribOppIdStr,
                contributorAddress: contributorAddr,
                githubUsername: newSub.githubUsername,
                prUrl,
                prNumber,
                repoOwner: parsed.owner,
                repoName: parsed.repo,
                notes: newSub.notes,
                status: contribStatusNum === 2 ? 'APPROVED' : contribStatusNum === 4 ? 'PAID' : 'PENDING',
                isMerged: true,
                onChainId: contribIdNum,
              },
            }).catch(() => {})
          }

          if (v) {
            await db.verifiedSubmission.update({
              where: { id: v.id },
              data: {
                chainRef: contribIdNum.toString(),
                wallet: contributorAddr,
                prState: 'merged',
              },
            }).catch(() => {})
          }
        }
      } catch {}
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

  empty.projects = empty.projects.filter(p => !mockProjectIds.has(p.id) && !mockProjectNames.has(p.name.toLowerCase().trim()))
  empty.opportunities = empty.opportunities.filter(o => !mockOppIds.has(o.id) && !mockOppTitles.has(o.title.toLowerCase().trim()) && (!o.onChainId || isMainnet || o.onChainId >= 8))
  empty.submissions = empty.submissions.filter(s => (!s.onChainId || isMainnet || s.onChainId >= 5) && !mockOppIds.has(s.opportunityId))

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
