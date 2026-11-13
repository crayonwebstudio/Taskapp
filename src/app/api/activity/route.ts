import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

// Admin-only: last seen per employee, based on server receive time.
// Uses created_at (DB time) for idle math, not captured_at (EXE sends IST time).
// Returns: [{ employee_id, employee_name, last_seen, minutes_idle, status }]
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
    const result = await query(
      `SELECT employee_id, employee_name, MAX(created_at) as last_seen, MAX(captured_at) as last_captured, COUNT(*) as today_count
       FROM screenshots
       WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
       GROUP BY employee_id, employee_name
       ORDER BY last_seen DESC`
    )
    const now = Date.now()
    const activity = result.rows.map((r: any) => {
      const lastSeen = new Date(r.last_seen).getTime()
      const minutesIdle = Math.max(0, Math.floor((now - lastSeen) / 60000))
      return {
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        last_seen: r.last_seen,
        last_captured: r.last_captured,
        today_count: parseInt(r.today_count, 10),
        minutes_idle: minutesIdle,
        status: minutesIdle > 20 ? 'inactive' : 'active',
      }
    })
    return NextResponse.json({ activity })
  } catch (err) {
    console.error('Activity error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
