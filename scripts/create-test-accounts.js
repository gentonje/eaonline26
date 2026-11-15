const { createClient } = require('@supabase/supabase-js');

const url = 'https://svxosqalniuljggecqxx.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) { console.error('SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1); }

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const accounts = [
  { email: 'admin@store.com',      password: 'admin2026', username: 'admin',      full_name: 'Admin User',  role: 'admin',      account_type: 'premium' },
  { email: 'superadmin@store.com', password: 'super2026', username: 'superadmin', full_name: 'Super Admin', role: 'superadmin', account_type: 'premium' },
  { email: 'user@store.com',       password: 'user2026',  username: 'testuser',   full_name: 'Test User',   role: 'user',       account_type: 'basic'   },
];

async function run() {
  for (const acc of accounts) {
    let userId;

    const { data, error } = await admin.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes('already been registered') || error.message.includes('already exists')) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find(u => u.email === acc.email);
        if (existing) { userId = existing.id; console.log(acc.email + ': already exists'); }
      } else {
        console.error(acc.email + ': create FAILED — ' + error.message);
        continue;
      }
    } else {
      userId = data.user?.id;
      console.log(acc.email + ': auth user created');
    }

    if (userId) {
      const { error: profileErr } = await admin.from('profiles').upsert({
        id: userId,
        username: acc.username,
        full_name: acc.full_name,
        role: acc.role,
        is_active: true,
        account_type: acc.account_type,
      });
      if (profileErr) {
        console.error(acc.email + ': profile FAILED — ' + profileErr.message);
      } else {
        console.log(acc.email + ': profile OK  (role=' + acc.role + ', account_type=' + acc.account_type + ')');
      }
    }
  }
  console.log('\n--- Setup complete ---');
  console.log('admin@store.com     / admin2026');
  console.log('superadmin@store.com / super2026');
  console.log('user@store.com      / user2026');
}

run().catch(console.error);
