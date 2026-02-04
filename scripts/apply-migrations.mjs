/**
 * Apply database migrations to Supabase
 * Run with: node scripts/apply-migrations.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from .env.local
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_KEY');
  process.exit(1);
}

// Function to execute SQL via PostgREST
async function executeSql(sql) {
  // We need to use the Supabase REST endpoint for RPC calls
  // But raw SQL isn't directly exposed - we'll need to create an RPC function first
  // OR use the database URL directly

  // For now, let's try splitting into individual statements and running via RPC
  console.log('SQL to execute:', sql.substring(0, 200) + '...');

  // Actually we cannot run raw SQL directly via REST API without a helper function
  // The best approach is to use the Supabase dashboard SQL editor
  // Let's output the SQL for manual execution instead
  return false;
}

async function main() {
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('');

  // Read migration files
  const migration005 = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '005_correlation_scoring.sql'), 'utf-8');
  const migration006 = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '006_push_subscriptions.sql'), 'utf-8');

  console.log('='.repeat(60));
  console.log('MIGRATIONS TO RUN');
  console.log('='.repeat(60));
  console.log('');
  console.log('Please run the following SQL in your Supabase Dashboard:');
  console.log('1. Go to: ' + SUPABASE_URL.replace('.supabase.co', '.supabase.co/project/default/sql'));
  console.log('   Or: https://supabase.com/dashboard → Your Project → SQL Editor');
  console.log('');
  console.log('2. Copy and paste each migration below and click "Run"');
  console.log('');

  console.log('-'.repeat(60));
  console.log('MIGRATION 005: Correlation Scoring');
  console.log('-'.repeat(60));
  console.log('');
  console.log(migration005);

  console.log('');
  console.log('-'.repeat(60));
  console.log('MIGRATION 006: Push Subscriptions');
  console.log('-'.repeat(60));
  console.log('');
  console.log(migration006);

  console.log('');
  console.log('='.repeat(60));
  console.log('After running both migrations, your database will be ready!');
  console.log('='.repeat(60));
}

main().catch(console.error);
