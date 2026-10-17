import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeFunctionData } from 'viem'
import { bountyAbi } from '../src/lib/generated/bounty-abi.ts'
import { isConfirmedTransactionFor } from '../src/lib/transaction-confirmation.ts'

test('recovered submissions only confirm the opportunity encoded in the transaction', () => {
  const data = encodeFunctionData({ abi: bountyAbi, functionName: 'submitContribution', args: [3n, 'ipfs://contribution'] })
  assert.equal(isConfirmedTransactionFor(data, 'submitContribution', '3'), true)
  assert.equal(isConfirmedTransactionFor(data, 'submitContribution', '4'), false)
  assert.equal(isConfirmedTransactionFor(data, 'createOpportunity', '3'), false)
})

test('recovered funding only confirms its encoded project, never a different project', () => {
  const data = encodeFunctionData({ abi: bountyAbi, functionName: 'createOpportunity', args: [2n, 100n, 1900000000n, 'ipfs://task', `0x${'ab'.repeat(32)}`] })
  assert.equal(isConfirmedTransactionFor(data, 'createOpportunity', '2'), true)
  assert.equal(isConfirmedTransactionFor(data, 'createOpportunity', '1'), false)
  assert.equal(isConfirmedTransactionFor(undefined, 'createOpportunity', '2'), false)
  assert.equal(isConfirmedTransactionFor('0xinvalid', 'createOpportunity', '2'), false)
})
