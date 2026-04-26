const { Pool } = require("pg");

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "5432"),
  user:     process.env.DB_USER     || "voicelink",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "voicelink",
});

// ─── Auto-create schema on startup ───────────────────────────
const initSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           UUID PRIMARY KEY,
      username     VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id         UUID PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      created_by VARCHAR(50)  NOT NULL,
      owner_id   UUID         NOT NULL,
      created_at TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id             UUID PRIMARY KEY,
      api_key        VARCHAR(100) UNIQUE NOT NULL,
      name           VARCHAR(100) NOT NULL,
      owner_id       UUID         NOT NULL,
      owner_username VARCHAR(50)  NOT NULL,
      created_at     TIMESTAMPTZ  DEFAULT NOW()
    );
  `);

  // ─── Migrations (safe to run repeatedly) ─────────────────
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email        VARCHAR(255) UNIQUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
  `);

  console.log("✅ Database schema ready");
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initSchema,
};

if (process.env.SKIP_DB_INIT_ON_REQUIRE !== "1") {
  initSchema().catch((err) => {
    console.error("❌ Database schema init failed:", err.message);
    process.exit(1);
  });
}
