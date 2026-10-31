'use client'
import { useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { bountyAbi, contractAddress, chainId, currencySymbol, networkName } from '@/lib/contract'
import { StatusBadge } from '@/components/ui/AppUI'
import type { OpportunityState } from '@/types'

export function EscrowReadout({ onChainId }: { onChainId?: number }) {
  const opportunityId = onChainId && Number.isSafeInteger(onChainId) && onChainId > 0 ? BigInt(onChainId) : undefined
  const query = useReadContract({
    address: contractAddress,
    abi: bountyAbi,
    functionName: 'opportunities',
    args: opportunityId === undefined ? undefined : [opportunityId],
    chainId,
    query: {
      enabled: !!contractAddress && opportunityId !== undefined,
      refetchInterval: 15000,
    },
  })

  if (!contractAddress) return <p className="text-xs text-amber-300">Escrow deployment is not configured.</p>
  if (opportunityId === undefined) return <p className="text-xs text-amber-300">This opportunity is awaiting on-chain sync.</p>
  if (query.isPending) return <p className="text-xs text-slate-400">Reading live {networkName} escrow…</p>
  if (query.error) return <p role="alert" className="text-xs text-red-300">Live escrow read failed: {query.error.message}</p>
  if (!query.data || !query.data[10]) return null // exists is at index 10

  const remaining = formatEther(query.data[5]) // remainingBounty
  const rawStatus = Number(query.data[9]) // status: 0=None, 1=Open, 2=Reward Pending, 3=Paid, 4=Cancelled
  const statusStr = rawStatus === 1 ? 'Open' : rawStatus === 2 ? 'Approved' : rawStatus === 3 ? 'Paid' : rawStatus === 4 ? 'Refunded' : 'Open'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[10px] text-neutral-400">
      <StatusBadge status={statusStr as OpportunityState} />
      <span>
        Live escrow · <strong className="font-medium text-neutral-200">{remaining} {currencySymbol}</strong>
      </span>
    </div>
  )
}
