import { decodeEventLog, createPublicClient, http, keccak256, toHex, type Hash, type Address } from 'viem'
import { sepolia } from 'viem/chains'
import { bountyAbi, contractAddress, deploymentBlock } from '../contract'
import { db } from './db'
import { rewardWei } from '../security'
export const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v)
export const chainClient = createPublicClient({chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com')})
export function chainConfig() {
  if (!contractAddress || !deploymentBlock || !/^\d+$/.test(deploymentBlock)) throw new Error('Sepolia contract address and deployment block are not configured')
  return contractAddress
}
export async function receipt(hash: Hash) {
  const address = chainConfig()
  const r = await chainClient.getTransactionReceipt({hash})
  // MetaMask smart-account transactions target its delegation manager, while
  // the successful inner escrow call emits logs from our deployed contract.
  if (r.to?.toLowerCase() !== address.toLowerCase() && !r.logs.some(log=>log.address.toLowerCase()===address.toLowerCase())) throw new Error('Transaction targets another contract')
  const head = await chainClient.getBlockNumber({cacheTime:0})
  if (head < r.blockNumber + 1n) throw new Error('Awaiting two chain confirmations')
  const block = await chainClient.getBlock({blockNumber:r.blockNumber})
  if (block.hash !== r.blockHash) throw new Error('Receipt is not on the canonical chain')
  if (r.status !== 'success') {
    await db.transaction.updateMany({where:{hash,contractAddress:address.toLowerCase()},data:{status:'failed',blockNumber:r.blockNumber.toString()}})
    throw new Error('Transaction reverted; no state change was accepted')
  }
  return r
}
let running: Promise<void> | null = null
let lastScan = 0
export async function reconcile(force = false) {
  if (running) return running
  if (!force && Date.now()-lastScan < 15000) return
  running = indexChain()
  try { await running; lastScan = Date.now() } finally { running = null }
}
async function indexChain() {
  const address = chainConfig()
  const key = `${sepolia.id}:${address.toLowerCase()}`
  const checkpoint = await db.checkpoint.findUnique({where:{id:key}})
  const start = BigInt(deploymentBlock!)
  const previous = checkpoint ? BigInt(checkpoint.block) : start
  let from = previous > start + 12n ? previous - 12n : start
  const head = await chainClient.getBlockNumber({cacheTime:0})
  if (head < 2n) return
  const safe = head - 1n
  // Overlap recent blocks; prune logs whose receipt was removed by a reorganization.
  const recent = await db.chainEvent.findMany({where:{chainId:sepolia.id,contractAddress:address.toLowerCase()}})
  for (const event of recent.filter(e => BigInt(e.blockNumber) >= from)) {
    try {
      const r = await receipt(event.transactionHash as Hash)
      if (!r.logs.some(l => l.logIndex === event.logIndex && l.address.toLowerCase() === address.toLowerCase())) throw new Error('Log removed')
    } catch (error) {
      // RPC failures must not delete valid events. Only a proven missing/canonical mismatch is removable.
      const message = error instanceof Error ? error.message : ''
      if (!/not found|canonical|Log removed/i.test(message)) throw error
      await db.chainEvent.delete({where:{id:event.id}})
      await db.snapshot.updateMany({where:{transactionHash:event.transactionHash},data:{published:false,chainRef:null}})
      await db.verifiedSubmission.updateMany({where:{transactionHash:event.transactionHash},data:{chainRef:null}})
    }
  }
  for (let range=0; range<5 && from<=safe; range++) {
    const to = from+1999n < safe ? from+1999n : safe
    const logs = await chainClient.getContractEvents({address,abi:bountyAbi,fromBlock:from,toBlock:to,strict:true})
    for (const log of logs) {
      const r = await receipt(log.transactionHash)
      await storeLog(log,r)
    }
    await db.checkpoint.upsert({where:{id:key},create:{id:key,block:to.toString()},update:{block:to.toString()}})
    from=to+1n
  }
}
export async function opportunity(id: string) {
  if (!/^[1-9]\d*$/.test(id)) throw new Error('Invalid opportunity ID')
  return chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getOpportunity',args:[BigInt(id)]})
}

async function storeLog(log:{transactionHash:Hash;logIndex:number;blockNumber:bigint;eventName:string;args:unknown},r:{from:Address;blockNumber:bigint}) {
      const id = `${sepolia.id}:${log.transactionHash}:${log.logIndex}`
      const args = log.args as Record<string, unknown>
      await db.chainEvent.upsert({where:{id},create:{id,chainId:sepolia.id,contractAddress:chainConfig().toLowerCase(),transactionHash:log.transactionHash,logIndex:log.logIndex,blockNumber:log.blockNumber.toString(),eventName:log.eventName,payload:json(args)},update:{payload:json(args)}})
      await db.transaction.upsert({where:{hash:log.transactionHash},create:{hash:log.transactionHash,contractAddress:chainConfig().toLowerCase(),wallet:r.from.toLowerCase(),status:'confirmed',blockNumber:r.blockNumber.toString()},update:{status:'confirmed',blockNumber:r.blockNumber.toString()}})
      if (log.eventName === 'ProjectRegistered' || log.eventName === 'OpportunityCreated') {
        const hash = String(args.metadataHash)
        const snapshot = await db.snapshot.findUnique({where:{hash}})
        const ref = String(args.projectId)
        const m=snapshot ? JSON.parse(snapshot.canonical) : null
        const fundingMatches=snapshot?.kind!=='opportunity' || (String(args.rewardAmount)===rewardWei(m.rewardEth).toString() && String(args.deadline)===String(Math.floor(new Date(m.deadline).getTime()/1000)))
        if (fundingMatches && snapshot && snapshot.chainAddress===chainConfig().toLowerCase() && snapshot.uri === args.metadataURI && snapshot.owner === String(args.publisher).toLowerCase() && keccak256(toHex(snapshot.canonical)) === hash && snapshot.kind === (log.eventName === 'ProjectRegistered' ? 'project' : 'opportunity') && (snapshot.kind === 'project' ? snapshot.repoId === String(args.repoId) : snapshot.parentId === ref)) {
          await db.snapshot.update({where:{id:snapshot.id},data:{published:true,chainRef:String(log.eventName === 'ProjectRegistered' ? args.projectId : args.opportunityId),transactionHash:log.transactionHash}})
        }
      }
      if (log.eventName === 'ContributionSubmitted') {
        // Only prepared author-verified submissions can gain the application's verified label.
        const draft = await db.verifiedSubmission.findFirst({where:{chainAddress:chainConfig().toLowerCase(),transactionHash:log.transactionHash,opportunityId:String(args.opportunityId),wallet:String(args.contributor).toLowerCase(),reference:String(args.prReference)}})
        if (draft) await db.verifiedSubmission.update({where:{id:draft.id},data:{chainRef:String(args.submissionId)}})
      }
}

export async function ingestTransaction(hash:Hash,wallet:string) {
  const r=await receipt(hash)
  if(r.from.toLowerCase()!==wallet) throw new Error('Receipt sender differs from linked wallet')
  for(const log of r.logs.filter(l=>l.address.toLowerCase()===chainConfig().toLowerCase())) {
    try {
      const decoded=decodeEventLog({abi:bountyAbi,data:log.data,topics:log.topics,strict:true})
      await storeLog({transactionHash:r.transactionHash,logIndex:log.logIndex,blockNumber:r.blockNumber,eventName:decoded.eventName,args:decoded.args},r)
    } catch(error) {
      if(error instanceof Error && /event signature|decode|data size/i.test(error.message)) continue
      throw error
    }
  }
}
