'use client'
import { useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { bountyAbi, contractAddress, chainId } from '@/lib/contract'
import { StatusBadge } from '@/components/ui/AppUI'
export function EscrowReadout({onChainId}:{onChainId?:number}) {
  const opportunityId=onChainId && Number.isSafeInteger(onChainId) && onChainId > 0 ? BigInt(onChainId) : undefined
  const query=useReadContract({address:contractAddress,abi:bountyAbi,functionName:'getOpportunity',args:opportunityId === undefined ? undefined : [opportunityId],chainId,query:{enabled:!!contractAddress && opportunityId !== undefined,refetchInterval:15000}})
  if(!contractAddress)return <p className="text-xs text-amber-300">Escrow deployment is not configured.</p>
  if(opportunityId === undefined)return <p className="text-xs text-amber-300">This opportunity is not registered on-chain yet.</p>
  if(query.isPending)return <p className="text-xs text-slate-400">Reading live Sepolia escrow…</p>
  if(query.error)return <p role="alert" className="text-xs text-red-300">Live escrow read failed: {query.error.message}</p>
  if(!query.data)return null
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[10px] text-neutral-400"><StatusBadge status={['Open','Approved','Paid','Refunded'][query.data.state]} /><span>Live escrow · <strong className="font-medium text-neutral-200">{formatEther(query.data.remainingEscrow)} ETH</strong></span></div>
}
