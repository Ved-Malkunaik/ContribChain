import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeFunctionData, keccak256, toHex, type Hex } from 'viem'
import { bountyAbi } from '../src/lib/generated/bounty-abi.ts'
import { isConfirmedTransactionFor } from '../src/lib/transaction-confirmation.ts'

test('recovered submissions only confirm the opportunity encoded in the transaction', () => {
  const dummyHash: Hex = `0x${'12'.repeat(32)}`
  const data = encodeFunctionData({
    abi: bountyAbi,
    functionName: 'submitContribution',
    args: [3n, dummyHash],
  })
  assert.equal(isConfirmedTransactionFor(data, 'submitContribution', '3'), true)
  assert.equal(isConfirmedTransactionFor(data, 'submitContribution', '4'), false)
  assert.equal(isConfirmedTransactionFor(data, 'createOpportunity', '3'), false)
})

test('recovered funding only confirms its encoded project, never a different project', () => {
  const projectRef = keccak256(toHex('proj-2'))
  const dummyHash: Hex = `0x${'ab'.repeat(32)}`
  const data = encodeFunctionData({
    abi: bountyAbi,
    functionName: 'createOpportunity',
    args: [projectRef, dummyHash, 1900000000n],
  })
  assert.equal(isConfirmedTransactionFor(data, 'createOpportunity', 'proj-2'), true)
  assert.equal(isConfirmedTransactionFor(data, 'createOpportunity', 'proj-1'), false)
  assert.equal(isConfirmedTransactionFor(undefined, 'createOpportunity', 'proj-2'), false)
  assert.equal(isConfirmedTransactionFor('0xinvalid', 'createOpportunity', 'proj-2'), false)
})
