import {test} from 'node:test'
import assert from 'node:assert/strict'
import { concatHex, encodeFunctionData, numberToHex, parseAbi } from 'viem'
import {verifyIntentTransaction} from '../src/lib/transaction-intent.ts'
const intent={wallet:'0x123',to:'0x456',data:'0xabcdef',value:'42',nonce:7}
test('a repriced transaction with the same sender, nonce, target, calldata and value fulfills the same intent',()=>{
  assert.doesNotThrow(()=>verifyIntentTransaction(intent,{from:'0x123',to:'0x456',input:'0xabcdef',value:42n,nonce:7}))
})
test('a cancellation or changed replacement must never confirm the original intent',()=>{
  const tx={from:'0x123',to:'0x456',input:'0xabcdef',value:42n,nonce:7}
  for(const change of [{to:'0x123',input:'0x',value:0n},{input:'0xother'},{value:43n},{nonce:8},{from:'0x789'}]) assert.throws(()=>verifyIntentTransaction(intent,{...tx,...change}),/replaced|cancelled/i)
})

const wrappedIntent={wallet:'0x1111111111111111111111111111111111111111',to:'0x2222222222222222222222222222222222222222',data:'0xabcdef',value:'42',nonce:7}
const delegationAbi=parseAbi(['function redeemDelegations(bytes[] permissionContexts, bytes32[] modes, bytes[] executionCallDatas)'])
function delegatedTransaction(data='0xabcdef',value=42n) {
  const input=encodeFunctionData({abi:delegationAbi,functionName:'redeemDelegations',args:[['0x1234'],['0x'+'00'.repeat(32) as `0x${string}`],[concatHex([wrappedIntent.to as `0x${string}`,numberToHex(value,{size:32}),data as `0x${string}`])]]})
  return {from:wrappedIntent.wallet,to:'0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3',input,value:0n,nonce:7}
}
test('a MetaMask delegated execution confirms the exact intended inner target, calldata and value',()=>{
  assert.doesNotThrow(()=>verifyIntentTransaction(wrappedIntent,delegatedTransaction()))
})
test('delegated replacements cannot confirm changed calldata, value, sender, nonce or an unrecognized router',()=>{
  const tx=delegatedTransaction()
  for(const changed of [delegatedTransaction('0xdeadbeef'),delegatedTransaction('0xabcdef',43n),{...tx,from:wrappedIntent.to},{...tx,nonce:8},{...tx,to:'0x3333333333333333333333333333333333333333'}]) assert.throws(()=>verifyIntentTransaction(wrappedIntent,changed),/replaced|cancelled/i)
})
