import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transactionExplorerHref } from '../src/lib/transaction-presentation.ts'

const hash = '0x' + 'a'.repeat(64)

test('confirmed escrow transaction links retain the full hash on the configured explorer', () => {
  assert.equal(transactionExplorerHref(hash, 'https://explorer.example/'), `https://explorer.example/tx/${hash}`)
})

test('invalid transaction hashes do not produce explorer links', () => {
  assert.equal(transactionExplorerHref('not-a-hash', 'https://explorer.example'), null)
})
