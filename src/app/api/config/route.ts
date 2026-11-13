import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

// API name: config
// Screenshot interval config, changeable from taskapp.woodwolfdigital.com.
// GET /api/config - public, no admin JWT, so the EXE can fetch it.
//   Returns interval_min_minutes and interval_max_minutes, defaults 5 and 15.
// POST /api/config - admin JWT only, updates the interval.
//   Body: { interval_min_minutes, interval_max_minutes }, each 1 to 120, min <= max.

async function ensureTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )`
  )
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('interval_min_minutes', '5')
     ON CONFLICT (key) DO NOTHING`
  )
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('interval_max_minutes', '15')
     ON CONFLICT (key) DO NOTHING`
  )
}

async function getConfig() {
  await ensureTable()
  const result = await query(`SELECT key, value FROM app_settings WHERE key IN ('interval_min_minutes', 'interval_max_minutes')`)
  const config: Record<string, number> = { interval_min_minutes: 5, interval_max_minutes: 15 }
  for (const row of result.rows) {
    const n = parseInt(String(row.value), 10)
    if (!Number.isNaN(n)) config[row.key] = n
  }
  return config
}

export async function GET() {
  try {
    const config = await getConfig()
    return NextResponse.json(config)
  } catch (err) {
    console.error('Config GET error:', err)
    return NextResponse.json({ interval_min_minutes: 5, interval_max_minutes: 15 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const body = await req.json()
    const min = parseInt(String(body.interval_min_minutes), 10)
    const max = parseInt(String(body.interval_max_minutes), 10)
    if (Number.isNaN(min) || Number.isNaN(max) || min < 1 || max < 1 || min > 120 || max > 120 || min > max) {
      return NextResponse.json({ error: 'Interval must be 1 to 120 minutes, min <= max' }, { status: 400 })
    }
    await ensureTable()
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('interval_min_minutes', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [String(min)]
    )
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('interval_max_minutes', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [String(max)]
    )
    const config = await getConfig()
    return NextResponse.json({ message: 'Config saved', ...config })
  } catch (err) {
    console.error('Config POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
