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
        image_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('screenshots table ready')

    // Migrate existing image_url from VARCHAR(500) to TEXT for base64 data URLs
    await pool.query(`ALTER TABLE screenshots ALTER COLUMN image_url TYPE TEXT`)
    console.log('image_url migrated to TEXT')

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_screenshots_employee ON screenshots(employee_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_screenshots_project ON screenshots(project_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_screenshots_captured ON screenshots(captured_at DESC)`)
    console.log('indexes ready')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inactivity_alerts (
        employee_id VARCHAR(100) PRIMARY KEY,
        employee_name VARCHAR(255),
        last_seen TIMESTAMP,
        alerted_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('inactivity_alerts table ready')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inactive_logs (
        id UUID PRIMARY KEY,
        employee_id VARCHAR(100) NOT NULL,
        employee_name VARCHAR(255),
        last_seen TIMESTAMP,
        minutes_idle INT NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_inactive_logs_employee ON inactive_logs(employee_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_inactive_logs_created ON inactive_logs(created_at DESC)`)
    console.log('inactive_logs table ready')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS inactive_work_logs (
        id UUID PRIMARY KEY,
        employee_id VARCHAR(100) NOT NULL,
        employee_name VARCHAR(255),
        last_seen TIMESTAMP,
        minutes_idle INT NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_inactive_work_logs_employee ON inactive_work_logs(employee_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_inactive_work_logs_created ON inactive_work_logs(created_at DESC)`)
    console.log('inactive_work_logs table ready')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(100) PRIMARY KEY,
        value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await pool.query(`INSERT INTO app_settings (key, value) VALUES ('interval_min_minutes', '5') ON CONFLICT (key) DO NOTHING`)
    await pool.query(`INSERT INTO app_settings (key, value) VALUES ('interval_max_minutes', '15') ON CONFLICT (key) DO NOTHING`)
    console.log('app_settings table ready')

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
