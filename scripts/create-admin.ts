import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'readline';

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Helper function to ask questions
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function createAdminUser() {
  console.log('\n🚀 Admin User Creation Script\n');
  console.log('This script will create an admin user in your Supabase database.\n');

  // Get Supabase URL
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 
    await askQuestion('Enter your Supabase Project URL: ');

  if (!supabaseUrl) {
    console.error('❌ Supabase URL is required!');
    process.exit(1);
  }

  // Get Service Role Key (required for admin operations)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
    await askQuestion('Enter your Supabase Service Role Key (from Settings → API): ');

  if (!serviceRoleKey) {
    console.error('❌ Service Role Key is required!');
    console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key');
    process.exit(1);
  }

  // Get admin details
  const email = await askQuestion('Admin Email (default: admin@carbidding.com): ') || 'admin@carbidding.com';
  const name = await askQuestion('Admin Name (default: System Administrator): ') || 'System Administrator';
  
  let password = await askQuestion('Admin Password (min 8 chars): ');
  if (!password || password.length < 8) {
    console.error('❌ Password must be at least 8 characters!');
    process.exit(1);
  }

  // Confirm password
  const confirmPassword = await askQuestion('Confirm Password: ');
  if (password !== confirmPassword) {
    console.error('❌ Passwords do not match!');
    process.exit(1);
  }

  console.log('\n⏳ Creating admin user...\n');

  // Create Supabase admin client
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Create user in Supabase Auth
    console.log('1. Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name,
        role: 'admin',
      },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('⚠️  User already exists in Auth. Updating...');
        // Try to get existing user
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users.find(u => u.email === email);
        
        if (!existingUser) {
          throw new Error('User exists but could not be found');
        }

        // Update password if needed
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          { password: password }
        );

        if (updateError) {
          throw updateError;
        }

        // Use existing user ID
        const userId = existingUser.id;
        console.log('✅ Auth user updated successfully');

        // Step 2: Create/Update entry in admin_users table
        console.log('2. Creating/updating entry in admin_users table...');
        const { error: dbError } = await supabaseAdmin
          .from('admin_users')
          .upsert({
            id: userId,
            email: email,
            name: name,
            password_hash: 'managed_by_auth', // Password is managed by Supabase Auth
          }, {
            onConflict: 'email',
          });

        if (dbError) {
          throw dbError;
        }

        console.log('✅ Admin user entry updated in database');
        console.log('\n🎉 Admin user setup complete!\n');
        console.log('Credentials:');
        console.log(`  Email: ${email}`);
        console.log(`  Password: [the password you entered]`);
        console.log(`  Name: ${name}`);
        console.log('\n✅ You can now login at /admin route\n');
      } else {
        throw authError;
      }
    } else {
      console.log('✅ Auth user created successfully');

      // Step 2: Create entry in admin_users table
      console.log('2. Creating entry in admin_users table...');
      const { error: dbError } = await supabaseAdmin
        .from('admin_users')
        .upsert({
          id: authData.user.id,
          email: email,
          name: name,
          password_hash: 'managed_by_auth', // Password is managed by Supabase Auth
        }, {
          onConflict: 'email',
        });

      if (dbError) {
        throw dbError;
      }

      console.log('✅ Admin user entry created in database');
      console.log('\n🎉 Admin user created successfully!\n');
      console.log('Credentials:');
      console.log(`  Email: ${email}`);
      console.log(`  Password: [the password you entered]`);
      console.log(`  Name: ${name}`);
      console.log(`  User ID: ${authData.user.id}`);
      console.log('\n✅ You can now login at /admin route\n');
    }
  } catch (error: any) {
    console.error('\n❌ Error creating admin user:');
    console.error(error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
createAdminUser().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

