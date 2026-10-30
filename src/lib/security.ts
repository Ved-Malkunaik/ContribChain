import { createHmac, timingSafeEqual } from 'node:crypto'
import { parseEther } from 'viem'
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const obj = value as Record<string, unknown>
    return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}'
  }
  throw new Error('Metadata must contain only JSON values')
}
function githubUrl(input: string) {
  const u = new URL(input)
  if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.port || u.username || u.password || u.search || u.hash) throw new Error('Use an exact https://github.com URL')
  return u
}
export function parseRepo(input: string) {
  const match = githubUrl(input).pathname.match(/^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/)
  if (!match || match[2] === '.' || match[2] === '..') throw new Error('Use https://github.com/owner/repo')
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}
export function parsePull(input: string) {
  const match = githubUrl(input).pathname.match(/^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)(?:\/changes\/[a-f0-9]{7,40})?\/?$/i)
  if (!match || !Number.isSafeInteger(Number(match[3]))) throw new Error('Use https://github.com/owner/repo/pull/123')
  return { owner: match[1], repo: match[2], number: Number(match[3]) }
}
export function verifyWebhook(body: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'), 'hex')
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))
}
export function rewardWei(input: string) {
  if (!/^\d+(\.\d{1,18})?$/.test(input)) throw new Error('Use a positive ETH amount with at most 18 decimal places')
  const wei = parseEther(input)
  if (wei <= 0n) throw new Error('Reward must be positive')
  return wei
}
export function challengeMessage(origin: string, sessionHash: string, address: string, nonce: string, expires: string) {
  return `ContribChain wallet ownership\nDomain: ${new URL(origin).host}\nURI: ${origin}\nWallet: ${address}\nChain ID: 11155111\nSession: ${sessionHash}\nNonce: ${nonce}\nExpiration: ${expires}\nThis signature links your GitHub session to this wallet. It does not authorize a transaction.`
}
