import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  await pool.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz default now()
    );
  `);
  const dir = path.resolve(__dirname, '..', 'migrations');
  if (!fs.existsSync(dir)) {
    console.log('[migrate] no migrations dir');
    return;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const applied = await pool.query('select 1 from _migrations where name=$1', [f]);
    if (applied.rowCount) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log('[migrate] applying', f);
    await pool.query(sql);
    await pool.query('insert into _migrations(name) values($1)', [f]);
  }
  console.log('[migrate] done');
}
