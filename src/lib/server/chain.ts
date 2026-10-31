import { decodeEventLog, createPublicClient, http, keccak256, toHex, type Hash, type Address } from 'viem'
import { activeChain, bountyAbi, contractAddress, deploymentBlock, networkName } from '../contract'
import { db } from './db'
import { rewardWei } from '../security'
import { z } from 'zod'

export const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v)

export const chainClient = createPublicClient({
  chain: activeChain,
  transport: http(
    process.env.MSTC_RPC_URL ||
    process.env.NEXT_PUBLIC_MSTC_RPC_URL ||
    process.env.MST_RPC_URL ||
    process.env.NEXT_PUBLIC_MST_RPC_URL ||
    'https://mariorpc.mstblockchain.com/'
  ),
})

export function chainConfig(): Address {
  if (!contractAddress) throw new Error(`${networkName} contract address is not configured`)
  return contractAddress
}

export async function assertExpectedChain() {
  const actual = await chainClient.getChainId()
  if (actual !== activeChain.id) {
    throw new Error(`RPC chain ID mismatch: expected ${activeChain.id}, received ${actual}`)
  }
}

export async function receipt(hash: Hash) {
  const address = chainConfig()
  await assertExpectedChain()
  const r = await chainClient.getTransactionReceipt({ hash })
  if (
    r.to?.toLowerCase() !== address.toLowerCase() &&
    !r.logs.some(log => log.address.toLowerCase() === address.toLowerCase())
  ) {
    throw new Error('Transaction targets another contract')
  }
  const head = await chainClient.getBlockNumber({ cacheTime: 0 })
  if (head < r.blockNumber) throw new Error('Awaiting chain confirmation')
  if (r.status !== 'success') {
    await db.transaction.updateMany({
      where: { hash, contractAddress: address.toLowerCase() },
      data: { status: 'failed', blockNumber: r.blockNumber.toString() },
    })
    throw new Error('Transaction reverted; no state change was accepted')
  }
  return r
}

let running: Promise<void> | null = null
let lastScan = 0

export async function reconcile(force = false) {
  if (running) return running
  if (!force && Date.now() - lastScan < 15000) return
  running = indexChain()
  try {
    await running
    lastScan = Date.now()
  } finally {
    running = null
  }
}

async function indexChain() {
  const address = chainConfig()
  const key = `${activeChain.id}:${address.toLowerCase()}`
  const checkpoint = await db.checkpoint.findUnique({ where: { id: key } })
  const start = BigInt(deploymentBlock || '0')
  const previous = checkpoint ? BigInt(checkpoint.block) : start
  let from = previous > start + 12n ? previous - 12n : start

  let head: bigint
  try {
    await assertExpectedChain()
    head = await chainClient.getBlockNumber({ cacheTime: 0 })
  } catch (err) {
    console.warn('Could not read block number from MST RPC:', err)
    return
  }

  // To prevent unbounded historical block scanning on large testnets, bound `from`
  if (head > 1000n && from < head - 1000n && !checkpoint) {
    from = head - 1000n
  }

  const safe = head
  if (from > safe) from = safe

  for (let range = 0; range < 5 && from <= safe; range++) {
    const to = from + 1999n < safe ? from + 1999n : safe
    try {
      const logs = await chainClient.getContractEvents({
        address,
        abi: bountyAbi,
        fromBlock: from,
        toBlock: to,
        strict: false,
      })
      for (const log of logs) {
        try {
          const r = await receipt(log.transactionHash)
          await storeLog(log, r)
        } catch {
          // Individual log receipt failure should not break indexing
        }
      }
      await db.checkpoint.upsert({
        where: { id: key },
        create: { id: key, block: to.toString() },
        update: { block: to.toString() },
      })
    } catch (scanErr) {
      console.warn('MST log scanning range failed:', scanErr)
      break
    }
    from = to + 1n
  }
}

export async function opportunity(id: string) {
  if (!/^[1-9]\d*$/.test(id)) throw new Error('Invalid opportunity ID')
  await assertExpectedChain()
  const opp = await chainClient.readContract({
    address: chainConfig(),
    abi: bountyAbi,
    functionName: 'opportunities',
    args: [BigInt(id)],
  })

  // [id, projectRef, metadataHash, publisher, bounty, remainingBounty, deadline, approvedContributionId, pendingContributions, status, exists]
  return {
    id: opp[0],
    projectRef: opp[1],
    metadataHash: opp[2],
    publisher: opp[3],
    bounty: opp[4],
    remainingBounty: opp[5],
    deadline: opp[6],
    approvedContributionId: opp[7],
    pendingContributions: opp[8],
    status: opp[9], // 0: NONE, 1: OPEN, 2: REWARD_PENDING, 3: PAID, 4: CANCELLED
    exists: opp[10],
    // Compatibility fields
    rewardAmount: opp[4],
    remainingEscrow: opp[5],
    state: opp[9] === 1 ? 0 : opp[9] === 2 ? 1 : opp[9] === 3 ? 2 : opp[9] === 4 ? 3 : 0,
    selectedSubmissionId: opp[7],
    projectId: 0n,
  }
}

export async function contribution(id: string) {
  if (!/^[1-9]\d*$/.test(id)) throw new Error('Invalid contribution ID')
  await assertExpectedChain()
  const sub = await chainClient.readContract({
    address: chainConfig(),
    abi: bountyAbi,
    functionName: 'contributions',
    args: [BigInt(id)],
  })
  return {
    id: sub[0],
    opportunityId: sub[1],
    contributor: sub[2],
    submissionHash: sub[3],
    status: sub[4],
    exists: sub[5],
  }
}

async function storeLog(
  log: { transactionHash: Hash; logIndex: number; blockNumber: bigint; eventName: string; args: unknown },
  r: { from: Address; blockNumber: bigint }
) {
  const id = `${activeChain.id}:${log.transactionHash}:${log.logIndex}`
  const args = log.args as Record<string, unknown>

  await db.chainEvent.upsert({
    where: { id },
    create: {
      id,
      chainId: activeChain.id,
      contractAddress: chainConfig().toLowerCase(),
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
      blockNumber: log.blockNumber.toString(),
      eventName: log.eventName,
      payload: json(args),
    },
    update: { payload: json(args) },
  })

  await db.transaction.upsert({
    where: { hash: log.transactionHash },
    create: {
      hash: log.transactionHash,
      contractAddress: chainConfig().toLowerCase(),
      wallet: r.from.toLowerCase(),
      status: 'confirmed',
      blockNumber: r.blockNumber.toString(),
    },
    update: {
      status: 'confirmed',
      blockNumber: r.blockNumber.toString(),
    },
  })

  if (log.eventName === 'OpportunityCreated') {
    const metadataHash = String(args.metadataHash).toLowerCase()
    const publisher = String(args.publisher).toLowerCase()
    const snapshot = await db.snapshot.findUnique({ where: { hash: metadataHash } })
    if (
      !snapshot || snapshot.kind !== 'opportunity' || snapshot.chainAddress !== chainConfig().toLowerCase() ||
      snapshot.owner.toLowerCase() !== publisher || keccak256(toHex(snapshot.canonical)).toLowerCase() !== metadataHash
    ) return

    let metadata: { rewardEth: string; deadline: string }
    try {
      metadata = z.object({ rewardEth: z.string(), deadline: z.string().datetime() }).parse(JSON.parse(snapshot.canonical))
    } catch {
      return
    }
    const project = snapshot.parentId ? await db.project.findUnique({ where: { id: snapshot.parentId } }) : null
    const matchingOpportunity = await db.opportunity.findFirst({ where: { metadataHash, metadataURI: snapshot.uri, projectId: snapshot.parentId || '' } })
    if (
      !project || !matchingOpportunity ||
      project.publisherAddress.toLowerCase() !== publisher ||
      matchingOpportunity.publisherAddress.toLowerCase() !== publisher ||
      matchingOpportunity.deadline.getTime() !== new Date(metadata.deadline).getTime() ||
      matchingOpportunity.rewardWei !== rewardWei(metadata.rewardEth).toString() ||
      String(args.projectRef).toLowerCase() !== keccak256(toHex(project.id)).toLowerCase() ||
      BigInt(args.bounty as bigint) !== BigInt(matchingOpportunity.rewardWei) ||
      BigInt(args.deadline as bigint) !== BigInt(Math.floor(matchingOpportunity.deadline.getTime() / 1000))
    ) return

    const onChainOppIdNum = Number(args.opportunityId)
    await db.opportunity.updateMany({
      where: { onChainId: onChainOppIdNum, id: { not: matchingOpportunity.id } },
      data: { onChainId: null },
    })

    await db.$transaction([
      db.snapshot.update({
        where: { id: snapshot.id },
        data: { published: true, chainRef: String(args.opportunityId), transactionHash: log.transactionHash },
      }),
      db.opportunity.update({
        where: { id: matchingOpportunity.id },
        data: { onChainId: onChainOppIdNum, state: 'OPEN', txHash: log.transactionHash },
      }),
    ])
  }

  if (log.eventName === 'ContributionSubmitted') {
    const draft = await db.verifiedSubmission.findFirst({
      where: {
        chainAddress: chainConfig().toLowerCase(),
        opportunityId: String(args.opportunityId),
        wallet: String(args.contributor).toLowerCase(),
      },
    })
    if (draft) {
      await db.$transaction([
        db.verifiedSubmission.update({
          where: { id: draft.id },
          data: { chainRef: String(args.contributionId) },
        }),
        db.submission.updateMany({
          where: { id: draft.id },
          data: { onChainId: Number(args.contributionId), txHash: log.transactionHash },
        }),
      ])
    }
  }

  if (log.eventName === 'ContributionReviewed' || log.eventName === 'RewardApproved') {
    const contributionId = Number(args.contributionId)
    const isApproved =
      log.eventName === 'RewardApproved' || Number(args.status) === 2
    const status = isApproved ? 'APPROVED' : Number(args.status) === 3 ? 'REJECTED' : 'PENDING'

    await db.submission.updateMany({
      where: { onChainId: contributionId },
      data: { status },
    })
    if (isApproved) {
      await db.opportunity.updateMany({
        where: { onChainId: Number(args.opportunityId) },
        data: { state: 'APPROVED', selectedSubmissionId: String(contributionId) },
      })
    }
  }

  if (log.eventName === 'RewardReleased') {
    const contributionId = Number(args.contributionId)
    await db.submission.updateMany({
      where: { onChainId: contributionId },
      data: { status: 'PAID', paidTxHash: log.transactionHash },
    })
    await db.opportunity.updateMany({
      where: { onChainId: Number(args.opportunityId) },
      data: { state: 'PAID' },
    })
  }

  if (log.eventName === 'OpportunityCancelled' || log.eventName === 'BountyRefunded') {
    await db.opportunity.updateMany({
      where: { onChainId: Number(args.opportunityId) },
      data: { state: 'REFUNDED' },
    })
  }
}

export async function ingestTransaction(hash: Hash, wallet: string) {
  const r = await receipt(hash)
  if (r.from.toLowerCase() !== wallet.toLowerCase()) {
    throw new Error('Receipt sender differs from linked wallet')
  }
  for (const log of r.logs.filter(l => l.address.toLowerCase() === chainConfig().toLowerCase())) {
    try {
      const decoded = decodeEventLog({
        abi: bountyAbi,
        data: log.data,
        topics: log.topics,
        strict: false,
      })
      await storeLog(
        {
          transactionHash: r.transactionHash,
          logIndex: log.logIndex,
          blockNumber: r.blockNumber,
          eventName: decoded.eventName,
          args: decoded.args,
        },
        r
      )
    } catch (error) {
      if (error instanceof Error && /event signature|decode|data size/i.test(error.message)) {
        continue
      }
      throw error
    }
  }
}
