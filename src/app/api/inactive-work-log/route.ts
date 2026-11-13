import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { query } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

// API name: inactive-work-log
// Category 2, kept separate from inactive-log.
// inactive-log = no screenshot upload (exe dead, network down, laptop closed).
// inactive-work-log = punched in, but no real work: same screen, mouse move
// only, or switching screens without typing or clicking.
// POST /api/inactive-work-log - record one work-inactive log. No admin JWT.
// GET /api/inactive-work-log - admin-only list, employee / date filters.

async function ensureTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS inactive_work_logs (
      id UUID PRIMARY KEY,
      employee_id VARCHAR(100) NOT NULL,
      employee_name VARCHAR(255),
      last_seen TIMESTAMP,
      minutes_idle INT NOT NULL,
      reason VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )`
  )
  await query(`CREATE INDEX IF NOT EXISTS idx_inactive_work_logs_employee ON inactive_work_logs(employee_id)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_inactive_work_logs_created ON inactive_work_logs(created_at DESC)`)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employee_id, employee_name, last_seen, minutes_idle, reason } = body || {}
    if (!employee_id || minutes_idle === undefined || minutes_idle === null) {
      return NextResponse.json({ error: 'Missing required fields: employee_id, minutes_idle' }, { status: 400 })
    }
    const idle = parseInt(String(minutes_idle), 10)
    if (Number.isNaN(idle) || idle < 10) {
      return NextResponse.json({ error: 'minutes_idle must be 10 or more' }, { status: 400 })
    }
    await ensureTable()
    const recent = await query(
      `SELECT * FROM inactive_work_logs WHERE employee_id = $1 AND created_at > NOW() - INTERVAL '10 minutes' ORDER BY created_at DESC LIMIT 1`,
      [employee_id]
    )
    if (recent.rows.length > 0) {
      return NextResponse.json({ message: 'Already logged', log: recent.rows[0], deduplicated: true }, { status: 200 })
    }
    const id = randomUUID()
    const lastSeen = last_seen || new Date(Date.now() - idle * 60000).toISOString()
    const result = await query(
      `INSERT INTO inactive_work_logs (id, employee_id, employee_name, last_seen, minutes_idle, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, employee_id, employee_name || null, lastSeen, idle, reason || `No real work for ${idle} minutes while punched in`]
    )
    return NextResponse.json({ message: 'Inactive work log saved', log: result.rows[0] }, { status: 201 })
  } catch (err) {
    console.error('Inactive work log POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    await ensureTable()
    const { searchParams } = new URL(req.url)
    const employee = searchParams.get('employee') || ''
    const date_from = searchParams.get('date_from') || ''
    const date_to = searchParams.get('date_to') || ''
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit
    const conditions: string[] = []
    const params: any[] = []
    let idx = 1
    if (employee) {
      conditions.push(`(employee_name ILIKE $${idx} OR employee_id ILIKE $${idx})`)
      params.push(`%${employee}%`)
      idx++
    }
    if (date_from) {
      conditions.push(`created_at >= $${idx}`)
      params.push(date_from)
      idx++
    }
    if (date_to) {
      conditions.push(`created_at <= $${idx}`)
      params.push(date_to + ' 23:59:59')
      idx++
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const countResult = await query(`SELECT COUNT(*) as count FROM inactive_work_logs ${whereClause}`, params)
    const total = parseInt(countResult.rows[0].count, 10)
    const listResult = await query(
      `SELECT id, employee_id, employee_name, last_seen, minutes_idle, reason, created_at
       FROM inactive_work_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    )
    return NextResponse.json({
      logs: listResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('Inactive work log GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
