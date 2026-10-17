'use client'
import type { Opportunity, Submission } from '@/types'
import { api, useTransaction, useNow, useFeed } from '@/lib/use-platform'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, LockKeyhole } from 'lucide-react'
import { EmptyState, StatusBadge } from '@/components/ui/AppUI'

export function PublisherActions({mode,opportunities,submissions,tx}:{mode:'rewards'|'refunds';opportunities:Opportunity[];submissions:Submission[];tx:ReturnType<typeof useTransaction>}) {
  const {address}=useAccount()
  const {data}=useFeed()
  const cache=useQueryClient()
  const [actionError,setActionError]=useState('')
  const [merging,setMerging]=useState(false)
  async function simulateMerge(id:string) {
    setActionError('');setMerging(true)
    try {await api('demo/pr/merge',{id},address);await cache.invalidateQueries({queryKey:['platform-feed']})}
    catch(error) {setActionError(error instanceof Error?error.message:'Demo merge failed')}
    finally {setMerging(false)}
  }
  const now=useNow()
  const items=opportunities.filter(o=> mode==='rewards' ? o.state==='Approved' || o.state==='Paid' : o.state==='Open' && new Date(o.deadline).getTime()<=now)
  if(!items.length) return <EmptyState title={mode==='rewards'?'No rewards to release yet':'No expired escrow'} description={mode==='rewards'?'Approve a winning submission to start the payment process. Completed payments will appear here too.':'Opportunities without an approved winner become refundable after their deadline.'} />
  return <div className="cc-list">{actionError && <p role="alert" className="cc-notice" data-tone="error">{actionError}</p>}{items.map(o=>{
    const sub=submissions.find(s=>s.id===o.selectedSubmissionId)
    if(o.state==='Paid' || sub?.payoutTxHash) return <article key={o.id} className="cc-receipt"><div className="flex flex-wrap items-center justify-between gap-4"><div className="cc-inline"><CheckCircle2 className="w-5 h-5" /><div><p className="text-[10px] uppercase tracking-widest opacity-60 mb-2">Payment complete</p><h3 className="font-medium text-base">{o.title}</h3></div></div><strong className="font-display text-3xl font-normal">{o.rewardEth} <span className="font-sans text-xs opacity-60">ETH</span></strong></div><p className="text-xs mt-5 opacity-70 break-all">Paid to {sub?.contributorAddress || 'the selected contributor'} · 0 ETH remaining in escrow</p><div className="cc-inline mt-5">{sub?.payoutTxHash && <a className="cc-btn cc-btn-secondary" href={'https://sepolia.etherscan.io/tx/'+sub.payoutTxHash} target="_blank" rel="noreferrer">Payment receipt<ArrowUpRight /></a>}<Link href={'/opportunities/'+o.id} className="cc-btn cc-btn-ghost">View contribution<ArrowUpRight /></Link></div></article>
    const synced=sub?.lastSyncedAt ? new Date(sub.lastSyncedAt).getTime() : 0
    const fresh=!!synced && now>=synced && now-synced<15000
    const demo=!!data.demoMode && !!sub?.demo
    const ready=!!sub && (demo || !!sub.identityVerified) && sub.prState==='merged' && !sub.syncError && (demo || fresh) && sub.status==='Approved'
    const reason=demo?(ready?'Demo merge complete. Confirm the Sepolia payment to release escrow.':'Winner approved. Simulate the demo PR merge, then confirm payment.'):!sub?.identityVerified?'The selected contribution has no verified GitHub author.':sub.syncError?sub.syncError:!fresh?'Refresh the PR before payment to verify its latest state.':sub.prState!=='merged'?'Waiting for the approved PR to be merged.':'Merged and verified. Ready for publisher payment.'
    return <article key={o.id} className="cc-panel"><div className="cc-panel-header"><div><p className="cc-eyebrow !mb-2"><span />{mode==='rewards'?'Reward release':'Expired escrow'}</p><h3 className="text-lg font-medium tracking-tight">{o.title}</h3></div><StatusBadge status={mode==='rewards'?'Approved':'Expired'} /></div><div className="flex flex-wrap items-end justify-between gap-5"><div><span className="font-display text-4xl">{o.rewardEth}</span><span className="text-xs text-[#7e7e88] ml-2">Sepolia ETH</span></div><span className="cc-badge"><LockKeyhole className="w-3 h-3" />Held in escrow</span></div>{mode==='rewards' && <><p className={'mt-6 text-xs leading-7 '+(ready?'text-[#b0e5c5]':'text-[#b1a58d]')}>{reason}</p><div className="cc-workflow my-5"><div><p>01 · Review</p><strong>Winner approved</strong></div><div><p>02 · {demo?'Demo merge':'GitHub merge'}</p><strong>{demo?'Simulated '+(sub?.prState || 'open'):sub?.prState || 'Unverified'}</strong></div><div><p>03 · Payment</p><strong>Awaiting confirmation</strong></div></div><p className="text-[10px] text-[#74747f]">Recipient wallet</p><p className="font-mono text-xs text-[#c7c7cf] break-all mt-2">{sub?.contributorAddress || 'Unknown'}</p>{!demo && <p className="text-[10px] text-[#64646f] mt-3">Last sync: {sub?.lastSyncedAt || 'Never'} · Commit: {sub?.prCommit?.slice(0,12) || 'Unknown'}</p>}<div className="cc-inline mt-5">{sub?.verifiedRecordId && (demo ? sub.prState!=='merged' && <button disabled={merging || tx.busy} className="cc-btn cc-btn-secondary" onClick={()=>void simulateMerge(sub.verifiedRecordId!)}>{merging?'Simulating…':'Simulate PR merge (demo)'}</button> : <button className="cc-btn cc-btn-secondary" onClick={()=>void api('pr/refresh',{id:sub.verifiedRecordId},address).then(()=>cache.invalidateQueries({queryKey:['platform-feed']})).catch(error=>setActionError(error instanceof Error?error.message:'PR refresh failed'))}>Refresh PR</button>)}</div></>}<button disabled={tx.busy || merging || (mode==='rewards' && !ready)} onClick={()=>void tx.send('actions/prepare',{action:mode==='rewards'?'releaseReward':'refundExpiredOpportunity',opportunityId:o.id}).catch(()=>{})} className="cc-btn cc-btn-primary mt-5">{tx.busy?'Awaiting confirmation…':mode==='rewards'?'Confirm & pay Sepolia ETH':'Confirm escrow refund'}<ArrowUpRight /></button><p className="text-[10px] text-[#656570] leading-6 mt-4">{mode==='rewards'?'A separate MetaMask confirmation releases the escrow to the selected contributor. The publisher pays gas only.':'Pending submissions do not block expiry refunds. An approved winner cannot be refunded.'}</p></article>
  })}</div>
}
