import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertProjectPublisher } from '../src/lib/server/identity-authorization.ts'

const project = { publisherUserId: 'user-publisher', publisherAddress: '0xAbC' }
const identity = { userId: 'user-publisher', wallet: '0xabc' }

test('project owner identity can create opportunities', () => {
  assert.doesNotThrow(() => assertProjectPublisher(project, identity))
})

test('same wallet under another profile cannot manage a project', () => {
  assert.throws(() => assertProjectPublisher(project, { ...identity, userId: 'other-user' }), /original project owner/)
})

test('same profile with a different wallet cannot manage an existing escrow project', () => {
  assert.throws(() => assertProjectPublisher(project, { ...identity, wallet: '0xdef' }), /original project owner/)
})
