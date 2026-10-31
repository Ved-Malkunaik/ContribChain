import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { SCHEMA_STATEMENTS } from './schema-sql'
import { resolveDatabaseConfig } from './database-config'

let DatabaseSyncClass: any = null
try {
  const req = createRequire(import.meta.url)
  DatabaseSyncClass = req('node:sqlite')?.DatabaseSync
} catch {
  // node:sqlite is not available on some runtimes
}

function getFilePathFromUrl(url: string): string {
  const withoutFile = url.replace(/^file:(?:\/\/)?/, '')
  if (/^[A-Za-z]:[/\\]/.test(withoutFile)) {
    return withoutFile
  }
  if (withoutFile.startsWith('/')) {
    return withoutFile
  }
  return resolve(process.cwd(), 'prisma', withoutFile)
}

function ensureLocalDatabaseInitialized(url: string) {
  try {
    const dbPath = getFilePathFromUrl(url)
    const dir = dirname(dbPath)
    if (!existsSync(/*turbopackIgnore: true*/ dir)) {
      mkdirSync(dir, { recursive: true })
    }

    if (!DatabaseSyncClass) return

    let needsSchema = !existsSync(/*turbopackIgnore: true*/ dbPath)
    if (!needsSchema) {
      try {
        const checkSqlite = new DatabaseSyncClass(dbPath)
        const row = checkSqlite
          .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='Checkpoint'")
          .get() as { count: number } | undefined
        checkSqlite.close()
        needsSchema = !row || row.count === 0
      } catch {
        needsSchema = true
      }
    }

    if (!needsSchema) return
    const sqlite = new DatabaseSyncClass(dbPath)
    try {
      for (const statement of SCHEMA_STATEMENTS) {
        try {
          sqlite.exec(statement)
        } catch {
          // Existing indexes or columns are expected during idempotent local setup.
        }
      }
    } finally {
      sqlite.close()
    }
  } catch (err) {
    console.warn('[db] local database init notice:', err)
  }
}

async function ensureLibsqlSchema(url: string, authToken: string) {
  const schemaStatements = SCHEMA_STATEMENTS.filter(statement =>
    /^\s*(?:CREATE\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|ALTER\s+TABLE)\b/i.test(statement),
  )
  const client = createClient({ url, authToken })
  try {
    await client.executeMultiple(`${schemaStatements.join(';\n')};`)
  } catch (err) {
    console.warn('[db] libsql schema notice:', err)
  } finally {
    client.close()
  }
}

const databaseConfig = resolveDatabaseConfig({
  VERCEL: process.env.VERCEL,
  NEXT_PHASE: process.env.NEXT_PHASE,
  DATABASE_URL: process.env.DATABASE_URL,
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
})
const isNextBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
if (databaseConfig.kind === 'sqlite' && !isNextBuildPhase) {
  ensureLocalDatabaseInitialized(databaseConfig.url)
}

const globalDb = globalThis as unknown as { contribchainDb?: PrismaClient }
let client = globalDb.contribchainDb
if (!client) {
  client = databaseConfig.kind === 'libsql'
    ? new PrismaClient({
        adapter: new PrismaLibSQL({ url: databaseConfig.url, authToken: databaseConfig.authToken }),
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      })
    : new PrismaClient({
        datasourceUrl: databaseConfig.url,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      })
  if (databaseConfig.kind === 'libsql') {
    await ensureLibsqlSchema(databaseConfig.url, databaseConfig.authToken)
  }
  globalDb.contribchainDb = client
}

export const db = client

if (process.env.NODE_ENV !== 'production') {
  globalDb.contribchainDb = db
}

export default db
