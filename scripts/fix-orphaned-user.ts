import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function fixOrphanedUser() {
  console.log('\n🔧 Fix Orphaned User Script\n');
  console.log('This script fixes users that exist in auth.users but not in public.users table.\n');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 
    await askQuestion('Enter your Supabase Project URL: ');

  if (!supabaseUrl) {
    console.error('❌ Supabase URL is required!');
    process.exit(1);
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
    await askQuestion('Enter your Supabase Service Role Key (from Settings → API): ');

  if (!serviceRoleKey) {
    console.error('❌ Service Role Key is required!');
    console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
    process.exit(1);
  }

  const email = await askQuestion('Enter the email address to fix: ');

  if (!email) {
    console.error('❌ Email is required!');
    process.exit(1);
  }

  console.log('\n⏳ Checking user status...\n');

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Check if user exists in auth.users
    console.log('1. Checking auth.users table...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) throw listError;

    const authUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!authUser) {
      console.log('❌ User not found in auth.users table');
      console.log('   The email does not exist in Supabase Auth.');
      process.exit(1);
    }

    console.log(`✅ Found user in auth.users: ${authUser.id}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Created: ${authUser.created_at}`);

    // Step 2: Check if profile exists in public.users
    console.log('\n2. Checking public.users table...');
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError && !profileError.message.includes('No rows')) {
      throw profileError;
    }

    if (userProfile) {
      console.log('✅ User profile already exists in public.users table');
      console.log(`   Name: ${userProfile.name}`);
      console.log(`   Email: ${userProfile.email}`);
      console.log(`   Role: ${userProfile.role || 'not set'}`);
      console.log('\n✅ No action needed - user profile exists!');
      process.exit(0);
    }

    console.log('⚠️  User profile NOT found in public.users table');
    console.log('   This is an orphaned user - auth exists but profile is missing.');

    // Step 3: Get user metadata to create profile
    const userName = authUser.user_metadata?.name || 
      await askQuestion('Enter user name (or press Enter to use email): ') || 
      email.split('@')[0];
    
    const userPhone = authUser.user_metadata?.phone || 
      await askQuestion('Enter user phone (optional, press Enter to skip): ') || 
      null;

    // Step 4: Create the missing profile
    console.log('\n3. Creating missing user profile...');
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email!,
        name: userName,
        phone: userPhone || '',
        role: 'bidder', // Required by RLS policy
        approved: false, // Requires admin approval
      });

    if (insertError) {
      // Check if it's a duplicate key error (shouldn't happen but just in case)
      if (insertError.code === '23505') {
        console.log('⚠️  User profile already exists (duplicate key)');
        console.log('   This might be a timing issue. Checking again...');
        
        const { data: checkProfile } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();
        
        if (checkProfile) {
          console.log('✅ User profile now exists!');
          process.exit(0);
        }
      }
      throw insertError;
    }

    console.log('✅ User profile created successfully!');
    console.log('\n🎉 Orphaned user fixed!\n');
    console.log('User Details:');
    console.log(`  ID: ${authUser.id}`);
    console.log(`  Email: ${authUser.email}`);
    console.log(`  Name: ${userName}`);
    console.log(`  Phone: ${userPhone || 'Not set'}`);
    console.log(`  Role: bidder`);
    console.log(`  Approved: false (requires admin approval)`);
    console.log('\n✅ The user can now log in, but needs admin approval to bid.\n');

  } catch (error: any) {
    console.error('\n❌ Error fixing orphaned user:');
    console.error(error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

fixOrphanedUser().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

