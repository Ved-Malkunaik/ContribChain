import { Auth, type AuthConfig } from '@auth/core'
import GitHub from '@auth/core/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './db'
import { isAddress } from 'viem'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

let envLoaded = false
export function ensureEnvLoaded() {
  if (envLoaded || process.env.NODE_ENV === 'test') return
  envLoaded = true
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.AUTH_SECRET) {
    return
  }
  const envPath = join(process.cwd(), '.env')
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf8')
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          let val = trimmed.slice(eqIdx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (val && !process.env[key]) {
            process.env[key] = val
          }
        }
      }
    } catch { /* ignore */ }
  }
}

export const appOrigin = () => {
  ensureEnvLoaded()
  return new URL((process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').trim()).origin
}
export const demoMode = () => process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true'
export const sessionCookie = 'contribchain.session-token'
export function authConfig(): AuthConfig {
  ensureEnvLoaded()
  const secret = process.env.AUTH_SECRET
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!secret) throw new Error('AUTH_SECRET must be configured with a unique, randomly generated value')
  if (!clientId || !clientSecret) throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be configured')
  return {
    secret,
    trustHost: true,
    basePath: '/api/auth',
    adapter: PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]),
    session: { strategy: 'database', maxAge: 60 * 60 * 8 },
    cookies: { sessionToken: { name: sessionCookie, options: { httpOnly: true, sameSite: 'lax', path: '/', secure: appOrigin().startsWith('https:') } } },
    providers: [
      GitHub({
        clientId,
        clientSecret,
        // Keep OAuth callbacks on the canonical origin so Vercel preview or
        // alternate hostnames use the callback registered on the GitHub App.
        redirectProxyUrl: `${appOrigin()}/api/auth`,
        authorization: { params: { scope: 'read:user', prompt: 'select_account' } },
        checks: ['state', 'pkce'],
        profile(profile) {
          return {
            id: String(profile.id),
            name: profile.login || profile.name,
            email: profile.email,
            image: profile.avatar_url,
          }
        },
      }),
    ],
    events: {
      async signIn({ user, account, profile }) {
        if (account?.provider === 'github' && user?.id) {
          const ghProfile = profile as { id?: number | string; login?: string } | undefined
          const ghId = String(ghProfile?.id ?? account.providerAccountId ?? '')
          const login = ghProfile?.login || user.name
          if (ghId && login) {
            await db.user.update({
              where: { id: user.id },
              data: {
                githubUsername: login,
                githubId: ghId,
              },
            }).catch(() => {})
          }
        }
      },
    },
    callbacks: { redirect: ({ url }) => url.startsWith(appOrigin() + '/') ? url : appOrigin() + '/contributors' },
  }
}
export async function authHandler(request: Request) { return Auth(request, authConfig()) }
export function assertOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) throw new Error('Missing request origin')
  let requestOrigin: string
  try {
    requestOrigin = new URL(origin).origin
  } catch {
    throw new Error('Invalid request origin')
  }

  // 1. Configured canonical origin
  if (requestOrigin === appOrigin()) return

  // 2. Request destination origin
  try {
    if (requestOrigin === new URL(request.url).origin) return
  } catch { /* ignore */ }

  // 3. Current host header
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (host) {
    if (requestOrigin === `http://${host}` || requestOrigin === `https://${host}`) return
  }

  // 4. Local loopback origin
  try {
    const parsed = new URL(requestOrigin)
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]'
    if (isLocal) return
  } catch { /* ignore */ }

  throw new Error('Invalid request origin. Set APP_URL to this browser origin.')
}
export async function currentSession(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1)
  if (token) {
    try {
      const session = await db.session.findUnique({ where: { sessionToken: decodeURIComponent(token) }, include: { user: { include: { accounts: true } } } })
      if (session && session.expires > new Date()) {
        const github = session.user.accounts.find(a => a.provider === 'github')
        if (github && (!session.user.githubId || session.user.githubId === github.providerAccountId)) {
          if (!session.user.githubUsername && session.user.name) {
            await db.user.update({
              where: { id: session.user.id },
              data: {
                githubUsername: session.user.name,
                githubId: session.user.githubId || github.providerAccountId,
              },
            }).catch(() => {})
          }
          const walletHeader = request.headers.get('x-wallet-address')?.toLowerCase()
          const validWalletHeader = walletHeader && isAddress(walletHeader) ? walletHeader : undefined
          if (!validWalletHeader || !session.wallet || session.wallet.toLowerCase() === validWalletHeader) {
            return { ...session, wallet: session.wallet || validWalletHeader, github }
          }
        }
      }
    } catch { /* DB read error or unmigrated session */ }
  }

  // Wallet-first flow: allow publisher/contributor with connected wallet to publish or contribute without GitHub OAuth
  const walletHeader = request.headers.get('x-wallet-address')?.toLowerCase()
  if (walletHeader && isAddress(walletHeader)) {
    const existing = await db.user.findUnique({ where: { walletAddress: walletHeader } }).catch(() => null)
    const existingLink = await db.walletLink.findUnique({ where: { address: walletHeader } }).catch(() => null)
    const userId = existingLink?.userId || existing?.id || `user-${walletHeader.slice(2, 12)}`
    const githubId = existingLink?.githubId || existing?.githubId || 'wallet:' + walletHeader
    const githubUsername = existing?.githubUsername || `${walletHeader.slice(2, 8)}`
    return {
      id: `session-${walletHeader.slice(2, 10)}`,
      userId,
      wallet: walletHeader,
      generation: 0,
      github: {
        providerAccountId: githubId,
        access_token: '',
      },
      user: {
        id: userId,
        name: existing?.name || `${walletHeader.slice(0, 6)}...${walletHeader.slice(-4)}`,
        githubUsername,
        githubId,
        walletAddress: walletHeader,
      },
      githubUsername,
    }
  }

  return null
}
export async function requireWallet(request: Request) {
  assertOrigin(request)
  const s = await currentSession(request)
  const walletHeader = request.headers.get('x-wallet-address')?.toLowerCase()
  if (!s || !s.wallet || (walletHeader && walletHeader !== s.wallet.toLowerCase())) {
    throw new Error('Connect your wallet first')
  }
  return s
}
