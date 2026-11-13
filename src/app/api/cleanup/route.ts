import { NextRequest, NextResponse } from 'next/server'
import { query, pool } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

// Cleanup: remove an employee's logs AND their screenshots together,
// so a delete never leaves orphan screenshots behind (or orphan logs).
// GET /api/cleanup - admin-only storage stats per employee.
// DELETE /api/cleanup - admin-only, body { employee_id, date_from?, date_to?, confirm: true }
//   Deletes, in one transaction, for that employee (and date range when given):
//   screenshots (the base64 image lives in screenshots.image_url),
//   inactive_logs, inactive_work_logs, inactivity_alerts.
//   Returns counts deleted and bytes freed from the screenshots table.
//   Note: Postgres reuses the freed space inside the database. The database
//   file on disk only shrinks after a VACUUM FULL, which is not run here.

function requireAdmin(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyToken(token)
}

function formatBytes(n: number) {
  if (!n || n <= 0) return '0 MB'
  const mb = n / (1024 * 1024)
  if (mb < 1) return `${Math.round(n / 1024)} KB`
  return `${mb.toFixed(1)} MB`
}

export async function GET(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const perEmployee = await query(
      `SELECT employee_id, COALESCE(NULLIF(employee_name, ''), employee_id) AS employee_name,
              COUNT(*) AS screenshot_count,
              COALESCE(SUM(LENGTH(image_url)), 0)::bigint AS screenshot_bytes
       FROM screenshots
       GROUP BY employee_id, employee_name
       ORDER BY screenshot_bytes DESC`
    )
    const inactive = await query(
      `SELECT employee_id, COUNT(*) AS n FROM inactive_logs GROUP BY employee_id`
    )
    const inactiveWork = await query(
      `SELECT employee_id, COUNT(*) AS n FROM inactive_work_logs GROUP BY employee_id`
    )
    const inactiveMap = new Map<string, number>()
    for (const r of inactive.rows) inactiveMap.set(r.employee_id, parseInt(r.n, 10))
    const inactiveWorkMap = new Map<string, number>()
    for (const r of inactiveWork.rows) inactiveWorkMap.set(r.employee_id, parseInt(r.n, 10))

    const totals = await query(
      `SELECT COUNT(*) AS screenshot_count,
              COALESCE(SUM(LENGTH(image_url)), 0)::bigint AS screenshot_bytes
       FROM screenshots`
    )
    const dbSize = await query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size,
              pg_size_pretty(pg_total_relation_size('screenshots')) AS screenshots_table_size`
    )

    const employees = perEmployee.rows.map((r: any) => ({
      employee_id: r.employee_id,
      employee_name: r.employee_name,
      screenshot_count: parseInt(r.screenshot_count, 10),
      screenshot_bytes: parseInt(r.screenshot_bytes, 10),
      screenshot_size: formatBytes(parseInt(r.screenshot_bytes, 10)),
      inactive_log_count: inactiveMap.get(r.employee_id) || 0,
      inactive_work_log_count: inactiveWorkMap.get(r.employee_id) || 0,
    }))

    return NextResponse.json({
      employees,
      total: {
        screenshot_count: parseInt(totals.rows[0].screenshot_count, 10),
        screenshot_bytes: parseInt(totals.rows[0].screenshot_bytes, 10),
        screenshot_size: formatBytes(parseInt(totals.rows[0].screenshot_bytes, 10)),
        db_size: dbSize.rows[0]?.db_size || null,
        screenshots_table_size: dbSize.rows[0]?.screenshots_table_size || null,
      },
    })
  } catch (err) {
    console.error('Cleanup stats error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const { employee_id, date_from, date_to, confirm } = body || {}
    if (!employee_id) {
      return NextResponse.json({ error: 'Missing required field: employee_id' }, { status: 400 })
    }
    if (confirm !== true) {
      return NextResponse.json({ error: 'Set confirm to true to delete. This cannot be undone.' }, { status: 400 })
    }

    // Build date filters. Screenshots use captured_at, logs use created_at.
    const shotConds: string[] = ['employee_id = $1']
    const logConds: string[] = ['employee_id = $1']
    const shotParams: any[] = [employee_id]
    const logParams: any[] = [employee_id]
    let idx = 2
    if (date_from) {
      shotConds.push(`captured_at >= $${idx}`)
      logConds.push(`created_at >= $${idx}`)
      shotParams.push(date_from)
      logParams.push(date_from)
      idx++
    }
    if (date_to) {
      shotConds.push(`captured_at <= $${idx}`)
      logConds.push(`created_at <= $${idx}`)
      shotParams.push(date_to + ' 23:59:59')
      logParams.push(date_to + ' 23:59:59')
      idx++
    }
    const shotWhere = `WHERE ${shotConds.join(' AND ')}`
    const logWhere = `WHERE ${logConds.join(' AND ')}`

    const preview = await query(
      `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(image_url)), 0)::bigint AS bytes FROM screenshots ${shotWhere}`,
      shotParams
    )
    const screenshotCount = parseInt(preview.rows[0].n, 10)
    const screenshotBytes = parseInt(preview.rows[0].bytes, 10)
    if (screenshotCount === 0) {
      // Still delete any matching logs, so a log-only employee is cleaned too.
      const logCount = await query(`SELECT COUNT(*) AS n FROM inactive_logs ${logWhere}`, logParams)
      const workCount = await query(`SELECT COUNT(*) AS n FROM inactive_work_logs ${logWhere}`, logParams)
      if (parseInt(logCount.rows[0].n, 10) === 0 && parseInt(workCount.rows[0].n, 10) === 0) {
        return NextResponse.json({ error: 'Nothing found for that employee and date range' }, { status: 404 })
      }
    }

    const client = await pool.connect()
    let deleted: any
    try {
      await client.query('BEGIN')
      const shots = await client.query(`DELETE FROM screenshots ${shotWhere}`, shotParams)
      const logs = await client.query(`DELETE FROM inactive_logs ${logWhere}`, logParams)
      const workLogs = await client.query(`DELETE FROM inactive_work_logs ${logWhere}`, logParams)
      // Alerts have no captured date, only delete them when no date range was given,
      // so a date-range cleanup does not clear a current alert.
      let alertCount = 0
      if (!date_from && !date_to) {
        const alerts = await client.query(`DELETE FROM inactivity_alerts WHERE employee_id = $1`, [employee_id])
        alertCount = alerts.rowCount || 0
      }
      await client.query('COMMIT')
      deleted = {
        screenshots: shots.rowCount || 0,
        inactive_logs: logs.rowCount || 0,
        inactive_work_logs: workLogs.rowCount || 0,
        inactivity_alerts: alertCount,
        screenshot_bytes: screenshotBytes,
        freed_size: formatBytes(screenshotBytes),
      }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    // Reclaim dead rows for reuse inside the database (does not lock the table).
    try {
      await query('VACUUM ANALYZE screenshots')
      await query('VACUUM ANALYZE inactive_logs')
      await query('VACUUM ANALYZE inactive_work_logs')
    } catch {
      // VACUUM failure must not hide a successful delete.
    }

    return NextResponse.json({
      message: `Deleted ${deleted.screenshots} screenshots (${deleted.freed_size}) and ${deleted.inactive_logs + deleted.inactive_work_logs} inactive logs for ${employee_id}`,
      employee_id,
      deleted,
    })
  } catch (err) {
    console.error('Cleanup delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
