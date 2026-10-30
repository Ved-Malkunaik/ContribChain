import { PrismaClient } from '@prisma/client'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SCHEMA_STATEMENTS } from './schema-sql'

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

function ensureDatabaseInitialized() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.VERCEL ? 'file:/tmp/dev.db' : 'file:./dev.db'
  }

  const url = process.env.DATABASE_URL
  if (url.startsWith('file:')) {
    try {
      const dbPath = getFilePathFromUrl(url)
      const dir = dirname(dbPath)
      if (!existsSync(/*turbopackIgnore: true*/ dir)) {
        mkdirSync(dir, { recursive: true })
      }

      let needsSchema = false
      if (!existsSync(/*turbopackIgnore: true*/ dbPath)) {
        needsSchema = true
      } else {
        try {
          const checkSqlite = new DatabaseSync(dbPath)
          const row = checkSqlite
            .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='Checkpoint'")
            .get() as { count: number } | undefined
          checkSqlite.close()
          if (!row || row.count === 0) {
            needsSchema = true
          }
        } catch {
          needsSchema = true
        }
      }

      if (needsSchema) {
        const sqlite = new DatabaseSync(dbPath)
        for (const statement of SCHEMA_STATEMENTS) {
          try {
            sqlite.exec(statement)
          } catch (e) {
            // Index or column might already exist
          }
        }
        sqlite.close()
      }
    } catch (err) {
      console.warn('[db] auto-initialization warning:', err)
    }
  }
}

ensureDatabaseInitialized()

const globalDb = globalThis as unknown as { contribchainDb?: PrismaClient }
export const db =
  globalDb.contribchainDb ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalDb.contribchainDb = db
}

export default db
