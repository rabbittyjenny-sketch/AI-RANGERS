import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/**
 * Browser-compatible Neon DB client
 * Uses @neondatabase/serverless HTTP driver (works in Vite/browser)
 * Falls back gracefully (db = null) when DATABASE_URL is not configured
 */

const databaseUrl = (import.meta as any).env?.VITE_DATABASE_URL || '';

// Create DB instance only when URL is present — no throw on missing URL
export const db = databaseUrl
  ? drizzle(neon(databaseUrl), { schema })
  : null;

export type DrizzleDB = NonNullable<typeof db>;
export * from './schema';
