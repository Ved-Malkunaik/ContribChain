import { formatEther, parseEther } from 'viem'
import { bountyAbi, contractAddress, deploymentBlock } from '../contract'
import { chainClient, chainConfig, reconcile } from './chain'
import { db } from './db'
import { refreshDuePulls } from './github'
import { demoMode } from './auth'
import type { Project, Opportunity, Submission } from '@/types'
export async function feed() {
  const configured = Boolean(contractAddress && deploymentBlock)
  const empty = { projects: [] as Project[], opportunities: [] as Opportunity[], submissions: [] as Submission[], transactions: [] as {hash:string;wallet:string;status:string}[], configured, demoMode:demoMode(), syncError: null as string | null }
  if (!configured) {
    const dbProjects = await db.project.findMany({ include: { opportunities: true } }).catch(() => [])
    const mappedProjects = dbProjects.map(p => {
      let techs: string[] = []
      try { techs = JSON.parse(p.technologies) } catch { techs = [p.technologies] }
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
        opportunitiesCount: p.opportunities.length,
        createdAt: p.createdAt.toISOString(),
      }
    })
    const dbOpps = await db.opportunity.findMany({ include: { project: true, submissions: true } }).catch(() => [])
    const mappedOpps = dbOpps.map(o => {
      let skills: string[] = []
      try { skills = JSON.parse(o.requiredSkills) } catch { skills = [o.requiredSkills] }
      return {
        id: o.id,
        onChainId: o.onChainId || 0,
        projectId: o.projectId,
        publisherAddress: o.publisherAddress,
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
        state: o.state as Opportunity['state'],
        selectedSubmissionId: o.selectedSubmissionId || undefined,
        createdAt: o.createdAt.toISOString(),
      }
    })
    return {
      ...empty,
      projects: mappedProjects,
      opportunities: mappedOpps,
      syncError: 'Escrow contract is pending deployment on Sepolia testnet. Showing local / persistent database records.',
    }
  }
  try { await reconcile(); await refreshDuePulls() } catch(error) { empty.syncError = error instanceof Error ? error.message : 'Chain synchronization unavailable' }
  const snapshots = await db.snapshot.findMany({where:{published:true,chainAddress:chainConfig().toLowerCase()},take:200,orderBy:{createdAt:'desc'}})
  for (const snapshot of snapshots) {
    if (!snapshot.chainRef) continue
    const metadata = JSON.parse(snapshot.canonical)
    try {
      if (snapshot.kind === 'project') {
        const state = await chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getProject',args:[BigInt(snapshot.chainRef)]})
        if (state.metadataHash !== snapshot.hash || state.metadataURI !== snapshot.uri || state.publisher.toLowerCase() !== snapshot.owner) continue
        empty.projects.push({...metadata,id:snapshot.chainRef,onChainId:Number(snapshot.chainRef),publisherAddress:state.publisher,createdAt:new Date(Number(state.createdAt)*1000).toISOString()})
      } else {
        const state = await chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getOpportunity',args:[BigInt(snapshot.chainRef)]})
        if (state.metadataHash !== snapshot.hash || state.metadataURI !== snapshot.uri || state.publisher.toLowerCase() !== snapshot.owner) continue
        empty.opportunities.push({...metadata,id:snapshot.chainRef,onChainId:Number(snapshot.chainRef),projectId:state.projectId.toString(),publisherAddress:state.publisher,rewardEth:formatEther(state.rewardAmount),remainingEscrowEth:formatEther(state.remainingEscrow),deadline:new Date(Number(state.deadline)*1000).toISOString(),state:['Open','Approved','Paid','Refunded'][state.state] as Opportunity['state'],selectedSubmissionId:state.selectedSubmissionId.toString(),createdAt:new Date(Number(state.createdAt)*1000).toISOString()})
      }
    } catch(error) { empty.syncError = error instanceof Error ? error.message : 'Contract read failed' }
  }
  const events = await db.chainEvent.findMany({where:{eventName:'ContributionSubmitted',contractAddress:chainConfig().toLowerCase()},take:500})
  for (const event of events) {
    const args = JSON.parse(event.payload)
    try {
      const state = await chainClient.readContract({address:chainConfig(),abi:bountyAbi,functionName:'getSubmission',args:[BigInt(args.submissionId)]})
      const verified = await db.verifiedSubmission.findFirst({where:{chainAddress:chainConfig().toLowerCase(),chainRef:state.id.toString(),transactionHash:event.transactionHash,wallet:state.contributor.toLowerCase(),reference:state.prReference}})
      const paid = await db.chainEvent.findFirst({where:{contractAddress:chainConfig().toLowerCase(),eventName:'RewardReleased',payload:{contains:`"submissionId":"${state.id}"`}}})
      const demo=!!verified && verified.githubId.startsWith('demo:') && verified.reference.startsWith('demo:')
      empty.submissions.push({id:state.id.toString(),onChainId:Number(state.id),opportunityId:state.opportunityId.toString(),contributorAddress:state.contributor,githubUsername:verified?.login || 'Unverified direct submission',githubPrUrl:verified?.url || '',prNumber:verified?.prNumber || 0,prTitle:verified?.title || state.prReference,prState:verified?.prState as Submission['prState'] || 'open',status:['Pending','Approved','Rejected','Paid'][state.status] as Submission['status'],notes:verified?.notes,createdAt:new Date(Number(state.submittedAt)*1000).toISOString(),payoutTxHash:paid?.transactionHash,identityVerified:!!verified && !demo,demo,prCommit:verified?.commit,lastSyncedAt:verified?.syncedAt.toISOString(),syncError:verified?.syncError || undefined,verifiedRecordId:verified?.id})
    } catch(error) { empty.syncError = error instanceof Error ? error.message : 'Submission read failed' }
  }
  for (const p of empty.projects) {
    const open = empty.opportunities.filter(o => o.projectId === p.id && o.state === 'Open')
    p.opportunitiesCount = open.length
    // Derive monetary totals from decimal strings without floating point.
    p.totalBountyEth = formatEther(open.reduce((sum,o) => sum + parseEther(o.remainingEscrowEth),0n))
  }
  for (const o of empty.opportunities) o.submissionsCount = empty.submissions.filter(s => s.opportunityId === o.id).length
  empty.transactions = await db.transaction.findMany({where:{contractAddress:chainConfig().toLowerCase()},take:100,orderBy:{updatedAt:'desc'},select:{hash:true,wallet:true,status:true}})
  return empty
}
