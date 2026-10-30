import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalize, parseRepo, parsePull, verifyWebhook, rewardWei, challengeMessage } from '../src/lib/security.ts'
import { createHmac } from 'node:crypto'
test('canonical metadata is deterministic and rejects undefined values', () => {
  assert.equal(canonicalize({z: 1, a: {b: 'x'}}), '{"a":{"b":"x"},"z":1}')
  assert.equal(canonicalize({a: {b: 'x'}, z: 1}), canonicalize({z: 1, a: {b: 'x'}}))
  assert.throws(() => canonicalize({x: undefined}))
})
test('parses exact GitHub repository and PR URLs, rejecting arbitrary fetch targets', () => {
  assert.deepEqual(parseRepo('https://github.com/owner/repo'), {owner: 'owner', repo: 'repo'})
  assert.equal(parsePull('https://github.com/owner/repo/pull/12').number, 12)
  assert.deepEqual(parsePull('https://github.com/Ved-Malkunaik/StellarPoll/pull/1/changes/35c8e3dc36ee17769a2259abd0c0b075586f3195'), {owner: 'Ved-Malkunaik', repo: 'StellarPoll', number: 1})
  for (const url of ['http://github.com/o/r/pull/1', 'https://github.com.evil.test/o/r/pull/1', 'https://x@github.com/o/r/pull/1', 'https://github.com/o/r/pull/1?x=1', 'https://github.com/o/r/pull/0']) assert.throws(() => parsePull(url))
})
test('validates webhook HMAC over the exact raw body with safe malformed input handling', () => {
  const body = '{"action":"closed"}'
  const sig = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex')
  assert.equal(verifyWebhook(body, sig, 'secret'), true)
  assert.equal(verifyWebhook(body + ' ', sig, 'secret'), false)
  assert.equal(verifyWebhook(body, 'sha256=0', 'secret'), false)
  assert.equal(verifyWebhook(body, sig, ''), false)
})
test('uses integer wei and rejects precision loss, exponent and negative values', () => {
  assert.equal(rewardWei('0.010000000000000001'), 10000000000000001n)
  for (const x of ['0', '-1', '1e-3', '0.0000000000000000001', 'NaN']) assert.throws(() => rewardWei(x))
})
test('wallet message binds domain, session, chain, wallet, nonce and expiry', () => {
  const msg = challengeMessage('https://demo.test', 'session-hash', '0x123', 'nonce', '2026-10-17T12:00:00Z')
  for (const x of ['https://demo.test', 'session-hash', '11155111', '0x123', 'nonce', '2026-10-17T12:00:00Z']) assert.ok(msg.includes(x))
})
