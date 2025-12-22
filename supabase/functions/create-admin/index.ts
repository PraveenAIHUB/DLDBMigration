import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@carbidding.com',
      password: 'Admin2024!',
      email_confirm: true,
    });

    if (authError) throw authError;

    const { error: dbError } = await supabaseAdmin
      .from('admin_users')
      .upsert({
        id: authData.user.id,
        email: 'admin@carbidding.com',
        name: 'System Admin',
        password_hash: 'managed_by_auth',
      });

    if (dbError) throw dbError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin user created',
        credentials: {
          email: 'admin@carbidding.com',
          password: 'Admin2024!'
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});