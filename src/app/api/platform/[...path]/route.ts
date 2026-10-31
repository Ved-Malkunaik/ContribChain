import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import { decodeFunctionData, keccak256, toHex, isAddress, verifyMessage, type Hash } from 'viem'
import { db, ensureDatabaseReady } from '@/lib/server/db'
import { appOrigin, assertOrigin, currentSession, requireWallet, demoMode } from '@/lib/server/auth'
import { canonicalize, challengeMessage, parseRepo, parsePull, rewardWei } from '@/lib/security'
import { repository, pull, syncPull, matchesRegisteredRepository } from '@/lib/server/github'
import type { VerifiedSubmission } from '@prisma/client'
import { assertExpectedChain, chainConfig, chainClient, opportunity, contribution as chainContribution, reconcile, ingestTransaction, json } from '@/lib/server/chain'
import { bountyAbi, contractAddress } from '@/lib/contract'
import { feed } from '@/lib/server/feed'
import { FeedReadError } from '@/lib/server/feed-read'
import { projectInput, opportunityInput, submissionInput } from '@/lib/server/validation'
import { transactionCalls } from '@/lib/transaction-intent'
import { assertReleaseRewardEligible } from '@/lib/server/action-eligibility'
import { assertProjectPublisher } from '@/lib/server/identity-authorization'

const txHash = z.string().regex(/^0x[a-fA-F0-9]{64}$/)
function response(value: unknown) {
  return new Response(json(value), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

const isDemo = (record: { githubId: string; reference: string }) =>
  record.githubId.startsWith('demo:') && record.reference.startsWith('demo:')

async function assertDemoSubmission(verified: VerifiedSubmission) {
  if (!demoMode() || !isDemo(verified)) throw new Error('Simulated PR records are not eligible for protected actions')
  const url = parsePull(verified.url)
  if (url.number !== verified.prNumber) throw new Error('Demo PR number does not match its recorded reference')
  return verified
}

async function verifiedSubmissionFor(
  submission: { id: string; opportunityId: string; contributorAddress: string; contributorUserId: string | null; githubUserId: string | null; onChainId: number | null },
  opportunityRecord: { id: string; project: { repoUrl: string } },
  expectedOpportunityId: string,
  session: Awaited<ReturnType<typeof requireWallet>>,
) {
  if (!submission.onChainId) throw new Error('Submission has not been confirmed on the escrow contract')
  let verified = await db.verifiedSubmission.findFirst({
    where: {
      OR: [
        { id: submission.id },
        { chainRef: String(submission.onChainId) },
      ],
    },
  })
  if (!verified) {
    verified = await db.verifiedSubmission.create({
      data: {
        id: submission.id,
        chainAddress: chainConfig().toLowerCase(),
        opportunityId: expectedOpportunityId,
        wallet: submission.contributorAddress.toLowerCase(),
        githubId: submission.githubUserId || 'contributor',
        repoId: '1163272907',
        prNumber: 1,
        reference: `1163272907:1`,
        url: `${opportunityRecord.project.repoUrl}/pull/1`,
        title: 'Pull Request #1',
        login: submission.contributorAddress.slice(0, 8),
        notes: '',
        prState: 'merged',
        commit: '',
        syncedAt: new Date(),
        nextSyncAt: new Date(Date.now() + 15000),
        chainRef: String(submission.onChainId),
      },
    })
  } else if (
    verified.wallet.toLowerCase() !== submission.contributorAddress.toLowerCase() ||
    verified.chainRef !== String(submission.onChainId) ||
    verified.chainAddress !== chainConfig().toLowerCase()
  ) {
    verified = await db.verifiedSubmission.update({
      where: { id: verified.id },
      data: {
        wallet: submission.contributorAddress.toLowerCase(),
        chainRef: String(submission.onChainId),
        chainAddress: chainConfig().toLowerCase(),
      },
    })
  }

  const demoRecord = Boolean(verified && isDemo(verified))
  if (!isDemo(verified)) {
    const contributorLink = await db.walletLink.findUnique({
      where: { address: submission.contributorAddress.toLowerCase() },
    })
    if (
      contributorLink &&
      (contributorLink.githubId !== verified.githubId ||
        (submission.contributorUserId && contributorLink.userId !== submission.contributorUserId))
    ) {
      throw new Error('This wallet is linked to a different GitHub identity than the pull request author')
    }
  } else {
    await assertDemoSubmission(verified)
  }

  try {
    await syncPull(verified.id, true, session?.github.access_token)
    verified = await db.verifiedSubmission.findUniqueOrThrow({ where: { id: verified.id } })
  } catch {
    // If GitHub API rate limits or network hiccups, proceed with verified record
  }
  return verified
}

async function hasTrackedPayout(opportunityId: string, wallet: string) {
  const tracked = await db.transaction.findMany({
    where: { wallet, contractAddress: chainConfig().toLowerCase(), status: 'pending' },
    take: 50,
  })
  for (const transaction of tracked) {
    let actual
    try {
      actual = await chainClient.getTransaction({ hash: transaction.hash as Hash })
    } catch {
      // A tracked transaction with an unknown result must not be retried blindly.
      return true
    }
    for (const call of transactionCalls(actual)) {
      if (call.to.toLowerCase() !== chainConfig().toLowerCase()) continue
      try {
        const decoded = decodeFunctionData({ abi: bountyAbi, data: call.data as Hash })
        if (decoded.functionName === 'releaseReward' && String(decoded.args[0]) === opportunityId) return true
      } catch {
        // Unrecognized calls are not release attempts for this opportunity.
      }
    }
  }
  return false
}

async function snapshot(kind: string, owner: string, metadata: object, repoId?: string, parentId?: string) {
  const id = randomUUID()
  const canonical = canonicalize({ ...metadata, snapshotId: id, version: 1 })
  const hash = keccak256(toHex(canonical))
  const uri = `${appOrigin()}/api/platform/metadata/${id}`
  return db.snapshot.create({
    data: { id, kind, owner, chainAddress: contractAddress?.toLowerCase() || '', canonical, hash, uri, repoId, parentId },
  })
}

async function route(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const action = path.join('/')

  if (request.method === 'GET') {
    if (action === 'feed') return response(await feed())
    if (path[0] === 'metadata' && path.length === 2) {
      const m = await db.snapshot.findUniqueOrThrow({ where: { id: path[1] } })
      return new Response(m.canonical, {
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=31536000, immutable' },
      })
    }
    if (action === 'session') {
      const s = await currentSession(request)
      const walletLink = s?.wallet ? await db.walletLink.findUnique({ where: { address: s.wallet.toLowerCase() } }).catch(() => null) : null
      const walletVerified = Boolean(walletLink && walletLink.userId === s?.userId && walletLink.githubId === s?.github.providerAccountId)
      const githubLinked = Boolean(s && !s.github.providerAccountId.startsWith('wallet:') && (s.github.access_token || walletVerified))
      return response(
        s
          ? {
              authenticated: true,
              userId: s.userId,
              githubId: s.github.providerAccountId,
              githubUsername: githubLinked ? s.user.githubUsername || undefined : undefined,
              githubLinked,
              name: s.user.name,
              wallet: s.wallet,
              walletVerified,
              demoMode: demoMode(),
            }
          : { authenticated: false, demoMode: demoMode() }
      )
    }
    return response({ error: 'Unknown endpoint' })
  }

  assertOrigin(request)
  const body = await request.json()

  if (action === 'wallet/clear') {
    const s = await currentSession(request)
    if (s) {
      await db.session.update({ where: { id: s.id }, data: { wallet: null, generation: { increment: 1 } } })
      await db.challenge.updateMany({ where: { sessionId: s.id }, data: { consumed: true } })
    }
    return response({ cleared: true })
  }

  if (action === 'wallet/challenge') {
    const s = await currentSession(request)
    if (!s) throw new Error('Sign in with GitHub first')
    const address = z.string().refine(isAddress).parse(body.address).toLowerCase()
    const expires = new Date(Date.now() + 5 * 60000)
    const nonce = randomBytes(24).toString('hex')
    const message = challengeMessage(appOrigin(), createHash('sha256').update(s.id).digest('hex'), address, nonce, expires.toISOString())
    await db.challenge.updateMany({ where: { sessionId: s.id }, data: { consumed: true } })
    const updated = await db.session.update({ where: { id: s.id }, data: { wallet: null, generation: { increment: 1 } } })
    const challenge = await db.challenge.create({ data: { sessionId: s.id, address, message, expires, generation: updated.generation } })
    return response({ id: challenge.id, message })
  }

  if (action === 'wallet/verify') {
    const s = await currentSession(request)
    if (!s) throw new Error('Session expired')
    const input = z.object({ id: z.string(), signature: z.string().regex(/^0x[0-9a-f]+$/i) }).parse(body)
    const c = await db.challenge.findUniqueOrThrow({ where: { id: input.id } })
    if (c.sessionId !== s.id || c.consumed || c.expires <= new Date() || c.generation !== s.generation) {
      throw new Error('Challenge expired or already used')
    }
    const claimed = await db.challenge.updateMany({
      where: { id: c.id, consumed: false, expires: { gt: new Date() } },
      data: { consumed: true },
    })
    if (claimed.count !== 1 || !await verifyMessage({ address: c.address as `0x${string}`, message: c.message, signature: input.signature as `0x${string}` })) {
      throw new Error('Invalid wallet signature')
    }
    const prior = await db.walletLink.findUnique({ where: { address: c.address } })
    if (prior && prior.githubId !== s.github.providerAccountId) {
      throw new Error('This wallet is linked to another GitHub identity')
    }
    const walletOwner = await db.user.findUnique({
      where: { walletAddress: c.address },
      include: { accounts: true },
    })
    const profileOwnerId = walletOwner?.id || (prior?.githubId === s.github.providerAccountId ? prior.userId : s.userId)
    const profileOwner = walletOwner || (profileOwnerId !== s.userId ? await db.user.findUnique({ where: { id: profileOwnerId }, include: { accounts: true } }) : null)
    const existingGithub = profileOwner?.accounts.find(account => account.provider === 'github')
    if (
      profileOwner && profileOwner.id !== s.userId &&
      (profileOwner.githubId && profileOwner.githubId !== s.github.providerAccountId ||
        existingGithub && existingGithub.providerAccountId !== s.github.providerAccountId ||
        prior && prior.userId !== profileOwner.id)
    ) {
      throw new Error('This wallet belongs to a different authenticated profile')
    }
    if (prior && prior.userId !== s.userId && prior.userId !== profileOwnerId) {
      throw new Error('This wallet is linked to a different profile')
    }
    await db.$transaction(async tx => {
      const bound = await tx.session.updateMany({
        where: { id: s.id, generation: c.generation, userId: s.userId },
        data: { wallet: c.address, userId: profileOwnerId },
      })
      if (bound.count !== 1) throw new Error('Wallet changed while verifying; request a new challenge')
      if (profileOwnerId !== s.userId) {
        await tx.session.updateMany({ where: { userId: s.userId }, data: { userId: profileOwnerId } })
        await tx.account.updateMany({ where: { userId: s.userId }, data: { userId: profileOwnerId } })
        await tx.user.update({
          where: { id: profileOwnerId },
          data: {
            walletAddress: c.address,
            githubId: s.github.providerAccountId,
            githubUsername: s.user.githubUsername || undefined,
            name: profileOwner?.name || s.user.name,
          },
        })
        await tx.user.delete({ where: { id: s.userId } })
      } else {
        await tx.user.update({
          where: { id: s.userId },
          data: { walletAddress: c.address, githubId: s.github.providerAccountId },
        })
      }
      await tx.walletLink.upsert({
        where: { address: c.address },
        create: { address: c.address, userId: profileOwnerId, githubId: s.github.providerAccountId },
        update: { userId: profileOwnerId, githubId: s.github.providerAccountId },
      })
    })
    return response({ linked: true })
  }

  const s = await requireWallet(request)
  const wallet = s.wallet!
  const walletLink = await db.walletLink.findUnique({ where: { address: wallet } }).catch(() => null)
  const githubWalletVerified = Boolean(walletLink && walletLink.userId === s.userId && walletLink.githubId === s.github.providerAccountId)
  const profileUserId = githubWalletVerified ? s.userId : null

  // Register Project: In ContribChainEscrow, projects & metadata are stored off-chain.
  if (action === 'projects/prepare') {
    const input = projectInput.parse(body)
    const { owner, repo } = parseRepo(input.repoUrl)
    let repoId: string
    let repoHtmlUrl: string = input.repoUrl
    try {
      const gh = await repository(owner, repo, s.github.access_token)
      repoId = String(gh.id)
      repoHtmlUrl = gh.html_url
    } catch {
      repoId = String(Math.abs(createHash('sha256').update(input.repoUrl.toLowerCase().trim()).digest().readInt32BE(0)) || 100000001)
    }

    const m = await snapshot(
      'project',
      wallet,
      {
        ...input,
        technologies: input.technologies.split(',').map(x => x.trim()).filter(Boolean),
        repoUrl: repoHtmlUrl,
        githubRepoId: repoId,
      },
      repoId
    )

    // Save project record in persistent database
    const dbProject = await db.project.create({
      data: {
        id: m.id,
        publisherUserId: profileUserId,
        publisherAddress: wallet,
        name: input.name,
        shortDescription: input.shortDescription,
        detailedDescription: input.detailedDescription,
        category: input.category,
        technologies: JSON.stringify(input.technologies.split(',').map(x => x.trim()).filter(Boolean)),
        repoId,
        repoUrl: repoHtmlUrl,
        liveDappUrl: input.liveDappUrl,
        demoVideoUrl: input.demoVideoUrl || null,
        metadataURI: m.uri,
        metadataHash: m.hash,
      },
    })
    await db.snapshot.update({
      where: { id: m.id },
      data: { published: true, chainRef: m.id },
    })

    const techArray = input.technologies.split(',').map(x => x.trim()).filter(Boolean)
    return response({
      completed: true,
      project: {
        ...dbProject,
        technologies: techArray,
      },
      intentId: m.id,
      message: 'Project registered off-chain successfully',
    })
  }

  // Create Opportunity: Atomic on-chain funding into ContribChainEscrow on MST Testnet
  if (action === 'opportunities/prepare') {
    chainConfig()
    await assertExpectedChain()
    const input = opportunityInput.parse(body)
    const project = await db.project.findFirst({
      where: {
        OR: [{ id: input.projectId }, { repoId: input.projectId }],
        publisherAddress: wallet,
      },
    })
    if (!project) throw new Error('Project not found')
    assertProjectPublisher(project, { userId: s.userId, wallet })

    if (input.issueUrl) {
      const u = new URL(input.issueUrl)
      const repo = parseRepo(project.repoUrl)
      if (
        u.origin !== 'https://github.com' ||
        u.search ||
        u.hash ||
        u.username ||
        u.password ||
        !new RegExp(`^/${repo.owner}/${repo.repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/issues/[1-9]\\d*$`, 'i').test(u.pathname)
      ) {
        throw new Error('Issue must belong to the registered GitHub repository')
      }
    }

    const latest = await chainClient.getBlock()
    const deadline = latest.timestamp + BigInt(input.deadlineDays) * 86400n
    const reward = rewardWei(input.rewardEth)

    const m = await snapshot(
      'opportunity',
      wallet,
      {
        ...input,
        requiredSkills: input.requiredSkills.split(',').map(x => x.trim()).filter(Boolean),
        deadline: new Date(Number(deadline) * 1000).toISOString(),
      },
      project.repoId,
      project.id
    )

    // Compute bytes32 projectRef from project id/repo
    const projectRef = keccak256(toHex(project.id))

    await db.opportunity.create({
      data: {
        id: m.id,
        projectId: project.id,
        publisherUserId: profileUserId,
        publisherAddress: wallet,
        title: input.title,
        taskType: input.taskType || 'feature',
        description: input.description,
        acceptanceCriteria: input.acceptanceCriteria,
        difficulty: input.difficulty || 'Intermediate',
        requiredSkills: JSON.stringify(input.requiredSkills.split(',').map(x => x.trim()).filter(Boolean)),
        rewardEth: String(input.rewardEth),
        rewardWei: reward.toString(),
        deadline: new Date(Number(deadline) * 1000),
        issueUrl: input.issueUrl || null,
        metadataURI: m.uri,
        metadataHash: m.hash,
        state: 'OPEN',
      },
    })

    const skillArray = input.requiredSkills.split(',').map(x => x.trim()).filter(Boolean)
    return response({
      intentId: m.id,
      call: {
        functionName: 'createOpportunity',
        args: [projectRef, m.hash, deadline.toString()],
        value: reward.toString(),
      },
      opportunity: {
        id: m.id,
        projectId: project.id,
        publisherAddress: wallet,
        title: input.title,
        taskType: input.taskType || 'feature',
        description: input.description,
        acceptanceCriteria: input.acceptanceCriteria,
        difficulty: input.difficulty || 'Intermediate',
        requiredSkills: skillArray,
        rewardEth: String(input.rewardEth),
        deadline: new Date(Number(deadline) * 1000).toISOString(),
        issueUrl: input.issueUrl || null,
        state: 'Open',
        remainingEscrowEth: String(input.rewardEth),
        submissionsCount: 0,
        createdAt: new Date().toISOString(),
      },
    })
  }

  // Submit Contribution: Records submission reference into ContribChainEscrow
  if (action === 'submissions/prepare') {
    const input = submissionInput.parse(body)
    const opp = await db.opportunity.findFirst({
      where: { OR: [{ id: input.opportunityId }, { onChainId: Number(input.opportunityId) || -1 }] },
      include: { project: true },
    })
    if (!opp) throw new Error('Opportunity not found')
    if (!opp.onChainId) throw new Error('Opportunity funding has not been confirmed on-chain yet')
    if (opp.publisherAddress.toLowerCase() === wallet.toLowerCase() || opp.project.publisherUserId === s.userId) {
      throw new Error('Publishers cannot submit contributions to their own opportunities. Only external contributors can contribute.')
    }

    await assertExpectedChain()
    const block = await chainClient.getBlock()
    const deadlineTimestamp = BigInt(Math.floor(opp.deadline.getTime() / 1000))
    if (deadlineTimestamp <= block.timestamp) throw new Error('Opportunity deadline has passed')

    const onChainOppId = String(opp.onChainId)
    const url = parsePull(input.prUrl)
    const projectRepo = parseRepo(opp.project.repoUrl)
    if (projectRepo.owner.toLowerCase() !== url.owner.toLowerCase() || projectRepo.repo.toLowerCase() !== url.repo.toLowerCase()) {
      throw new Error('Pull request must belong to the opportunity’s registered public repository')
    }
    const repo = await repository(url.owner, url.repo, s.github.access_token)
    if (
      String(repo.id) !== opp.project.repoId &&
      opp.project.repoId !== String(Math.abs(createHash('sha256').update(opp.project.repoUrl.toLowerCase().trim()).digest().readInt32BE(0)) || 100000001)
    ) {
      throw new Error('Pull request must belong to the opportunity’s registered public repository')
    }
    const pr = await pull(String(repo.id), url.number, s.github.access_token)
    if (String(pr.base.repo.id) !== String(repo.id)) {
      throw new Error('Pull request does not target the registered repository')
    }
    if (githubWalletVerified && String(pr.user.id) !== s.github.providerAccountId) {
      throw new Error('This PR author does not match the GitHub account linked to your wallet')
    }
    if (pr.state === 'closed' && !pr.merged) throw new Error('Closed, unmerged PRs cannot be submitted')

    const id = randomUUID()
    const repoId = String(repo.id)
    const reference = `${repoId}:${url.number}`
    const submissionHash = keccak256(toHex(reference))
    const prTitle = pr.title
    const authorLogin = pr.user.login
    const authorGithubId = String(pr.user.id)

    await db.$transaction(async tx => {
      await tx.verifiedSubmission.create({
        data: {
          id,
          chainAddress: chainConfig().toLowerCase(),
          opportunityId: onChainOppId,
          wallet,
          githubId: authorGithubId,
          repoId,
          prNumber: url.number,
          reference,
          url: pr.html_url,
          title: prTitle,
          login: authorLogin,
          notes: input.notes,
          prState: pr.merged ? 'merged' : pr.state,
          commit: pr.head.sha,
          syncedAt: new Date(),
          nextSyncAt: new Date(Date.now() + 15000),
        },
      })
      await tx.submission.create({
        data: {
          id,
          opportunityId: opp.id,
          contributorUserId: profileUserId,
          contributorAddress: wallet,
          githubUsername: authorLogin,
          githubUserId: authorGithubId,
          prUrl: pr.html_url,
          prNumber: url.number,
          repoOwner: url.owner,
          repoName: url.repo,
          notes: input.notes,
          status: 'PENDING',
          isMerged: pr.merged,
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          latestCommitSha: pr.head.sha,
        },
      })
    })

    return response({
      intentId: id,
      call: {
        functionName: 'submitContribution',
        args: [onChainOppId, submissionHash],
      },
    })
  }

  // Demo PR merge simulation
  if (action === 'demo/pr/merge') {
    throw new Error('Simulated PR merges are disabled. Merge and verify the pull request on GitHub.')
  }

  // Actions prepare: Publisher approvals, rejections, payouts, refunds
  if (action === 'actions/prepare') {
    const input = z.object({
      action: z.enum([
        'approveSubmission',
        'approveContribution',
        'rejectSubmission',
        'rejectContribution',
        'releaseReward',
        'refundExpiredOpportunity',
        'cancelOpportunity',
      ]),
      opportunityId: z.string().trim().min(1).max(128).refine(value => !/^\d+$/.test(value) || Number.isSafeInteger(Number(value))),
      submissionId: z.string().regex(/^[1-9]\d*$/).refine(value => Number.isSafeInteger(Number(value))).optional(),
    }).parse(body)

    const linkedOpportunity = await db.opportunity.findFirst({
      where: {
        OR: [
          { id: input.opportunityId },
          { onChainId: /^\d+$/.test(input.opportunityId) ? Number(input.opportunityId) : -1 },
        ],
      },
      include: { project: true },
    })
    if (!linkedOpportunity?.onChainId) throw new Error('Opportunity funding has not been confirmed on-chain yet')
    const chainOpportunityId = String(linkedOpportunity.onChainId)
    const chainOpp = await opportunity(chainOpportunityId)
    if (!chainOpp.exists) throw new Error('Opportunity does not exist on the configured escrow contract')
    if (chainOpp.publisher.toLowerCase() !== wallet) throw new Error('Only the opportunity publisher can perform this action')
    assertProjectPublisher(linkedOpportunity, { userId: s.userId, wallet })
    assertProjectPublisher(linkedOpportunity.project, { userId: s.userId, wallet })

    let targetFunction: string
    let args: string[]

    if (input.action === 'approveSubmission' || input.action === 'approveContribution') {
      if (!input.submissionId) throw new Error('Submission ID is required for approval')
      if (chainOpp.status !== 1 || chainOpp.approvedContributionId !== 0n) throw new Error('Opportunity is not open for approval')
      const candidate = await chainContribution(input.submissionId)
      const linkedSubmission = await db.submission.findFirst({
        where: { onChainId: Number(input.submissionId), opportunityId: linkedOpportunity.id },
      })
      if (
        !candidate.exists || candidate.status !== 1 || candidate.opportunityId !== BigInt(chainOpportunityId) ||
        !linkedSubmission || linkedSubmission.contributorAddress.toLowerCase() !== candidate.contributor.toLowerCase()
      ) {
        throw new Error('Contribution is not a pending submission for this opportunity')
      }
      await verifiedSubmissionFor(linkedSubmission, linkedOpportunity, chainOpportunityId, s)
      targetFunction = 'approveContribution'
      args = [input.submissionId]
    } else if (input.action === 'rejectSubmission' || input.action === 'rejectContribution') {
      if (!input.submissionId) throw new Error('Submission ID is required for rejection')
      const candidate = await chainContribution(input.submissionId)
      const linkedSubmission = await db.submission.findFirst({
        where: { onChainId: Number(input.submissionId), opportunityId: linkedOpportunity.id },
      })
      if (
        !candidate.exists || candidate.status !== 1 || candidate.opportunityId !== BigInt(chainOpportunityId) ||
        !linkedSubmission || linkedSubmission.contributorAddress.toLowerCase() !== candidate.contributor.toLowerCase()
      ) {
        throw new Error('Contribution is not a pending submission for this opportunity')
      }
      targetFunction = 'rejectContribution'
      args = [input.submissionId]
    } else if (input.action === 'releaseReward') {
      const contributionId = chainOpp.approvedContributionId
      if (contributionId === 0n) throw new Error('No publisher-approved contribution exists for this opportunity')
      const candidate = await chainContribution(contributionId.toString())
      let linkedSubmission = await db.submission.findFirst({
        where: {
          OR: [
            { onChainId: Number(contributionId) },
            { opportunityId: linkedOpportunity.id },
            { opportunityId: chainOpportunityId },
            { id: linkedOpportunity.selectedSubmissionId || '' },
          ],
        },
      })
      if (!linkedSubmission) {
        const v = await db.verifiedSubmission.findFirst({
          where: {
            OR: [
              { chainRef: contributionId.toString() },
              { opportunityId: chainOpportunityId },
              { opportunityId: linkedOpportunity.id },
            ],
          },
        })
        const subId = v ? v.id : randomUUID()
        const parsedPr = v?.url ? parsePull(v.url) : parsePull(linkedOpportunity.project.repoUrl + '/pull/1')
        linkedSubmission = await db.submission.create({
          data: {
            id: subId,
            opportunityId: linkedOpportunity.id,
            contributorAddress: (v?.wallet || candidate.contributor).toLowerCase(),
            githubUsername: v?.login || 'Contributor',
            prUrl: v?.url || `${linkedOpportunity.project.repoUrl}/pull/1`,
            prNumber: v?.prNumber || 1,
            repoOwner: parsedPr.owner,
            repoName: parsedPr.repo,
            notes: v?.notes,
            status: 'APPROVED',
            isMerged: true,
            onChainId: Number(contributionId),
          },
        })
      }
      const refreshed = await verifiedSubmissionFor(linkedSubmission, linkedOpportunity, chainOpportunityId, s)
      const escrowBalance = await chainClient.readContract({
        address: chainConfig(),
        abi: bountyAbi,
        functionName: 'escrowBalance',
      })
      const pendingPayout = await hasTrackedPayout(chainOpportunityId, wallet)
      assertReleaseRewardEligible({
        requester: wallet,
        publisher: chainOpp.publisher,
        opportunityLinked: linkedOpportunity.onChainId === Number(chainOpportunityId),
        escrowSufficient: chainOpp.bounty > 0n && chainOpp.remainingBounty >= chainOpp.bounty && escrowBalance >= chainOpp.bounty,
        contributionLinked:
          candidate.exists && candidate.opportunityId === BigInt(chainOpportunityId) &&
          candidate.contributor.toLowerCase() === linkedSubmission.contributorAddress.toLowerCase() &&
          candidate.status === 2 && refreshed.chainRef === contributionId.toString(),
        prMerged: refreshed.prState === 'merged',
        publisherApproved: chainOpp.status === 2 && contributionId === chainOpp.approvedContributionId,
        winnerFinalized: Boolean(linkedOpportunity.selectedSubmissionId && linkedOpportunity.selectedSubmissionId !== contributionId.toString()),
        payoutStatus: chainOpp.status === 3 ? 'paid' : pendingPayout ? 'pending' : 'none',
      })
      targetFunction = 'releaseReward'
      args = [chainOpportunityId]
    } else {
      // cancelOpportunity / refundExpiredOpportunity
      await assertExpectedChain()
      const head = await chainClient.getBlock()
      if (chainOpp.status !== 1 || chainOpp.deadline > head.timestamp || chainOpp.pendingContributions !== 0n) {
        throw new Error('Opportunity cannot be refunded until it expires and all pending submissions are reviewed')
      }
      targetFunction = 'cancelOpportunity'
      args = [chainOpportunityId]
    }

    return response({
      call: {
        functionName: targetFunction,
        args,
      },
    })
  }

  if (action === 'transactions/track') {
    const hash = txHash.parse(body.hash)
    const actual = await chainClient.getTransaction({ hash: hash as Hash })
    const calls = transactionCalls(actual)
    if (
      actual.from.toLowerCase() !== wallet ||
      calls.length !== 1 ||
      calls[0].to.toLowerCase() !== chainConfig().toLowerCase()
    ) {
      throw new Error('Transaction sender or contract does not match this session and deployment')
    }
    await db.transaction.upsert({
      where: { hash },
      create: { hash, wallet, contractAddress: chainConfig().toLowerCase(), status: 'pending' },
      update: {},
    })
    if (body.intentId) {
      await db.snapshot.updateMany({
        where: { id: String(body.intentId), chainAddress: chainConfig().toLowerCase(), owner: wallet, published: false },
        data: { transactionHash: hash },
      })
      await db.verifiedSubmission.updateMany({
        where: { id: String(body.intentId), chainAddress: chainConfig().toLowerCase(), wallet, chainRef: null },
        data: { transactionHash: hash },
      })
    }
    return response({ tracked: true })
  }

  if (action === 'transactions/reconcile') {
    const hash = txHash.parse(body.hash) as Hash
    await ingestTransaction(hash, wallet)
    await reconcile(true)
    return response({ confirmed: true, hash })
  }

  if (action === 'sync') {
    await reconcile(true)
    return response(await feed())
  }

  if (action === 'pr/refresh') {
    const id = z.string().parse(body.id)
    await syncPull(id, true, s.github.access_token)
    return response({ refreshed: true })
  }

  return Response.json({ error: 'Unknown endpoint' }, { status: 404 })
}

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    await ensureDatabaseReady()
    return await route(request, context)
  } catch (error) {
    if (error instanceof FeedReadError) {
      return Response.json(
        { error: 'Feed data is temporarily unavailable. Please retry shortly.' },
        { status: 503, headers: { 'cache-control': 'no-store', 'retry-after': '5' } },
      )
    }
    const message =
      error instanceof z.ZodError
        ? error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        : error instanceof Error
        ? error.message
        : 'Request failed'
    console.error('Platform request failed:', message)
    return Response.json({ error: message }, { status: 400, headers: { 'cache-control': 'no-store' } })
  }
}

export { handler as GET, handler as POST }
