import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { query } from '@/lib/db'
import { verifyToken, getTokenFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { employee_id, employee_name, project_id, project_name, task_id, captured_at, image_base64 } = body

    if (!employee_id || !captured_at || !image_base64) {
      return NextResponse.json({ error: 'Missing required fields: employee_id, captured_at, image_base64' }, { status: 400 })
    }

    // Store as data URL in database (reliable, no filesystem dependency)
    // image_base64 may already be a data URL or raw base64
    let image_url: string
    if (image_base64.startsWith('data:')) {
      image_url = image_base64
    } else {
      image_url = `data:image/png;base64,${image_base64}`
    }

    const id = randomUUID()
    const result = await query(
      `INSERT INTO screenshots (id, employee_id, employee_name, project_id, project_name, task_id, captured_at, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, employee_id, employee_name || null, project_id || null, project_name || null, task_id || null, captured_at, image_url]
    )

    return NextResponse.json({ message: 'Screenshot saved', screenshot: result.rows[0] }, { status: 201 })
  } catch (err) {
    console.error('Screenshot upload error:', err)
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

    const { searchParams } = new URL(req.url)
    const employee = searchParams.get('employee') || ''
    const project = searchParams.get('project') || ''
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
    if (project) {
      conditions.push(`(project_name ILIKE $${idx} OR project_id ILIKE $${idx})`)
      params.push(`%${project}%`)
      idx++
    }
    if (date_from) {
      conditions.push(`captured_at >= $${idx}`)
      params.push(date_from)
      idx++
    }
    if (date_to) {
      conditions.push(`captured_at <= $${idx}`)
      params.push(date_to + ' 23:59:59')
      idx++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countResult = await query(`SELECT COUNT(*) as count FROM screenshots ${whereClause}`, params)
    const total = parseInt(countResult.rows[0].count, 10)

    const listResult = await query(
      `SELECT id, employee_id, employee_name, project_id, project_name, task_id, captured_at, image_url, created_at
       FROM screenshots ${whereClause}
       ORDER BY captured_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    )

    return NextResponse.json({
      screenshots: listResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('Screenshot list error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
