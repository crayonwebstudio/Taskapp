const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  })

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('admins table ready')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS screenshots (
        id UUID PRIMARY KEY,
        employee_id VARCHAR(100),
        employee_name VARCHAR(255),
        project_id VARCHAR(100),
        project_name VARCHAR(255),
        task_id VARCHAR(100),
        captured_at TIMESTAMP NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('screenshots table ready')

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_screenshots_employee ON screenshots(employee_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_screenshots_project ON screenshots(project_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_screenshots_captured ON screenshots(captured_at DESC)`)
    console.log('indexes ready')

    const adminEmail = process.env.ADMIN_EMAIL || 'milan.crayon@gmail.com'
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      console.log('ADMIN_PASSWORD not set, skipping admin creation')
      return
    }

    const existing = await pool.query('SELECT id FROM admins WHERE email = $1', [adminEmail])
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 10)
      await pool.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2)', [adminEmail, hash])
      console.log(`Admin user created: ${adminEmail}`)
    } else {
      console.log(`Admin user already exists: ${adminEmail}`)
    }
  } catch (err) {
    console.error('Init DB error:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
