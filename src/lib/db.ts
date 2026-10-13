import { Pool } from 'pg'

const globalForPg = globalThis as unknown as { pgPool: Pool | undefined }

export const pool = globalForPg.pgPool || new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool
}

export async function query(text: string, params?: any[]) {
  const client = await pool.connect()
  try {
    const res = await client.query(text, params)
    return res
  } finally {
    client.release()
  }
}
