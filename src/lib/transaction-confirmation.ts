import { decodeFunctionData, type Hex } from 'viem'
import { bountyAbi } from './generated/bounty-abi'

// Recovery is global to this browser. A receipt only completes the form whose
// entity is encoded in that transaction, even when recovery ran on another page.
export function isConfirmedTransactionFor(data: string | undefined, functionName: 'submitContribution' | 'createOpportunity', entityId: string) {
  if (!data) return false
  try {
    const decoded = decodeFunctionData({ abi: bountyAbi, data: data as Hex })
    return decoded.functionName === functionName && decoded.args[0].toString() === entityId
  } catch { return false }
}
