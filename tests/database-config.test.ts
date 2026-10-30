import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveDatabaseConfig } from '../src/lib/server/database-config.ts'

test('local development keeps using the configured SQLite file', () => {
  assert.deepEqual(resolveDatabaseConfig({ DATABASE_URL: 'file:./dev.db' }), {
    kind: 'sqlite',
    url: 'file:./dev.db',
  })
})

test('serverless runtime refuses instance-local SQLite without Turso credentials', () => {
  assert.throws(
    () => resolveDatabaseConfig({ VERCEL: '1', DATABASE_URL: 'file:/tmp/dev.db' }),
    /TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/,
  )
})

test('only the Next build phase may use a local database before Turso is configured', () => {
  assert.deepEqual(
    resolveDatabaseConfig({
      VERCEL: '1',
      NEXT_PHASE: 'phase-production-build',
      DATABASE_URL: 'file:./dev.db',
      TURSO_DATABASE_URL: 'libsql://shared.turso.io',
      TURSO_AUTH_TOKEN: 'test-token',
    }),
    { kind: 'sqlite', url: 'file:./dev.db' },
  )
  assert.throws(
    () => resolveDatabaseConfig({
      VERCEL: '1',
      NEXT_PHASE: 'phase-production-server',
      DATABASE_URL: 'file:/tmp/dev.db',
    }),
    /TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/,
  )
})

test('serverless deployment requires both shared database credentials', () => {
  assert.throws(
    () => resolveDatabaseConfig({ VERCEL: '1', TURSO_DATABASE_URL: 'libsql://shared.turso.io' }),
    /TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/,
  )
})

test('valid Turso configuration selects shared SQLite-compatible storage', () => {
  assert.deepEqual(resolveDatabaseConfig({
    VERCEL: '1',
    TURSO_DATABASE_URL: 'libsql://shared.turso.io',
    TURSO_AUTH_TOKEN: 'test-token',
  }), {
    kind: 'libsql',
    url: 'libsql://shared.turso.io',
    authToken: 'test-token',
  })
})
