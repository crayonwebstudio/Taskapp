import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

// Admin-only: delete one employee's screenshots and logs, and reclaim the
// disk space. Screenshots are stored as base64 data URLs in the Postgres
// screenshots table, so deleting the rows and running VACUUM FULL is what
// actually frees space on the host.
//
// POST /api/admin/purge-employee
// Body: { "employee_id": "HR-EMP-00006", "dry_run": true | false }
// dry_run=true only measures (counts + bytes + database size), deletes nothing.
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
    const { employee_id, dry_run } = body
    if (!employee_id) {
      return NextResponse.json({ error: 'Missing employee_id' }, { status: 400 })
    }

    const dbSize = async () => {
      const r = await query(`SELECT pg_database_size(current_database()) AS size`)
      return parseInt(r.rows[0].size, 10)
    }

    const measure = async () => {
      const shots = await query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(pg_column_size(image_url)), 0) AS bytes,
                COALESCE(MAX(employee_name), '') AS employee_name
         FROM screenshots WHERE employee_id = $1`,
        [employee_id]
      )
      const inactive = await query(
        `SELECT COUNT(*) AS count FROM inactive_logs WHERE employee_id = $1`,
        [employee_id]
      )
      const inactiveWork = await query(
        `SELECT COUNT(*) AS count FROM inactive_work_logs WHERE employee_id = $1`,
        [employee_id]
      )
      const alerts = await query(
        `SELECT COUNT(*) AS count FROM inactivity_alerts WHERE employee_id = $1`,
        [employee_id]
      )
      return {
        employee_id,
        employee_name: shots.rows[0].employee_name || null,
        screenshots: parseInt(shots.rows[0].count, 10),
        screenshot_bytes: parseInt(shots.rows[0].bytes, 10),
        inactive_logs: parseInt(inactive.rows[0].count, 10),
        inactive_work_logs: parseInt(inactiveWork.rows[0].count, 10),
        inactivity_alerts: parseInt(alerts.rows[0].count, 10),
      }
    }

    const before = await measure()
    const dbBefore = await dbSize()

    if (dry_run) {
      return NextResponse.json({ dry_run: true, ...before, db_size_bytes: dbBefore })
    }

    const delShots = await query(`DELETE FROM screenshots WHERE employee_id = $1`, [employee_id])
    const delInactive = await query(`DELETE FROM inactive_logs WHERE employee_id = $1`, [employee_id])
    const delInactiveWork = await query(`DELETE FROM inactive_work_logs WHERE employee_id = $1`, [employee_id])
    const delAlerts = await query(`DELETE FROM inactivity_alerts WHERE employee_id = $1`, [employee_id])

    // Actually shrink the database files on disk. Plain VACUUM only marks
    // the space reusable; VACUUM FULL rewrites the table and returns the
    // space to the OS. Screenshots hold the bulk of the bytes.
    await query(`VACUUM FULL screenshots`)
    await query(`VACUUM inactive_logs`)
    await query(`VACUUM inactive_work_logs`)
    await query(`VACUUM inactivity_alerts`)

    const dbAfter = await dbSize()

    return NextResponse.json({
      dry_run: false,
      ...before,
      deleted: {
        screenshots: delShots.rowCount,
        inactive_logs: delInactive.rowCount,
        inactive_work_logs: delInactiveWork.rowCount,
        inactivity_alerts: delAlerts.rowCount,
      },
      db_size_bytes_before: dbBefore,
      db_size_bytes_after: dbAfter,
      db_freed_bytes: dbBefore - dbAfter,
    })
  } catch (err) {
    console.error('Purge employee error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
