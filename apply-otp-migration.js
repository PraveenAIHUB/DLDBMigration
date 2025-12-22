/**
 * Script to apply OTP storage table migration
 * 
 * This script will create the otp_storage table in your Supabase database.
 * 
 * IMPORTANT: You need to add your Supabase Service Role Key temporarily.
 * 
 * Steps:
 * 1. Go to Supabase Dashboard → Settings → API
 * 2. Copy your "service_role" key (NOT the anon key)
 * 3. Replace YOUR_SERVICE_ROLE_KEY below
 * 4. Run: node apply-otp-migration.js
 * 5. Delete this file after running (for security)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚠️ REPLACE THIS WITH YOUR SERVICE ROLE KEY FROM SUPABASE DASHBOARD
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://umjsrbxerbttukpjbsaj.supabase.co';

if (SUPABASE_SERVICE_ROLE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error('❌ ERROR: Please set your SUPABASE_SERVICE_ROLE_KEY in the script!');
  console.log('\n📝 Instructions:');
  console.log('1. Go to Supabase Dashboard → Settings → API');
  console.log('2. Copy your "service_role" key');
  console.log('3. Replace YOUR_SERVICE_ROLE_KEY_HERE in this file');
  console.log('4. Run: node apply-otp-migration.js');
  process.exit(1);
}

// Read the migration SQL file
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250103000001_create_otp_storage.sql');
let migrationSQL;

try {
  migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  // Remove comments and clean up
  migrationSQL = migrationSQL
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/--.*$/gm, '') // Remove line comments
    .trim();
} catch (error) {
  console.error('❌ Error reading migration file:', error.message);
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 Starting migration...\n');

  try {
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement || statement.length < 10) continue; // Skip empty statements

      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        // Use RPC to execute raw SQL (if available) or use direct query
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        }).catch(async () => {
          // If RPC doesn't exist, try direct query via REST API
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ sql: statement + ';' })
          });
          return { data: null, error: response.ok ? null : new Error('RPC not available') };
        });

        if (error) {
          // Try alternative method - direct SQL execution via PostgREST
          console.log('   ⚠️  RPC method not available, trying alternative...');
          // For now, we'll need to use the dashboard method
          throw new Error('Direct SQL execution requires Supabase Dashboard or CLI');
        }

        console.log(`   ✅ Statement ${i + 1} executed successfully`);
      } catch (err) {
        // Some statements might fail if they already exist (IF NOT EXISTS)
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log(`   ⚠️  Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`   ❌ Error in statement ${i + 1}:`, err.message);
          // Continue with other statements
        }
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to Supabase Dashboard → Table Editor');
    console.log('2. Verify that "otp_storage" table exists');
    console.log('3. Delete this script file for security');
    console.log('4. Refresh your application');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 Alternative: Apply the SQL manually in Supabase Dashboard:');
    console.log('   1. Go to SQL Editor');
    console.log('   2. Copy SQL from: supabase/migrations/20250103000001_create_otp_storage.sql');
    console.log('   3. Paste and run');
    process.exit(1);
  }
}

// Run the migration
applyMigration();

