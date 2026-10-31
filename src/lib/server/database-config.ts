export type DatabaseConfig =
  | { kind: 'sqlite'; url: string }
  | { kind: 'libsql'; url: string; authToken: string }

type Environment = {
  VERCEL?: string
  NEXT_PHASE?: string
  DATABASE_URL?: string
  TURSO_DATABASE_URL?: string
  TURSO_AUTH_TOKEN?: string
}

export function resolveDatabaseConfig(env: Environment): DatabaseConfig {
  const url = env.TURSO_DATABASE_URL?.trim()
  const authToken = env.TURSO_AUTH_TOKEN?.trim()

  if (url || authToken) {
    if (!url || !authToken) {
      throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must both be configured')
    }
    if (!url.startsWith('libsql://') && !url.startsWith('https://')) {
      throw new Error('TURSO_DATABASE_URL must be a libsql:// or https:// URL')
    }
    return { kind: 'libsql', url, authToken }
  }

  const localUrl = env.DATABASE_URL?.trim() || (env.VERCEL ? 'file:/tmp/dev.db' : 'file:./dev.db')
  if (!localUrl.startsWith('file:')) {
    throw new Error('Local DATABASE_URL must use a file: SQLite URL; configure Turso variables for shared storage')
  }
  return { kind: 'sqlite', url: localUrl }
}
