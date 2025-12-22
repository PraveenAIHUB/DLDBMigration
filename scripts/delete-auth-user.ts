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

async function deleteAuthUser() {
  console.log('\n🗑️  Delete User from Auth Script\n');
  console.log('This script will delete a user from Supabase Auth (auth.users table).\n');
  console.log('⚠️  WARNING: This will permanently delete the user from authentication.\n');

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

  const email = await askQuestion('Enter the email address to delete: ');

  if (!email) {
    console.error('❌ Email is required!');
    process.exit(1);
  }

  // Confirm deletion
  const confirm = await askQuestion(`\n⚠️  Are you sure you want to delete ${email}? (yes/no): `);
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Deletion cancelled.');
    process.exit(0);
  }

  console.log('\n⏳ Deleting user...\n');

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Find the user
    console.log('1. Finding user in auth.users...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) throw listError;

    const authUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!authUser) {
      console.log('❌ User not found in auth.users table');
      console.log('   The email does not exist in Supabase Auth.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${authUser.id}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Created: ${authUser.created_at}`);

    // Step 2: Check if profile exists in public.users
    console.log('\n2. Checking public.users table...');
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('id', authUser.id)
      .maybeSingle();

    if (userProfile) {
      console.log('⚠️  User profile exists in public.users table:');
      console.log(`   Name: ${userProfile.name}`);
      console.log(`   Email: ${userProfile.email}`);
      
      const deleteProfile = await askQuestion('\n   Do you also want to delete the profile from public.users? (yes/no): ');
      
      if (deleteProfile.toLowerCase() === 'yes') {
        const { error: deleteProfileError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', authUser.id);
        
        if (deleteProfileError) {
          console.error('⚠️  Failed to delete profile:', deleteProfileError.message);
        } else {
          console.log('✅ User profile deleted from public.users');
        }
      }
    } else {
      console.log('ℹ️  No profile found in public.users (orphaned user)');
    }

    // Step 3: Delete from auth.users
    console.log('\n3. Deleting from auth.users...');
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    if (deleteError) {
      throw deleteError;
    }

    console.log('✅ User deleted successfully from auth.users!');
    console.log('\n🎉 User deletion complete!\n');
    console.log('The user can now register again with the same email.\n');

  } catch (error: any) {
    console.error('\n❌ Error deleting user:');
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

deleteAuthUser().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

