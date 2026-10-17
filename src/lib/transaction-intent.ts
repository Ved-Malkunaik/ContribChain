import { decodeAbiParameters, decodeFunctionData, parseAbi, type Hex } from 'viem'
export type TransactionIntent={wallet:string;to:string;data:string;value:string;nonce?:number}
type Transaction={from:string;to:string|null;input:string;value:bigint;nonce:number}
const delegationManager='0xdb9b1e94b5b69df7e401ddbede43491141047db3'
const delegationAbi=parseAbi(['function redeemDelegations(bytes[] permissionContexts, bytes32[] modes, bytes[] executionCallDatas)'])

export function transactionCalls(tx:Transaction):{to:string;data:string;value:bigint}[] {
  if(tx.to?.toLowerCase()!==delegationManager) return tx.to ? [{to:tx.to,data:tx.input,value:tx.value}] : []
  try {
    const decoded=decodeFunctionData({abi:delegationAbi,data:tx.input as Hex})
    const [contexts,modes,executions]=decoded.args
    // Only a single reverting execution is accepted. Never accept an unrelated
    // batch just because the intended bytes appear somewhere inside its input.
    if(contexts.length!==1 || modes.length!==1 || executions.length!==1 || !/^0x(?:00|01)0{62}$/i.test(modes[0]) || tx.value!==0n) return []
    const execution=executions[0]
    if(modes[0].slice(2,4)==='01') {
      const [calls]=decodeAbiParameters([{type:'tuple[]',components:[{name:'target',type:'address'},{name:'value',type:'uint256'},{name:'callData',type:'bytes'}]}],execution)
      return calls.length===1 ? calls.map(call=>({to:call.target,data:call.callData,value:call.value})) : []
    }
    if(execution.length<106) return []
    return [{to:'0x'+execution.slice(2,42),value:BigInt('0x'+execution.slice(42,106)),data:'0x'+execution.slice(106)}]
  } catch {return []}
}

export function verifyIntentTransaction(intent:TransactionIntent,tx:{from:string;to:string|null;input:string;value:bigint;nonce:number}) {
  const calls=transactionCalls(tx)
  if(!intent.to || !intent.data || intent.value===undefined || tx.from.toLowerCase()!==intent.wallet.toLowerCase() || calls.length!==1 || calls[0].to.toLowerCase()!==intent.to.toLowerCase() || calls[0].data.toLowerCase()!==intent.data.toLowerCase() || calls[0].value!==BigInt(intent.value) || (intent.nonce!==undefined && tx.nonce!==intent.nonce)) throw new Error('Transaction was cancelled or replaced with a different action. The intended action was not confirmed.')
}
