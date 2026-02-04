/**
 * Run database migrations directly against Supabase
 * Usage: npx tsx scripts/run-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration(filename: string, sql: string) {
  console.log(`\nRunning migration: ${filename}`);
  console.log('='.repeat(50));

  // Split SQL by semicolons, but be careful about function bodies
  // We'll run the entire file as one statement since Supabase handles it
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, we need to run statements individually
      console.log('Note: exec_sql not available, running raw query...');
      throw error;
    }

    console.log(`✓ Migration ${filename} completed successfully`);
  } catch (err) {
    console.error(`✗ Migration ${filename} failed:`, err);
    throw err;
  }
}

async function main() {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

  // Get migration files, sorted by name
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Only run new migrations (005 and 006)
  const newMigrations = files.filter(f =>
    f.startsWith('005_') || f.startsWith('006_')
  );

  console.log(`Found ${newMigrations.length} new migrations to run`);

  for (const file of newMigrations) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    await runMigration(file, sql);
  }

  console.log('\n✓ All migrations completed!');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
