import { Auth, type AuthConfig } from '@auth/core'
import GitHub from '@auth/core/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './db'
import { isAddress } from 'viem'
export const appOrigin = () => new URL(process.env.APP_URL || 'http://localhost:3000').origin
export const demoMode = () => process.env.DEMO_MODE === 'true' && ['localhost','127.0.0.1'].includes(new URL(appOrigin()).hostname)
export const sessionCookie = 'contribchain.session-token'
export function authConfig(): AuthConfig {
  const secret = process.env.AUTH_SECRET || 'contribchain-hackathon-secure-session-secret-2026'
  const clientId = process.env.GITHUB_CLIENT_ID || 'demo_client_id'
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || 'demo_client_secret'
  return {
    secret,
    trustHost: true,
    basePath: '/api/auth',
    adapter: PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]),
    session: { strategy: 'database', maxAge: 60 * 60 * 8 },
    cookies: { sessionToken: { name: sessionCookie, options: { httpOnly: true, sameSite: 'lax', path: '/', secure: appOrigin().startsWith('https:') } } },
    providers: [GitHub({ clientId, clientSecret, authorization: { params: { scope: 'read:user', prompt: 'select_account' } }, checks: ['state', 'pkce'] })],
    callbacks: { redirect: ({ url }) => url.startsWith(appOrigin() + '/') ? url : appOrigin() + '/contributors' },
  }
}
export async function authHandler(request: Request) { return Auth(request, authConfig()) }
export function assertOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== appOrigin() && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    throw new Error('Invalid request origin. Set APP_URL to this browser origin.')
  }
}
export async function currentSession(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1)
  if (token) {
    try {
      const session = await db.session.findUnique({ where: { sessionToken: decodeURIComponent(token) }, include: { user: { include: { accounts: true } } } })
      if (session && session.expires > new Date()) {
        const github = session.user.accounts.find(a => a.provider === 'github')
        if (github) return { ...session, github }
      }
    } catch { /* DB read error or unmigrated session */ }
  }

  // Explicit local simulation. This identity must never be presented as GitHub verification.
  const walletHeader = request.headers.get('x-wallet-address')?.toLowerCase()
  if (demoMode() && walletHeader && isAddress(walletHeader)) {
    return {
      id: `dev-session-${walletHeader.slice(2, 10)}`,
      userId: `dev-user-${walletHeader.slice(2, 10)}`,
      wallet: walletHeader,
      generation: 0,
      github: {
        providerAccountId: 'demo:'+walletHeader,
        access_token: '',
      },
      user: { name: 'Demo wallet', id: `dev-user-${walletHeader.slice(2, 10)}` },
    }
  }
  return null
}
export async function requireWallet(request: Request) {
  assertOrigin(request)
  const s = await currentSession(request)
  if (!s || !s.wallet || request.headers.get('x-wallet-address')?.toLowerCase() !== s.wallet) throw new Error('Authenticate with GitHub and prove ownership of the current wallet first')
  return s
}
