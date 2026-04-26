/**
 * Run idempotent schema / migration SQL against PostgreSQL (same as server startup).
 * Used by deploy mode 2. Requires server/.env with DB_* set.
 */
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
process.env.SKIP_DB_INIT_ON_REQUIRE = "1";

const { initSchema, pool } = require("../db");

initSchema()
  .then(() => pool.end())
  .then(() => {
    console.log("✅ sync-db-schema finished");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ sync-db-schema failed:", err.message);
    process.exit(1);
  });
