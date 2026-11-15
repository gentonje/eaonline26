const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
(async () => {
  await sb.auth.signInWithPassword({ email: 'superadmin@store.com', password: 'super2026' });
  const { data: products } = await sb.from('products').select('id, storage_path').eq('product_status','published');
  console.log('Total products:', products.length);
  const unique = new Set(products.map(p => p.storage_path));
  console.log('Unique storage paths:', unique.size);
  // count starting with seed/p-
  const reassigned = products.filter(p => p.storage_path?.startsWith('seed/p-')).length;
  const newOnes = products.filter(p => p.storage_path?.startsWith('seed/n-')).length;
  console.log('Reassigned (p-):', reassigned, 'New (n-):', newOnes);
})();
