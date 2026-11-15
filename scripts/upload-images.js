const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(
  'https://svxosqalniuljggecqxx.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const imageMap = [
  { index: 0, images: ['iphone_17_pro_max_1.png', 'iphone_17_pro_max_2.png'] },
  { index: 1, images: ['samsung_s26_ultra_1.png', 'samsung_s26_ultra_2.png'] },
  { index: 2, images: ['pixel_10_pro_1.png', 'pixel_10_pro_2.png'] },
  { index: 3, images: ['oneplus_15_1.png', 'oneplus_15_2.png'] },
  { index: 4, images: ['xiaomi_15_ultra_1.png', 'xiaomi_15_ultra_2.png'] },
  { index: 5, images: ['samsung_a56_1.png', 'samsung_a56_2.png'] },
  { index: 6, images: ['iphone_17_pro_1.png', 'iphone_17_pro_2.png'] },
  { index: 7, images: ['samsung_s26_plus_1.png', 'samsung_s26_plus_2.png'] },
  { index: 8, images: ['pixel_10_1.png', 'pixel_10_2.png'] },
  { index: 9, images: ['z_fold_7_1.png', 'z_fold_7_2.png'] },
  { index: 10, images: ['z_flip_7_1.png', 'z_flip_7_2.png'] },
  { index: 11, images: ['tecno_phantom_v2_1.png', 'tecno_phantom_v2_2.png'] },
  { index: 12, images: ['iphone_17_1.png', 'iphone_17_2.png'] },
  { index: 13, images: ['samsung_s26_1.png', 'samsung_s26_2.png'] },
  { index: 14, images: ['tecno_camon_40_1.png', 'tecno_camon_40_2.png'] },
  { index: 15, images: ['infinix_note_50_1.png', 'infinix_note_50_2.png'] },
  { index: 16, images: ['samsung_a16_1.png', 'samsung_a16_2.png'] },
  { index: 17, images: ['redmi_note_14_pro_1.png', 'redmi_note_14_pro_2.png'] },
  { index: 18, images: ['iphone_17_air_1.png', 'iphone_17_air_2.png'] },
  { index: 19, images: ['samsung_s25_fe_1.png', 'samsung_s25_fe_2.png'] },
  { index: 20, images: ['pixel_9a_1.png', 'pixel_9a_2.png'] },
  { index: 21, images: ['nothing_3a_pro_1.png', 'nothing_3a_pro_2.png'] },
  { index: 22, images: ['moto_edge_60_1.png', 'moto_edge_60_2.png'] },
  { index: 23, images: ['huawei_pura_80_1.png', 'huawei_pura_80_2.png'] },
  { index: 24, images: ['iphone_16e_1.png', 'iphone_16e_2.png'] },
  { index: 25, images: ['samsung_s25_ultra_1.png', 'samsung_s25_ultra_2.png'] },
  { index: 26, images: ['pixel_10_pro_xl_1.png', 'pixel_10_pro_xl_2.png'] },
  { index: 27, images: ['oppo_find_x8_1.png', 'oppo_find_x8_2.png'] },
  { index: 28, images: ['cmf_phone_2_1.png', 'cmf_phone_2_2.png'] },
  { index: 29, images: ['moto_g_play_1.png', 'moto_g_play_2.png'] },
];

async function uploadAndLink() {
  const { data: products, error: fetchErr } = await sb.from('products').select('id, title').order('created_at');
  if (fetchErr) { console.error('Fetch error:', fetchErr); return; }

  console.log(`Found ${products.length} products. Uploading images...\n`);

  await sb.from('product_images').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared old product_images entries.\n');

  for (const mapping of imageMap) {
    const product = products[mapping.index];
    if (!product) continue;

    console.log(`${mapping.index + 1}. ${product.title}`);
    
    const uploadedPaths = [];
    
    for (let i = 0; i < mapping.images.length; i++) {
      const imageName = mapping.images[i];
      const localPath = path.join(__dirname, '..', 'images', 'phones', imageName);
      
      if (!fs.existsSync(localPath)) {
        console.log(`   ⚠ Image not found: ${localPath}`);
        continue;
      }

      const fileBuffer = fs.readFileSync(localPath);
      const storagePath = `phones/${imageName}`;
      
      const { error: uploadErr } = await sb.storage
        .from('images')
        .upload(storagePath, fileBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadErr) {
        console.log(`   ⚠ Upload error for ${imageName}: ${uploadErr.message}`);
      } else {
        uploadedPaths.push({ path: storagePath, isMain: i === 0 });
        console.log(`   ✓ Uploaded ${imageName}`);
      }
    }

    if (uploadedPaths.length > 0) {
      const mainPath = uploadedPaths[0].path;
      await sb.from('products').update({ storage_path: mainPath }).eq('id', product.id);

      const imageRecords = uploadedPaths.map((img, idx) => ({
        product_id: product.id,
        storage_path: img.path,
        is_main: img.isMain,
      }));

      const { error: insertErr } = await sb.from('product_images').insert(imageRecords);
      if (insertErr) {
        console.log(`   ⚠ product_images insert error: ${insertErr.message}`);
      } else {
        console.log(`   ✓ Linked ${uploadedPaths.length} images to product\n`);
      }
    }
  }

  console.log('\n✅ All images uploaded and linked successfully!');
}

uploadAndLink().catch(console.error);
