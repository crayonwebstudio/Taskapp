import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Server-side watchdog: the EXE cannot alert when it is off, closed,
// or the laptop is shut, so the server must detect silence.
// Call this every 10 minutes from a cron / scheduler.
// Auth: ?secret=... must match WATCHDOG_SECRET env, or header x-watchdog-secret.
// Alert: DISCORD_WEBHOOK_URL env. Only alerts 08:00-20:00 IST, Mon-Sat,
// and only once per employee per 60 minutes (dedupe table).
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.WATCHDOG_SECRET || ''
    if (!secret) {
      return NextResponse.json({ error: 'WATCHDOG_SECRET not configured' }, { status: 503 })
    }
    const { searchParams } = new URL(req.url)
    const provided = searchParams.get('secret') || req.headers.get('x-watchdog-secret') || ''
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Working hours check in IST
    const nowUtc = Date.now()
    const ist = new Date(nowUtc + 5.5 * 60 * 60 * 1000)
    const istHour = ist.getUTCHours()
    const istDay = ist.getUTCDay() // 0 Sun, 6 Sat
    const inHours = istHour >= 8 && istHour < 20 && istDay !== 0
    if (!inHours) {
      return NextResponse.json({ skipped: true, reason: 'outside working hours 08:00-20:00 IST Mon-Sat', ist_hour: istHour })
    }

    await query(
      `CREATE TABLE IF NOT EXISTS inactivity_alerts (
        employee_id VARCHAR(100) PRIMARY KEY,
        employee_name VARCHAR(255),
        last_seen TIMESTAMP,
        alerted_at TIMESTAMP DEFAULT NOW()
      )`
    )
    await query(
      `CREATE TABLE IF NOT EXISTS inactive_logs (
        id UUID PRIMARY KEY,
        employee_id VARCHAR(100) NOT NULL,
        employee_name VARCHAR(255),
        last_seen TIMESTAMP,
        minutes_idle INT NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )`
    )

    const result = await query(
      `SELECT employee_id, employee_name, MAX(created_at) as last_seen
       FROM screenshots
       WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
       GROUP BY employee_id, employee_name
       ORDER BY last_seen DESC`
    )

    const webhook = process.env.DISCORD_WEBHOOK_URL || ''
    const inactive: any[] = []
    const alerted: any[] = []
    const logged: any[] = []

    for (const row of result.rows) {
      const lastSeen = new Date(row.last_seen).getTime()
      const minutesIdle = Math.floor((nowUtc - lastSeen) / 60000)
      if (minutesIdle <= 10) continue
      inactive.push({
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        last_seen: row.last_seen,
        minutes_idle: minutesIdle,
      })
      // Log to inactive-log at 10 minutes, deduped to once per 10 minutes.
      try {
        const { randomUUID } = await import('crypto')
        const recentLog = await query(
          `SELECT id FROM inactive_logs WHERE employee_id = $1 AND created_at > NOW() - INTERVAL '10 minutes' LIMIT 1`,
          [row.employee_id]
        )
        if (recentLog.rows.length === 0) {
          await query(
            `INSERT INTO inactive_logs (id, employee_id, employee_name, last_seen, minutes_idle, reason)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [randomUUID(), row.employee_id, row.employee_name, row.last_seen, minutesIdle, `No activity for ${minutesIdle} minutes`]
          )
          logged.push(row.employee_id)
        }
      } catch (e) {
        console.error('Watchdog inactive-log insert failed:', e)
      }
      if (minutesIdle <= 20) continue
      // Dedupe: skip if alerted in last 60 minutes
      const recent = await query(
        `SELECT alerted_at FROM inactivity_alerts WHERE employee_id = $1 AND alerted_at > NOW() - INTERVAL '60 minutes'`,
        [row.employee_id]
      )
      if (recent.rows.length > 0) continue
      if (!webhook) continue
      const msg = `Employee: ${row.employee_name} (${row.employee_id})\nLast activity: ${row.last_seen}\nIdle: ${minutesIdle} minutes\nNo screenshot received for over 20 minutes.`
      try {
        const r = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [{ title: 'No activity for 20 minutes', description: msg, color: 0xffaa00 }] }),
        })
        if (r.ok || r.status === 204) {
          await query(
            `INSERT INTO inactivity_alerts (employee_id, employee_name, last_seen, alerted_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (employee_id) DO UPDATE SET employee_name = EXCLUDED.employee_name, last_seen = EXCLUDED.last_seen, alerted_at = NOW()`,
            [row.employee_id, row.employee_name, row.last_seen]
          )
          alerted.push(row.employee_id)
        }
      } catch (e) {
        console.error('Watchdog Discord send failed:', e)
      }
    }

    return NextResponse.json({
      checked_at: new Date(nowUtc).toISOString(),
      ist_hour: istHour,
      inactive,
      logged,
      alerted,
      webhook_configured: Boolean(webhook),
    })
  } catch (err) {
    console.error('Watchdog error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
