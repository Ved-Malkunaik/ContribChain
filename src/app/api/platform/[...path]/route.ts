import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { z } from 'zod'
import { keccak256, toHex, isAddress, verifyMessage, type Hash } from 'viem'
import { db } from '@/lib/server/db'
import { appOrigin, assertOrigin, currentSession, requireWallet, demoMode } from '@/lib/server/auth'
import { canonicalize, challengeMessage, parseRepo, parsePull, rewardWei } from '@/lib/security'
import { repository, pull, syncPull, matchesRegisteredRepository, committedProjectSnapshot } from '@/lib/server/github'
import type { VerifiedSubmission } from '@prisma/client'
import { chainConfig, chainClient, opportunity, reconcile, ingestTransaction, receipt, json } from '@/lib/server/chain'
import { bountyAbi } from '@/lib/contract'
import { feed } from '@/lib/server/feed'
import { projectInput, opportunityInput, submissionInput } from '@/lib/server/validation'
import { transactionCalls } from '@/lib/transaction-intent'
const txHash = z.string().regex(/^0x[a-fA-F0-9]{64}$/)
function response(value: unknown) { return new Response(json(value),{headers:{'content-type':'application/json','cache-control':'no-store'}}) }
const isDemo = (record: {githubId: string, reference: string}) => record.githubId.startsWith('demo:') && record.reference.startsWith('demo:')
type RegisteredProject = {repoId: string, publisher: string, metadataURI: string, metadataHash: string}
async function committedRepo(projectId: string, project: RegisteredProject) {
  const saved=await committedProjectSnapshot(projectId,project)
  if(!saved) throw new Error('Project metadata does not match its confirmed on-chain commitment')
  const metadata=z.object({repoUrl:z.string(),githubRepoId:z.string()}).parse(JSON.parse(saved.canonical))
  if(metadata.githubRepoId!==project.repoId) throw new Error('Project repository does not match the committed metadata')
  return parseRepo(metadata.repoUrl)
}
function assertPullRepo(url: ReturnType<typeof parsePull>, repo: ReturnType<typeof parseRepo>) {
  if(url.owner.toLowerCase()!==repo.owner.toLowerCase() || url.repo.toLowerCase()!==repo.repo.toLowerCase()) throw new Error('PR URL must belong to the committed project repository')
}
async function assertDemoSubmission(verified: VerifiedSubmission, opportunityId: string, projectId: string) {
  if(!demoMode() || !isDemo(verified)) throw new Error('Simulated PR actions require explicit local demo mode')
  if(!verified.chainRef || !verified.transactionHash) throw new Error('Demo submission must have a confirmed on-chain receipt')
  const sub=await chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getSubmission',args:[BigInt(verified.chainRef)]})
  const project=await chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getProject',args:[BigInt(projectId)]})
  if(sub.opportunityId.toString()!==opportunityId || sub.contributor.toLowerCase()!==verified.wallet || sub.prReference!==verified.reference || verified.repoId!==project.repoId || verified.githubId!=='demo:'+verified.wallet || verified.reference!==`demo:${project.repoId}:${verified.prNumber}`) throw new Error('Demo submission does not match its on-chain contributor and PR reference')
  const url=parsePull(verified.url)
  if(url.number!==verified.prNumber) throw new Error('Demo PR number does not match its recorded reference')
  assertPullRepo(url,await committedRepo(projectId,project))
  await receipt(verified.transactionHash as Hash)
  return sub
}
async function snapshot(kind: string, owner: string, metadata: object, repoId?: string, parentId?: string) {
  const id=randomUUID()
  const canonical=canonicalize({...metadata,snapshotId:id,version:1})
  const hash=keccak256(toHex(canonical))
  const uri=`${appOrigin()}/api/platform/metadata/${id}`
  return db.snapshot.create({data:{id,kind,owner,chainAddress:chainConfig().toLowerCase(),canonical,hash,uri,repoId,parentId}})
}
async function route(request: Request, context: {params:Promise<{path:string[]}>}) {
  const {path} = await context.params
  const action=path.join('/')
  if (request.method==='GET') {
    if(action==='feed') return response(await feed())
    if(path[0]==='metadata' && path.length===2) {
      const m=await db.snapshot.findUniqueOrThrow({where:{id:path[1]}})
      return new Response(m.canonical,{headers:{'content-type':'application/json','cache-control':'public, max-age=31536000, immutable'}})
    }
    if(action==='session') {
      const s=await currentSession(request)
      return response(s ? {authenticated:true,githubId:s.github.providerAccountId,name:s.user.name,wallet:s.wallet,demoMode:demoMode()} : {authenticated:false,demoMode:demoMode()})
    }
    return response({error:'Unknown endpoint'})
  }
  assertOrigin(request)
  const body=await request.json()
  if(action==='wallet/clear') {
    const s=await currentSession(request)
    if(s && !s.github.providerAccountId.startsWith('demo:')) { await db.session.update({where:{id:s.id},data:{wallet:null,generation:{increment:1}}}); await db.challenge.updateMany({where:{sessionId:s.id},data:{consumed:true}}) }
    return response({cleared:true})
  }
  if(action==='wallet/challenge') {
    const s=await currentSession(request)
    if(!s) throw new Error('Sign in with GitHub first')
    const address=z.string().refine(isAddress).parse(body.address).toLowerCase()
    const expires=new Date(Date.now()+5*60000)
    const nonce=randomBytes(24).toString('hex')
    const message=challengeMessage(appOrigin(),createHash('sha256').update(s.id).digest('hex'),address,nonce,expires.toISOString())
    await db.challenge.updateMany({where:{sessionId:s.id},data:{consumed:true}})
    const updated=await db.session.update({where:{id:s.id},data:{wallet:null,generation:{increment:1}}})
    const challenge=await db.challenge.create({data:{sessionId:s.id,address,message,expires,generation:updated.generation}})
    return response({id:challenge.id,message})
  }
  if(action==='wallet/verify') {
    const s=await currentSession(request)
    if(!s) throw new Error('Session expired')
    const input=z.object({id:z.string(),signature:z.string().regex(/^0x[0-9a-f]+$/i)}).parse(body)
    const c=await db.challenge.findUniqueOrThrow({where:{id:input.id}})
    if(c.sessionId!==s.id || c.consumed || c.expires<=new Date() || c.generation!==s.generation) throw new Error('Challenge expired or already used')
    const claimed=await db.challenge.updateMany({where:{id:c.id,consumed:false,expires:{gt:new Date()}},data:{consumed:true}})
    if(claimed.count!==1 || !await verifyMessage({address:c.address as `0x${string}`,message:c.message,signature:input.signature as `0x${string}`})) throw new Error('Invalid wallet signature')
    const prior=await db.walletLink.findUnique({where:{address:c.address}})
    if(prior && prior.githubId!==s.github.providerAccountId) throw new Error('This wallet is linked to another GitHub identity')
    await db.$transaction(async tx=>{
      const bound=await tx.session.updateMany({where:{id:s.id,generation:c.generation},data:{wallet:c.address}})
      if(bound.count!==1) throw new Error('Wallet changed while verifying; request a new challenge')
      const existing=await tx.walletLink.findUnique({where:{address:c.address}})
      if(existing && existing.githubId!==s.github.providerAccountId) throw new Error('Wallet already belongs to another GitHub identity')
      await tx.walletLink.upsert({where:{address:c.address},create:{address:c.address,userId:s.userId,githubId:s.github.providerAccountId},update:{userId:s.userId}})
    })
    return response({linked:true})
  }
  const s=await requireWallet(request)
  const wallet=s.wallet!
  if(action==='projects/prepare') {
    chainConfig()
    const input=projectInput.parse(body)
    const {owner,repo}=parseRepo(input.repoUrl)
    const gh=await repository(owner,repo,s.github.access_token)
    if(!demoMode() && (gh.owner.type!=='User' || String(gh.owner.id)!==s.github.providerAccountId)) {
      throw new Error('Use a public repository owned by your authenticated GitHub user; organization repositories are deferred')
    }
    const m=await snapshot('project',wallet,{...input,technologies:input.technologies.split(',').map(x=>x.trim()).filter(Boolean),repoUrl:gh.html_url,githubRepoId:String(gh.id),...(demoMode()?{simulated:true}:{})},String(gh.id))
    return response({intentId:m.id,call:{functionName:'registerProject',args:[String(gh.id),m.uri,m.hash]}})
  }
  if(action==='opportunities/prepare') {
    const input=opportunityInput.parse(body)
    const project=await db.snapshot.findFirstOrThrow({where:{chainAddress:chainConfig().toLowerCase(),kind:'project',chainRef:input.projectId,published:true,owner:wallet}})
    const state=await chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getProject',args:[BigInt(input.projectId)]})
    if(state.publisher.toLowerCase()!==wallet || state.repoId!==project.repoId || state.metadataHash!==project.hash) throw new Error('Project ownership or metadata does not match the contract')
    const metadata=JSON.parse(project.canonical)
    if(input.issueUrl) {
      const u=new URL(input.issueUrl)
      const repo=parseRepo(metadata.repoUrl)
      if(u.origin!=='https://github.com' || u.search || u.hash || u.username || u.password || !new RegExp(`^/${repo.owner}/${repo.repo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/issues/[1-9]\\d*$`,'i').test(u.pathname)) throw new Error('Issue must belong to the registered GitHub repository')
    }
    const latest=await chainClient.getBlock()
    const deadline=latest.timestamp+BigInt(input.deadlineDays)*86400n
    const reward=rewardWei(input.rewardEth)
    const m=await snapshot('opportunity',wallet,{...input,requiredSkills:input.requiredSkills.split(',').map(x=>x.trim()).filter(Boolean),deadline:new Date(Number(deadline)*1000).toISOString()},project.repoId!,input.projectId)
    return response({intentId:m.id,call:{functionName:'createOpportunity',args:[input.projectId,reward.toString(),deadline.toString(),m.uri,m.hash],value:reward.toString()}})
  }
  if(action==='submissions/prepare') {
    const input=submissionInput.parse(body)
    const state=await opportunity(input.opportunityId)
    const block=await chainClient.getBlock()
    if(state.state!==0 || state.deadline<=block.timestamp) throw new Error('Submissions require an open opportunity before its deadline')
    const project=await chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getProject',args:[state.projectId]})
    const url=parsePull(input.prUrl)
    if(demoMode()) {
      assertPullRepo(url,await committedRepo(state.projectId.toString(),project))
      const id=randomUUID(),reference=`demo:${project.repoId}:${url.number}`
      await db.verifiedSubmission.create({data:{id,chainAddress:chainConfig().toLowerCase(),opportunityId:input.opportunityId,wallet,githubId:'demo:'+wallet,repoId:project.repoId,prNumber:url.number,reference,url:input.prUrl,title:`Simulated PR #${url.number}`,login:'Demo contributor',notes:input.notes,prState:'open',commit:'',syncedAt:new Date(),nextSyncAt:new Date(Date.now()+86400000)}})
      return response({intentId:id,simulated:true,call:{functionName:'submitContribution',args:[input.opportunityId,reference]}})
    }
    const repo=await repository(url.owner,url.repo,s.github.access_token)
    if(!await matchesRegisteredRepository(String(repo.id),state.projectId.toString(),project,s.github.access_token)) throw new Error('PR must target the registered repository')
    const pr=await pull(String(repo.id),url.number,s.github.access_token)
    if(String(pr.user.id)!==s.github.providerAccountId || String(pr.base.repo.id)!==String(repo.id)) throw new Error('PR author must be your linked GitHub identity and target the registered repository')
    if(pr.state==='closed' && !pr.merged) throw new Error('Closed, unmerged PRs cannot be submitted')
    const id=randomUUID(), reference=`${repo.id}:${url.number}`
    await db.verifiedSubmission.create({data:{id,chainAddress:chainConfig().toLowerCase(),opportunityId:input.opportunityId,wallet,githubId:s.github.providerAccountId,repoId:String(repo.id),prNumber:url.number,reference,url:pr.html_url,title:pr.title,login:pr.user.login,notes:input.notes,prState:pr.merged?'merged':pr.state,commit:pr.head.sha,syncedAt:new Date(),nextSyncAt:new Date(Date.now()+15000)}})
    return response({intentId:id,call:{functionName:'submitContribution',args:[input.opportunityId,reference]}})
  }
  if(action==='demo/pr/merge') {
    if(!demoMode()) throw new Error('Simulated PR actions require explicit local demo mode')
    const id=z.string().parse(body.id)
    const verified=await db.verifiedSubmission.findFirstOrThrow({where:{id,chainAddress:chainConfig().toLowerCase()}})
    const state=await opportunity(verified.opportunityId)
    if(state.publisher.toLowerCase()!==wallet) throw new Error('Only the on-chain publisher may simulate PR merge')
    if(state.state!==0 && state.state!==1) throw new Error('Demo opportunity is already closed')
    await assertDemoSubmission(verified,verified.opportunityId,state.projectId.toString())
    await db.verifiedSubmission.update({where:{id},data:{prState:'merged',syncedAt:new Date(),syncError:null}})
    return response({simulated:true,merged:true})
  }
  if(action==='actions/prepare') {
    const input=z.object({action:z.enum(['approveSubmission','rejectSubmission','releaseReward','refundExpiredOpportunity']),opportunityId:z.string().regex(/^[1-9]\d*$/),submissionId:z.string().regex(/^[1-9]\d*$/).optional()}).parse(body)
    const state=await opportunity(input.opportunityId)
    if(state.publisher.toLowerCase()!==wallet) throw new Error('Only the on-chain publisher may review or pay')
    if(input.action==='releaseReward') {
      if(state.state!==1 || state.remainingEscrow!==state.rewardAmount) throw new Error('Opportunity is not approved and unpaid')
      const sub=await chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getSubmission',args:[state.selectedSubmissionId]})
      const verified=await db.verifiedSubmission.findFirstOrThrow({where:{chainAddress:chainConfig().toLowerCase(),chainRef:sub.id.toString(),opportunityId:input.opportunityId,wallet:sub.contributor.toLowerCase(),reference:sub.prReference}})
      const project=await chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getProject',args:[state.projectId]})
      if(sub.status!==1) throw new Error('Selected submission is not approved')
      if(isDemo(verified)) {
        await assertDemoSubmission(verified,input.opportunityId,state.projectId.toString())
        if(verified.prState!=='merged') throw new Error('The simulated PR must be marked merged before reward release')
      } else {
        if(!await matchesRegisteredRepository(verified.repoId,state.projectId.toString(),project,s.github.access_token)) throw new Error('Selected PR does not match the registered repository and winner')
        if(!verified.transactionHash) throw new Error('Verified submission has no confirmed chain receipt')
        await receipt(verified.transactionHash as Hash)
        await syncPull(verified.id,true,s.github.access_token)
        const fresh=await db.verifiedSubmission.findUniqueOrThrow({where:{id:verified.id}})
        if(fresh.prState!=='merged' || fresh.syncError || Date.now()-fresh.syncedAt.getTime()>15000) throw new Error('The exact approved PR is not freshly verified as merged')
      }
    } else if(input.action.includes('Submission')) {
      if(!input.submissionId) throw new Error('Submission ID is required')
      const verified=await db.verifiedSubmission.findFirst({where:{chainAddress:chainConfig().toLowerCase(),chainRef:input.submissionId,opportunityId:input.opportunityId}})
      if(!verified) throw new Error('Direct contract submission has no verified GitHub author; normal review is unavailable')
      if(isDemo(verified)) {
        await assertDemoSubmission(verified,input.opportunityId,state.projectId.toString())
      } else await syncPull(verified.id,true,s.github.access_token)
    }
    const args=input.action.includes('Submission') ? [input.opportunityId,input.submissionId!] : [input.opportunityId]
    return response({call:{functionName:input.action,args}})
  }
  if(action==='transactions/track') {
    const hash=txHash.parse(body.hash)
    const actual=await chainClient.getTransaction({hash:hash as Hash})
    const calls=transactionCalls(actual)
    if(actual.from.toLowerCase()!==wallet || calls.length!==1 || calls[0].to.toLowerCase()!==chainConfig().toLowerCase()) throw new Error('Transaction sender or contract does not match this session and deployment')
    await db.transaction.upsert({where:{hash},create:{hash,wallet,contractAddress:chainConfig().toLowerCase(),status:'pending'},update:{}})
    if(body.intentId) {
      await db.snapshot.updateMany({where:{id:String(body.intentId),chainAddress:chainConfig().toLowerCase(),owner:wallet,published:false},data:{transactionHash:hash}})
      await db.verifiedSubmission.updateMany({where:{id:String(body.intentId),chainAddress:chainConfig().toLowerCase(),wallet,chainRef:null},data:{transactionHash:hash}})
    }
    return response({tracked:true})
  }
  if(action==='transactions/reconcile') {
    const hash=txHash.parse(body.hash) as Hash
    await ingestTransaction(hash,wallet)
    await reconcile(true)
    return response({confirmed:true,hash})
  }
  if(action==='sync') { await reconcile(true); return response(await feed()) }
  if(action==='pr/refresh') {
    const id=z.string().parse(body.id)
    // Shared server TTL and backoff apply to manual refresh too.
    await syncPull(id,false,s.github.access_token)
    return response({refreshed:true})
  }
  return Response.json({error:'Unknown endpoint'},{status:404})
}
async function handler(request: Request, context: {params:Promise<{path:string[]}>}) {
  try {return await route(request,context)}
  catch(error) {
    const message=error instanceof z.ZodError ? error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ') : error instanceof Error ? error.message : 'Request failed'
    console.error('Platform request failed:', message)
    return Response.json({error:message},{status:400,headers:{'cache-control':'no-store'}})
  }
}
export {handler as GET,handler as POST}
