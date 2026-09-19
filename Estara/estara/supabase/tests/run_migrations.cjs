/**
 * Applies the SQL files passed as arguments, in order, to DATABASE_URL.
 * All migrations are idempotent, so this is safe to re-run.
 *
 *   DATABASE_URL='postgresql://...' node supabase/tests/run_migrations.cjs \
 *     supabase/migrations/0001_schema.sql supabase/migrations/0002_rls.sql
 */
const { Client } = require('pg');
const fs = require('fs');

const URL = process.env.DATABASE_URL;
if (!URL) {
  console.error('Set DATABASE_URL first (Supabase → Settings → Database → Session pooler).');
  process.exit(2);
}

(async () => {
  for (const file of process.argv.slice(2)) {
    const c = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
    await c.connect();
    c.on('notice', n => console.log('   ', n.message));
    try {
      await c.query(fs.readFileSync(file, 'utf8'));
      console.log('✓', file);
    } catch (e) {
      console.error('✗', file, '\n  ', e.message);
      if (e.detail) console.error('   detail:', e.detail);
      await c.end();
      process.exit(1);
    }
    await c.end();
  }
})();
