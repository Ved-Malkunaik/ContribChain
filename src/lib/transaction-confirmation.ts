import { decodeFunctionData, type Hex, keccak256, toHex } from 'viem'
import { bountyAbi } from './generated/bounty-abi'

// Recovery is global to this browser. A receipt only completes the form whose
// entity is encoded in that transaction, even when recovery ran on another page.
export function isConfirmedTransactionFor(
  data: string | undefined,
  functionName: 'submitContribution' | 'createOpportunity',
  entityId: string
) {
  if (!data) return false
  try {
    const decoded = decodeFunctionData({ abi: bountyAbi, data: data as Hex })
    if (decoded.functionName !== functionName) return false
    const firstArg = decoded.args[0]
    if (typeof firstArg === 'bigint') {
      return firstArg.toString() === entityId
    }
    if (typeof firstArg === 'string') {
      return (
        firstArg === entityId ||
        firstArg.toLowerCase() === entityId.toLowerCase() ||
        firstArg.toLowerCase() === keccak256(toHex(entityId)).toLowerCase()
      )
    }
    return false
  } catch {
    return false
  }
}
