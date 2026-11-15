#!/usr/bin/env node
/**
 * Product seeder — 20 products per country (100 total)
 * Signs in as superadmin, uploads images to Supabase "images" bucket,
 * then inserts published products with product_images records.
 * Run: SUPABASE_URL=... SUPABASE_ANON_KEY=... node seed/seed-products.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL  = process.env.SEED_EMAIL    || 'superadmin@store.com';
const ADMIN_PASS   = process.env.SEED_PASSWORD || 'super2026';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── Image map: key → local file ──────────────────────────────────────────
const IMG = {
  electronics_phone:    'attached_assets/stock_images/electronics_phone_1.jpg',
  electronics_phone2:   'attached_assets/stock_images/electronics_phone_2.jpg',
  electronics_laptop:   'attached_assets/stock_images/electronics_laptop.jpg',
  electronics_tv:       'attached_assets/stock_images/electronics_tv.jpg',
  fashion_dress:        'attached_assets/stock_images/fashion_dress_1.jpg',
  fashion_dress2:       'attached_assets/stock_images/fashion_dress_2.jpg',
  fashion_shoes:        'attached_assets/stock_images/fashion_shoes_1.jpg',
  fashion_shoes2:       'attached_assets/stock_images/fashion_shoes_2.jpg',
  fashion_bag:          'attached_assets/stock_images/fashion_bag.jpg',
  food_coffee:          'attached_assets/stock_images/food_coffee_1.jpg',
  food_coffee2:         'attached_assets/stock_images/food_coffee_2.jpg',
  food_spices:          'attached_assets/stock_images/food_spices.jpg',
  food_honey:           'attached_assets/stock_images/food_honey.jpg',
  food_tea:             'attached_assets/stock_images/food_tea.jpg',
  furniture_chair:      'attached_assets/stock_images/furniture_chair.jpg',
  furniture_table:      'attached_assets/stock_images/furniture_table.jpg',
  beauty_skincare:      'attached_assets/stock_images/beauty_skincare_1.jpg',
  beauty_skincare2:     'attached_assets/stock_images/beauty_skincare_2.jpg',
  beauty_cosmetics:     'attached_assets/stock_images/beauty_cosmetics.jpg',
  sports_equipment:     'attached_assets/stock_images/sports_equipment.jpg',
  sports_jersey:        'attached_assets/stock_images/sports_jersey.jpg',
  agriculture_seeds:    'attached_assets/stock_images/agriculture_seeds.jpg',
  agriculture_tools:    'attached_assets/stock_images/agriculture_tools.jpg',
  handicrafts_basket:   'attached_assets/stock_images/handicrafts_basket_1.jpg',
  handicrafts_basket2:  'attached_assets/stock_images/handicrafts_basket_2.jpg',
  handicrafts_jewelry:  'attached_assets/stock_images/handicrafts_jewelry_1.jpg',
  handicrafts_jewelry2: 'attached_assets/stock_images/handicrafts_jewelry_2.jpg',
  kitchen_cookware:     'attached_assets/stock_images/kitchen_cookware.jpg',
  kitchen_utensils:     'attached_assets/stock_images/kitchen_utensils.jpg',
  books_education:      'attached_assets/stock_images/books_education.jpg',
  solar_panel:          'attached_assets/stock_images/solar_panel.jpg',
};

// ─── 20 products per country ──────────────────────────────────────────────
// [title, description, price (local currency), category, imgKey, qty]
const PRODUCTS = {
  KE: [
    ['Samsung Galaxy A55',       'Latest Samsung mid-range smartphone with 6.6" AMOLED display, 50MP camera, and 5000mAh battery.',                                                42000,  'Electronics',   'electronics_phone',    15],
    ['iPhone 14 Pro (Used)',      'Pre-owned Apple iPhone 14 Pro, 256GB, excellent condition with original charger and box.',                                                       95000,  'Electronics',   'electronics_phone2',    8],
    ['HP Laptop 15',             '15.6" FHD laptop, Intel Core i5, 8GB RAM, 512GB SSD. Ideal for students and professionals.',                                                    58000,  'Electronics',   'electronics_laptop',   10],
    ['LG 43" Smart TV',          '4K UHD Smart TV with built-in Wi-Fi, Netflix, YouTube and HDR. Transforms any room.',                                                           35000,  'Electronics',   'electronics_tv',        6],
    ['Kitenge Maxi Dress',        'Beautiful handmade Kenyan kitenge print maxi dress, available in sizes S-XL. Vibrant patterns.',                                                 3500,  'Fashion',       'fashion_dress',         30],
    ['Leather Oxford Shoes',      'Genuine leather Oxford shoes, hand-stitched, sizes 38-46. Durable and stylish.',                                                                5500,  'Fashion',       'fashion_shoes',         25],
    ['Ladies Handbag',            'Premium faux-leather handbag with multiple compartments, zip closure, and detachable strap.',                                                    2800,  'Fashion',       'fashion_bag',           20],
    ['Kenyan AA Coffee 1kg',      'Premium Kenyan AA grade arabica coffee from Nyeri highlands. Rich, bold flavour. Freshly roasted.',                                             1800,  'Food',          'food_coffee',           50],
    ['Masala Chai Tea 500g',      'Authentic Kenyan masala chai blend with cardamom, ginger, cinnamon and premium Kericho tea.',                                                    650,  'Food',          'food_tea',              80],
    ['Pure Acacia Honey 500ml',   'Raw, unprocessed Kenyan acacia honey from Mt. Kenya region. No additives whatsoever.',                                                           900,  'Food',          'food_honey',            40],
    ['Mixed Spice Set x6',        'Set of 6 East African cooking spices: cumin, coriander, turmeric, pilau masala, chilli, cardamom.',                                             750,  'Food',          'food_spices',           60],
    ['Mahogany Dining Chair',     'Hand-carved solid mahogany dining chair with cushioned seat. Local Kenyan craftsmanship.',                                                       8500,  'Furniture',     'furniture_chair',       12],
    ['Shea Butter Cream 250ml',   '100% natural African shea butter moisturiser, unrefined and handmade. Great for dry skin and hair.',                                             450,  'Beauty',        'beauty_skincare',      100],
    ['Matte Lipstick Set x6',     'Set of 6 long-lasting matte lipsticks in rich African-inspired shades. Cruelty-free formula.',                                                   800,  'Beauty',        'beauty_cosmetics',      50],
    ['Football & Pump Set',       'Size 5 FIFA-approved football with pump and needle. Perfect for parks and pitches.',                                                             1500,  'Sports',        'sports_equipment',      30],
    ['Hybrid Maize Seeds 2kg',    'High-yield hybrid maize seeds certified for East African climate. Expected yield: 40 bags/acre.',                                               1200,  'Agriculture',   'agriculture_seeds',    200],
    ['Hand-woven Kiondo Basket',  'Traditional Kenyan sisal kiondo basket, handwoven by women artisans in Kitui. Eco-friendly.',                                                   1800,  'Handicrafts',   'handicrafts_basket',    35],
    ['Maasai Beaded Necklace',    'Authentic hand-beaded Maasai necklace in traditional red, blue and white patterns. Perfect gift.',                                              1200,  'Handicrafts',   'handicrafts_jewelry',   50],
    ['Sufuria Cooking Set 3pc',   'Non-stick aluminium sufuria set in 3 sizes: 2L, 4L, 6L. Heat-efficient and easy to clean.',                                                    2200,  'Kitchen',       'kitchen_cookware',      25],
    ['Solar Home Light Kit',      '10W solar panel, LED lamp, USB charger. Powers lights for 8+ hours/day. No electricity needed.',                                               6500,  'Electronics',   'solar_panel',           20],
  ],
  UG: [
    ['Tecno Spark 20 Pro',        'Tecno Spark 20 Pro, 6.78" display, 108MP camera, 5000mAh. Great value for Uganda.',                                                          320000,  'Electronics',   'electronics_phone',     20],
    ['Itel Vision 3 Plus',        'Affordable smartphone with large display, dual SIM, and expandable storage. Entry-level best.',                                               150000,  'Electronics',   'electronics_phone2',    30],
    ['Samsung 32" LED TV',        '32-inch Samsung LED TV with clear picture quality and USB media player. Power-efficient.',                                                     380000,  'Electronics',   'electronics_tv',         5],
    ['Gomesi Traditional Dress',  'Elegant Ugandan gomesi dress in premium fabric, tailored to order. Multiple colours.',                                                         120000,  'Fashion',       'fashion_dress2',        15],
    ['Suede Kitten Heels',        'Elegant suede kitten heels, sizes 36-42. Comfortable for all-day wear, office or events.',                                                     85000,  'Fashion',       'fashion_shoes2',        25],
    ['Ugandan Robusta Coffee 1kg','Premium Ugandan robusta coffee from Mbale region. Strong, full-bodied, perfect for espresso.',                                                  25000,  'Food',          'food_coffee2',          60],
    ['Grassland Wildflower Honey','Pure Ugandan wildflower honey from Acholi grasslands. Thick and naturally sweet. 1 litre.',                                                     18000,  'Food',          'food_honey',            45],
    ['Ugandan Vanilla Pods 50g',  'Authentic Ugandan vanilla pods, Grade A. Among the world\'s top vanilla exports.',                                                             35000,  'Food',          'food_spices',           80],
    ['Hardwood Coffee Table',     'Solid hardwood coffee table with African carvings on legs. Handmade in Kampala.',                                                              320000,  'Furniture',     'furniture_table',        8],
    ['Wooden Armchair',           'Comfortable wooden armchair with padded cushion. Locally made from Ugandan timber.',                                                           280000,  'Furniture',     'furniture_chair',       10],
    ['Neem Face Wash 200ml',      'Natural neem and aloe vera face wash, formulated for East African skin types. Deep cleansing.',                                                 15000,  'Beauty',        'beauty_skincare2',      80],
    ['Herbal Hair Growth Oil',    'Blend of castor, coconut and rosemary oils for hair growth. Best seller across Uganda.',                                                        12000,  'Beauty',        'beauty_skincare',       60],
    ['Football Boots (38-45)',    'Moulded-sole football boots for grass and turf. Lightweight, durable, all sizes available.',                                                    65000,  'Sports',        'sports_jersey',         20],
    ['Boda Helmet (DOT rated)',   'DOT-rated motorcycle helmet for boda boda riders. Available in black, red and blue.',                                                           45000,  'Sports',        'sports_equipment',      40],
    ['Hybrid Tomato Seeds 1000pk','High-yield hybrid tomato seeds suitable for Ugandan climate. 1000 seeds per pack.',                                                              8000,  'Agriculture',   'agriculture_seeds',    150],
    ['Panga & Jembe Farm Set',    'Hand-forged panga (machete) and jembe (hoe) set for farming. Heavy-duty carbon steel.',                                                         35000,  'Agriculture',   'agriculture_tools',     60],
    ['Hand-woven Palm Basket',    'Eco-friendly palm leaf basket for storage and décor. Fair trade certified from Luwero.',                                                         22000,  'Handicrafts',   'handicrafts_basket2',   50],
    ['Beaded Anklet Set x3',      'Set of 3 colourful handmade beaded anklets from Ugandan artisans. One size fits all.',                                                           8000,  'Handicrafts',   'handicrafts_jewelry2',  80],
    ['Wooden Cooking Spoons x5',  'Set of 5 hand-carved wooden cooking spoons in different sizes. Food-safe hardwood.',                                                             12000,  'Kitchen',       'kitchen_utensils',     100],
    ['Uganda PLE Study Guides',   'Complete Uganda PLE study guides for all subjects. Includes practice papers and answers.',                                                       25000,  'Books',         'books_education',      200],
  ],
  RW: [
    ['Infinix Hot 40i',           'Infinix Hot 40i, 6.56" display, 50MP camera, 5000mAh. Affordable and reliable for Rwanda.',                                                    85000,  'Electronics',   'electronics_phone',     25],
    ['HP EliteBook 840 (Refurb)', 'Refurbished HP EliteBook 840, Core i5 8th Gen, 16GB RAM, 256GB SSD. Enterprise-grade.',                                                       320000,  'Electronics',   'electronics_laptop',     8],
    ['20W Solar Lantern',         '20W solar lantern with USB charging port and 3 brightness levels. Ideal for rural homes.',                                                       42000,  'Electronics',   'solar_panel',           30],
    ['African Print Blouse',      'Bright African print blouse, tailored in Kigali workshops. Available in sizes XS-XXL.',                                                          8500,  'Fashion',       'fashion_dress',         40],
    ['Cowhide Leather Tote Bag',  'Genuine cowhide leather tote bag, hand-stitched in Kigali. Spacious and built to last.',                                                        28000,  'Fashion',       'fashion_bag',           15],
    ['Rwandan Arabica Coffee',    'Single-origin Rwandan arabica from Musanze highlands. Award-winning, freshly roasted.',                                                          12000,  'Food',          'food_coffee',           70],
    ['Kigali Tea Collection',     'Assorted Rwanda teas: green, black and herbal varieties from Mulindi estate. Gift-ready box.',                                                    6500,  'Food',          'food_tea',              90],
    ['Macadamia & Honey Gift Set','250ml Rwandan honey + 200g roasted macadamia nuts. Popular wedding and corporate gift.',                                                         14000,  'Food',          'food_honey',            35],
    ['Bamboo 4-Seater Dining Set','Eco-friendly bamboo dining table with 4 chairs. Lightweight, durable, sustainably sourced.',                                                   180000,  'Furniture',     'furniture_table',        5],
    ['Rattan Accent Chair',       'Hand-woven rattan accent chair with cushion. Modern, eco-friendly, fits any interior.',                                                          95000,  'Furniture',     'furniture_chair',        8],
    ['Turmeric Glow Serum',       'Natural face serum with Rwandan turmeric and vitamin C. Brightens and evens skin tone.',                                                         9500,  'Beauty',        'beauty_skincare',       70],
    ['Shea & Cocoa Butter Lotion','Rich body lotion blending shea and cocoa butter. Deep moisturising for all skin types.',                                                          7500,  'Beauty',        'beauty_skincare2',      90],
    ['Rwanda Cycling Jersey',     'High-quality moisture-wicking cycling jersey in Rwanda national team colours. All sizes.',                                                        18000,  'Sports',        'sports_jersey',         25],
    ['Climbing Bean Seeds 1kg',   'High-yield climbing bean seeds adapted for Rwandan highlands. Certified, 1kg pack.',                                                              3500,  'Agriculture',   'agriculture_seeds',    200],
    ['Garden Watering Can & Trowel','Galvanised steel watering can (8L) and hand trowel. Essential for kitchen gardens.',                                                           7500,  'Agriculture',   'agriculture_tools',     50],
    ['Agaseke Peace Basket',      'Traditional Rwandan agaseke peace basket, handwoven with natural fibres and dyed grass.',                                                        18000,  'Handicrafts',   'handicrafts_basket2',   45],
    ['Imigongo Art Painting',     'Traditional Rwandan imigongo geometric art, hand-painted using natural pigments. Unique décor.',                                                 35000,  'Handicrafts',   'handicrafts_basket',    30],
    ['Copper Wire Jewelry Set',   'Handcrafted copper wire necklace and earring set by Kigali artisans. Unique wearable art.',                                                      12000,  'Handicrafts',   'handicrafts_jewelry',   60],
    ['Non-stick Induction Pan Set','3-piece non-stick induction-compatible pan set. PFOA-free coating. Oven-safe up to 220°C.',                                                    22000,  'Kitchen',       'kitchen_cookware',      30],
    ['Rwanda TVET Textbooks Set', 'Complete TVET textbooks for year 1-2 students. Government curriculum aligned.',                                                                  15000,  'Books',         'books_education',       80],
  ],
  ET: [
    ['Tecno Camon 30',            'Tecno Camon 30, 6.78" AMOLED, 50MP AI camera, 5000mAh. Best value in Ethiopia.',                                                              5800,  'Electronics',   'electronics_phone',     20],
    ['Samsung A34 5G (Imported)', 'Samsung Galaxy A34 5G, 128GB, Awesome Violet. Imported, unlocked for all networks.',                                                           9200,  'Electronics',   'electronics_phone2',    12],
    ['25W Solar Charge Kit',      '25W solar panel, charge controller, 2 LED lights, USB ports. Full kit for rural homes.',                                                       3800,  'Electronics',   'solar_panel',           25],
    ['Habesha Kemis (Traditional)','Elegant Ethiopian habesha kemis in white and gold. Handwoven Shema fabric. Sizes S-XL.',                                                       1800,  'Fashion',       'fashion_dress',         25],
    ['Ethiopian Leather Sandals', 'Hand-stitched Ethiopian leather sandals, sizes 36-47. Addis Ababa artisan-made heritage.',                                                       800,  'Fashion',       'fashion_shoes',         40],
    ['Yirgacheffe Coffee 1kg',    'World-famous Ethiopian Yirgacheffe coffee, light roast, natural process. Floral and fruity.',                                                    950,  'Food',          'food_coffee',          100],
    ['Harrar Coffee Beans 1kg',   'Bold Ethiopian Harrar coffee, sun-dried, natural process. Deeply aromatic, wine-like notes.',                                                    850,  'Food',          'food_coffee2',          80],
    ['Berbere Spice Blend 500g',  'Authentic Ethiopian berbere spice mix, ground from 15+ spices. Key for injera and stews.',                                                       350,  'Food',          'food_spices',          120],
    ['Ethiopian Tej Honey 1kg',   'Pure Ethiopian highland honey, raw and unfiltered. Naturally sweet and medicinal quality.',                                                       480,  'Food',          'food_honey',            90],
    ['Tej Honey Wine 750ml',      'Traditional Ethiopian tej (honey wine), lightly fermented, natural and additive-free.',                                                           280,  'Food',          'food_honey',            60],
    ['Gesho Leaves 500g',         'Dried Ethiopian gesho (hop) leaves for tej and Ethiopian beer brewing. Sun-dried.',                                                               180,  'Food',          'food_tea',             150],
    ['Teff Grain 5kg',            'Authentic Ethiopian teff grain (white & brown), gluten-free, high in iron and protein.',                                                          550,  'Food',          'food_spices',          200],
    ['Mesob Dining Basket',       'Traditional Ethiopian mesob (woven dining table) for serving injera. Handwoven rattan.',                                                         1200,  'Furniture',     'furniture_table',       20],
    ['Gemberi Hardwood Stool',    'Hand-carved Ethiopian hardwood stool with traditional leather seat. Unique and functional.',                                                     2200,  'Furniture',     'furniture_chair',       15],
    ['Korfad Natural Soap Set x4','Set of 4 handmade Ethiopian natural soaps with neem, honey and coffee extracts.',                                                                450,  'Beauty',        'beauty_skincare',      120],
    ['Ethiopian Rose Water 200ml','100% pure Ethiopian rose water, steam-distilled. Skin toner, hair mist and cooking ingredient.',                                                  320,  'Beauty',        'beauty_skincare2',      80],
    ['Leather Handmade Journal',  'Hand-tooled Ethiopian leather journal with 200 cotton pages. Perfect for writing and gifting.',                                                   650,  'Handicrafts',   'handicrafts_basket',    60],
    ['Coptic Cross Necklace',     'Traditional Ethiopian coptic cross pendant, 60cm chain, hand-crafted in silver-tone metal.',                                                      480,  'Handicrafts',   'handicrafts_jewelry2',  80],
    ['Clay Jebena Coffee Pot',    'Traditional Ethiopian clay jebena for the authentic coffee ceremony. Artisan-made.',                                                              380,  'Handicrafts',   'handicrafts_basket2',   40],
    ['Gena Sport Set (Ethiopian Hockey)','Traditional Ethiopian gena stick and ball set. Play the oldest team sport in Africa.',                                                     750,  'Sports',        'sports_equipment',      20],
  ],
  SS: [
    ['Itel P55 Smartphone',       'Itel P55, 6.6" display, 5000mAh massive battery. Long-lasting smartphone for South Sudan.',                                                    35000,  'Electronics',   'electronics_phone',     18],
    ['Huawei Y9a (Imported)',     'Huawei Y9a 128GB, 6.63" display, 40MP selfie camera. Imported, unlocked for all networks.',                                                    72000,  'Electronics',   'electronics_phone2',    10],
    ['Solar Torch & Power Bank',  'Waterproof solar torch with built-in 10000mAh power bank. Charges phones, lights spaces.',                                                      18000,  'Electronics',   'solar_panel',           40],
    ['Ankara Print Wrap Dress',   'Ankara fabric wrap dress, handmade in Juba. Bold African prints, multiple colour ways.',                                                        18000,  'Fashion',       'fashion_dress2',        25],
    ['Leather Open-toe Sandals',  'Durable leather open-toe sandals, sizes 36-45. Comfortable and breathable for warm climate.',                                                   12000,  'Fashion',       'fashion_shoes2',        35],
    ['South Sudan Highland Coffee','Rare South Sudanese highland coffee, limited production. Smooth and mild with nutty finish.',                                                   15000,  'Food',          'food_coffee2',          30],
    ['Wildflower Honey 500ml',    'Pure raw honey from South Sudanese wildflower hives. Thick, amber and highly nutritious.',                                                       7000,  'Food',          'food_honey',            50],
    ['Moringa Leaf Powder 500g',  'Premium South Sudanese moringa leaf powder. Rich in vitamins, minerals and antioxidants.',                                                       8500,  'Food',          'food_spices',          100],
    ['Sesame Seeds 2kg',          'Clean sesame seeds from South Sudan\'s fertile fields. High oil content for cooking.',                                                            6500,  'Agriculture',   'agriculture_seeds',    150],
    ['Organic Sorghum Grain 5kg', 'Organic sorghum grain. Drought-resistant staple crop. Gluten-free wheat alternative.',                                                           5500,  'Agriculture',   'agriculture_seeds',    200],
    ['Farming Hoe & Rake Set',    'Heavy-duty farming hoe and rake with wooden handles. Essential tools for small-scale farmers.',                                                  22000,  'Agriculture',   'agriculture_tools',     80],
    ['Bamboo 4-Tier Bookshelf',   'Eco-friendly bamboo bookshelf, 4 tiers, easy assembly. Great for homes and offices in Juba.',                                                   85000,  'Furniture',     'furniture_table',        6],
    ['Folding Chairs 4-Pack',     'Lightweight folding chairs, weather-resistant, stackable. Ideal for events and homes.',                                                          28000,  'Furniture',     'furniture_chair',       40],
    ['Raw Shea Butter 1kg',       'Unrefined raw shea butter, hand-extracted. Excellent for skin and hair care. Export quality.',                                                    9500,  'Beauty',        'beauty_skincare',       80],
    ['Herbal Body Soap 3-Pack',   'Handmade herbal soap bars with shea, neem and aloe. Natural, suitable for sensitive skin.',                                                       5500,  'Beauty',        'beauty_skincare2',      90],
    ['Dinka Beaded Necklace',     'Traditional Dinka hand-beaded necklace in ivory, red and black. Authentic South Sudanese art.',                                                  8500,  'Handicrafts',   'handicrafts_jewelry',   40],
    ['Nuer Hand-woven Grass Basket','Hand-woven grass basket by Nuer artisans from Jonglei. Storage, décor and gifting.',                                                          12000,  'Handicrafts',   'handicrafts_basket',    30],
    ['Wooden Cooking Utensils Set','Hand-carved utensils set: 2 spoons, spatula, ladle. Made from local South Sudan hardwood.',                                                     9000,  'Kitchen',       'kitchen_utensils',      60],
    ['Volleyball & Net Set',      'Regulation size volleyball with portable net and poles. Great for community and school play.',                                                   32000,  'Sports',        'sports_equipment',      15],
    ['Primary Curriculum Books Set','Complete primary school curriculum books grades 1-3. Government approved South Sudan.',                                                        12000,  'Books',         'books_education',      150],
  ],
};

const DISTRICTS = {
  KE: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
  UG: ['Kampala', 'Entebbe', 'Jinja', 'Gulu', 'Mbarara'],
  RW: ['Kigali', 'Butare', 'Gisenyi'],
  ET: ['Addis Ababa', 'Dire Dawa', 'Mekelle'],
  SS: ['Juba', 'Wau', 'Malakal'],
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🌍 East Africa Online — Product Seeder\n');

  // 1. Sign in as admin
  console.log(`🔐 Signing in as ${ADMIN_EMAIL}...`);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL, password: ADMIN_PASS,
  });
  if (authErr) throw new Error('Auth failed: ' + authErr.message);
  const userId = authData.user.id;
  console.log(`✓ Signed in. User ID: ${userId}\n`);

  // 2. Get countries
  const { data: countries, error: cErr } = await supabase.from('countries').select('id, code');
  if (cErr) throw new Error('countries fetch: ' + cErr.message);
  const countryMap = {};
  for (const c of countries) countryMap[c.code] = c.id;

  // 3. Upload images
  console.log('📤 Uploading images to Supabase storage bucket "images"...\n');
  const uploaded = {}; // key → storagePath

  for (const [key, localPath] of Object.entries(IMG)) {
    const fullPath = path.join(process.cwd(), localPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  ⚠️  Missing: ${localPath}`);
      continue;
    }
    const ext  = path.extname(localPath) || '.jpg';
    const dest = `seed/${key}${ext}`;
    const buf  = fs.readFileSync(fullPath);
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';

    const { error: upErr } = await supabase.storage
      .from('images')
      .upload(dest, buf, { contentType: mime, upsert: true });

    if (upErr) {
      console.warn(`  ✗ ${key}: ${upErr.message}`);
    } else {
      uploaded[key] = dest;
      console.log(`  ✓ ${key} → ${dest}`);
    }
    await sleep(80); // small delay to avoid rate limits
  }

  console.log(`\n✅ ${Object.keys(uploaded).length}/${Object.keys(IMG).length} images uploaded\n`);

  // 4. Seed products
  let total = 0;
  for (const [code, products] of Object.entries(PRODUCTS)) {
    const countryId = countryMap[code];
    if (!countryId) { console.warn(`⚠️  Country ${code} not found`); continue; }
    const districts = DISTRICTS[code] || ['Capital'];

    console.log(`\n── ${code} (${products.length} products) ───────────────────────`);

    for (let i = 0; i < products.length; i++) {
      const [title, description, price, category, imgKey, qty] = products[i];
      const storagePath = uploaded[imgKey] || uploaded['electronics_phone'] || null;
      const county = districts[i % districts.length];

      const { data: prod, error: pErr } = await supabase
        .from('products')
        .insert({
          user_id: userId,
          title,
          description,
          price,
          category,
          available_quantity: qty,
          storage_path: storagePath,
          product_status: 'published',
          country_id: countryId,
          county,
        })
        .select('id')
        .single();

      if (pErr) { console.warn(`  ✗ ${title}: ${pErr.message}`); continue; }

      if (storagePath) {
        const { error: iErr } = await supabase.from('product_images').insert({
          product_id: prod.id,
          storage_path: storagePath,
          is_main: true,
          display_order: 0,
        });
        if (iErr) console.warn(`  ⚠️  img record ${title}: ${iErr.message}`);
      }

      total++;
      console.log(`  [${total}] ${title} | ${category} | ${county} | ${price.toLocaleString()}`);
    }
  }

  console.log(`\n🎉 Done! Seeded ${total} products across 5 countries.\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
