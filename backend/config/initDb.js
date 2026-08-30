const { pool } = require("./db");

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS credit_packages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      credit_amount INT NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'USER',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coaches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      experience_years INTEGER NOT NULL,
      description VARCHAR(255) NOT NULL,
      profile_image_url VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS coach_skills (
      coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
      skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      PRIMARY KEY (coach_id, skill_id)
    );   
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
      skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255) NOT NULL,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      max_participants INTEGER NOT NULL CHECK (max_participants >= 0),
      meeting_url VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );   
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_credit_packages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credit_package_id UUID NOT NULL REFERENCES credit_packages(id) ON DELETE CASCADE,
      purchased_credits INT NOT NULL CHECK (purchased_credits >= 0),
      price_paid INT NOT NULL CHECK (price_paid >= 0),
      purchased_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}
module.exports = { initDb };
