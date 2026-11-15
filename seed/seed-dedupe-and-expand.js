#!/usr/bin/env node
/**
 * Fix duplicate product images + add 200 new diverse products.
 *
 * Strategy:
 *  1. For each existing published product, assign a brand-new unique image
 *     fetched from a category-specific stock-image pool. Re-uploads with a
 *     unique storage path tied to product id, then updates products + product_images.
 *  2. Insert 200 new diverse products distributed across 5 East African
 *     countries and 11 categories (8 existing + 3 new: Food, Furniture, Art),
 *     each with its own unique image.
 *
 * Images are resized to 800px wide, JPEG q80, to keep loading fast.
 */
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const https = require('https');
const http = require('http');
const fs = require('fs');
const { URL } = require('url');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ── Image fetching helpers ────────────────────────────────────────────────
function fetchBuffer(rawUrl, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/jpeg,image/*,*/*',
        'Referer': `${parsed.protocol}//${parsed.hostname}/`,
      },
      timeout: 6000,
    }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        return fetchBuffer(res.headers.location, maxRedirects - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchResizeUpload(url, storageKey) {
  const raw = await fetchBuffer(url);
  if (raw.length < 1500) throw new Error(`Too small: ${raw.length}`);
  const resized = await sharp(raw)
    .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  const { error } = await sb.storage.from('images').upload(storageKey, resized, {
    contentType: 'image/jpeg', upsert: true,
  });
  if (error) throw error;
  return storageKey;
}

function withTimeout(promise, ms, label='timeout') {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms)),
  ]);
}

// Try multiple URLs from category pool until one works
async function tryUploadFromCategory(category, storageKey, maxAttempts = 4) {
  for (let i = 0; i < maxAttempts; i++) {
    const url = nextUrlFor(category);
    if (!url) return null;
    try {
      await withTimeout(fetchResizeUpload(url, storageKey), 12000, 'upload-timeout');
      return url;
    } catch (e) {
      // try the next url
    }
  }
  return null;
}

function log(msg) {
  process.stdout.write(msg + '\n');
}

// ── Category → URL pool mapping ───────────────────────────────────────────
const POOL = JSON.parse(fs.readFileSync('seed/image-pool.json', 'utf8'));
function bucket(...queries) {
  const out = [];
  queries.forEach(q => { if (POOL[q]) out.push(...POOL[q]); });
  // De-dupe
  return Array.from(new Set(out));
}

const CATEGORY_POOLS = {
  Electronics: bucket(
    'smartphone product photo white background',
    'laptop computer product photo',
    'wireless bluetooth headphones product',
    'bluetooth speaker product photo',
    'smartwatch product photo',
    'tablet device product photo',
    'wireless earbuds product photo',
    'power bank charger product',
    'led tv product photo',
    'digital camera product photo',
  ),
  Fashion: bucket(
    'leather handbag product photo',
    'sunglasses product photo white background',
    'leather wallet mens product',
    'silk scarf product photo',
    'wristwatch product photo',
    'african beaded necklace jewelry',
    'leather sneakers product photo',
    'leather sandals product white',
  ),
  Clothing: bucket(
    'ankara dress african fashion product',
    'kitenge mens shirt product',
    'african kanga fabric product',
    'mens suit product photo',
    'denim jeans product photo',
    'winter jacket product photo',
  ),
  Handicrafts: bucket(
    'african wood carving sculpture',
    'woven straw basket african',
    'clay pottery handmade product',
    'african tribal mask wooden',
    'maasai beaded jewelry product',
  ),
  Sports: bucket(
    'running shoes product photo',
    'football soccer ball product',
    'yoga mat product photo',
    'dumbbells gym equipment',
    'mountain bicycle product',
  ),
  Beauty: bucket(
    'perfume bottle product photo white',
    'skincare cream jar product',
    'lipstick makeup product photo',
    'shea butter natural product',
    'essential oil bottle product',
  ),
  Children: bucket(
    'kids toys product photo',
    'baby clothes product photo',
    'children backpack school product',
  ),
  Kitchen: bucket(
    'cooking pot product photo',
    'kitchen blender product',
    'ceramic dinnerware set product',
  ),
  Food: bucket(
    'african spices product jar',
    'coffee beans product packaging',
    'honey jar product photo',
    'tea leaves product packaging',
  ),
  Furniture: bucket(
    'wooden chair product photo',
    'modern table lamp product',
  ),
  Art: bucket(
    'african art painting canvas',
  ),
};

// Pool cursors so each product gets a distinct URL within its category
const CURSORS = {};
function nextUrlFor(category) {
  const pool = CATEGORY_POOLS[category];
  if (!pool || !pool.length) return null;
  CURSORS[category] = (CURSORS[category] || 0);
  const u = pool[CURSORS[category] % pool.length];
  CURSORS[category]++;
  return u;
}

// ── 200 new product catalog: name pools per category, distributed across countries ──
// price multipliers per country relative to KES base
const COUNTRY_INFO = {
  KE: { name: 'Kenya', cities: ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika','Malindi'], mult: 1, currency: 'KES' },
  UG: { name: 'Uganda', cities: ['Kampala','Entebbe','Jinja','Gulu','Mbarara','Mbale'], mult: 28, currency: 'UGX' },
  RW: { name: 'Rwanda', cities: ['Kigali','Butare','Gisenyi','Musanze','Huye'], mult: 9, currency: 'RWF' },
  ET: { name: 'Ethiopia', cities: ['Addis Ababa','Dire Dawa','Mekelle','Gondar','Hawassa','Bahir Dar'], mult: 0.4, currency: 'ETB' },
  SS: { name: 'South Sudan', cities: ['Juba','Wau','Malakal','Yambio','Torit'], mult: 12, currency: 'SSP' },
};

// Each entry: { name, basePriceKES, descKey }
const CATALOG = {
  Electronics: [
    { name: 'Samsung Galaxy A55 5G', price: 38000, desc: '6.6" Super AMOLED, 128GB, 50MP triple camera. Official warranty.' },
    { name: 'Tecno Camon 30 Pro', price: 28500, desc: 'Flagship 50MP camera, 12GB RAM, AMOLED display. Latest model.' },
    { name: 'Infinix Note 40 Pro', price: 25000, desc: '108MP camera, 5000mAh, 70W fast charging.' },
    { name: 'Xiaomi Redmi 13C', price: 14500, desc: 'Budget Android with 50MP camera, 6GB RAM, dual SIM.' },
    { name: 'Oppo A78', price: 22000, desc: 'Sleek mid-range with 67W SuperVOOC charging.' },
    { name: 'iPhone 13 (Refurbished)', price: 65000, desc: '128GB unlocked, excellent condition, 90-day warranty.' },
    { name: 'HP Pavilion 15 Laptop', price: 78000, desc: 'Intel Core i5, 8GB RAM, 512GB SSD, Windows 11.' },
    { name: 'Lenovo IdeaPad 3', price: 65000, desc: 'AMD Ryzen 5, 8GB RAM, 256GB SSD. Perfect for students.' },
    { name: 'Dell Inspiron 14', price: 82000, desc: 'Intel i7 11th gen, 16GB RAM, 512GB SSD.' },
    { name: 'MacBook Air M2 (Refurb)', price: 145000, desc: '13" Retina, 8GB unified memory, 256GB.' },
    { name: 'Sony WH-CH720N Headphones', price: 18500, desc: 'Wireless noise-cancelling over-ear headphones.' },
    { name: 'JBL Tune 510BT', price: 6500, desc: 'On-ear wireless headphones, 40-hour battery.' },
    { name: 'Anker Soundcore Life Q30', price: 9800, desc: 'Hybrid active noise cancelling Bluetooth headphones.' },
    { name: 'JBL Flip 6 Speaker', price: 13500, desc: 'Portable Bluetooth speaker, IP67 waterproof, 12hr playback.' },
    { name: 'Bose SoundLink Mini', price: 19500, desc: 'Premium portable Bluetooth speaker with rich bass.' },
    { name: 'Anker Soundcore Boom 2', price: 11200, desc: 'BassUp Bluetooth speaker with deep bass and 24hr playback.' },
    { name: 'Apple Watch Series 9 GPS', price: 48000, desc: '45mm aluminium case, sport band, latest health features.' },
    { name: 'Samsung Galaxy Watch 6', price: 35000, desc: '44mm Bluetooth, ECG, sleep tracking.' },
    { name: 'Huawei Band 8', price: 6800, desc: 'Slim fitness band, 14-day battery, blood oxygen monitor.' },
    { name: 'Fitbit Versa 4', price: 22000, desc: 'Fitness smartwatch with built-in GPS, 6+ day battery.' },
    { name: 'iPad 10th Gen 64GB', price: 52000, desc: '10.9" Liquid Retina display, A14 chip, Wi-Fi.' },
    { name: 'Samsung Galaxy Tab A9+', price: 28500, desc: '11" tablet, 64GB, Wi-Fi, great for entertainment.' },
    { name: 'Lenovo Tab M10 Plus', price: 21000, desc: '10.6" 2K display, 4GB RAM, 128GB.' },
    { name: 'AirPods Pro 2nd Gen', price: 32000, desc: 'Active noise cancellation, MagSafe charging case.' },
    { name: 'Samsung Galaxy Buds 2', price: 12500, desc: 'Wireless ANC earbuds with crystal clear calls.' },
    { name: 'Anker Liberty 4 NC', price: 13800, desc: 'Adaptive noise cancelling earbuds with 50hr battery.' },
    { name: 'Anker PowerCore 20000mAh', price: 4500, desc: 'High-capacity power bank with 20W fast charging.' },
    { name: 'Belkin BoostCharge 10000', price: 3200, desc: 'Slim 10000mAh power bank, USB-C PD output.' },
    { name: 'Hisense 43" Smart TV', price: 42000, desc: '43A4K Smart UHD with VIDAA OS and Netflix.' },
    { name: 'TCL 50" 4K UHD TV', price: 58000, desc: '4K HDR Google TV with Dolby Audio.' },
    { name: 'Samsung 32" LED TV', price: 25000, desc: 'HD Ready LED TV, USB Movie playback.' },
    { name: 'Canon EOS Rebel T7 DSLR', price: 65000, desc: '24.1MP DSLR with 18-55mm lens kit.' },
    { name: 'Sony Alpha a6000 Mirrorless', price: 78000, desc: '24.3MP APS-C mirrorless with 16-50mm lens.' },
    { name: 'Nikon D3500 DSLR Kit', price: 62000, desc: '24.2MP DSLR with 18-55mm VR lens.' },
  ],
  Fashion: [
    { name: 'Genuine Leather Handbag', price: 4800, desc: 'Hand-crafted brown leather shoulder bag, durable and stylish.' },
    { name: 'Tote Travel Handbag', price: 3500, desc: 'Spacious tote bag with internal compartments.' },
    { name: 'Crossbody Bucket Bag', price: 4200, desc: 'Trendy bucket bag with adjustable strap.' },
    { name: 'Mini Crossbody Purse', price: 2800, desc: 'Compact crossbody for essentials, multiple colors.' },
    { name: 'Aviator Sunglasses', price: 1800, desc: 'Classic aviator with UV400 protection.' },
    { name: 'Wayfarer Sunglasses', price: 1500, desc: 'Iconic wayfarer style, polarised lenses.' },
    { name: 'Round Retro Sunglasses', price: 1700, desc: 'Vintage round-frame sunglasses, unisex.' },
    { name: 'Cat-Eye Sunglasses', price: 1900, desc: 'Elegant cat-eye sunglasses for women.' },
    { name: 'Leather Bifold Wallet', price: 2200, desc: 'Genuine leather bifold with RFID protection.' },
    { name: 'Slim Card Holder Wallet', price: 1800, desc: 'Minimalist slim wallet, holds 8 cards.' },
    { name: 'Long Zipper Wallet', price: 2500, desc: 'Long zip-around wallet with phone compartment.' },
    { name: 'Pure Silk Scarf', price: 3200, desc: 'Hand-printed pure silk scarf, 90x90cm.' },
    { name: 'Cotton Maasai Scarf', price: 1500, desc: 'Traditional shuka-pattern scarf.' },
    { name: 'Casio Classic Watch', price: 4500, desc: 'Classic stainless steel quartz watch.' },
    { name: 'Fossil Leather Watch', price: 8500, desc: 'Premium leather strap watch with date display.' },
    { name: 'Digital Sport Watch', price: 1800, desc: 'Multi-function digital watch, water resistant.' },
    { name: 'Beaded Maasai Necklace', price: 2200, desc: 'Hand-beaded traditional Maasai necklace, vibrant.' },
    { name: 'Brass Statement Necklace', price: 3500, desc: 'Bold brass statement piece, ethically made.' },
    { name: 'Beaded Choker Set', price: 1500, desc: 'Multi-strand beaded choker, set of 3.' },
    { name: 'White Leather Sneakers', price: 4200, desc: 'Minimalist white leather sneakers, unisex.' },
    { name: 'Casual Canvas Sneakers', price: 2500, desc: 'Lightweight canvas sneakers, lace-up.' },
    { name: 'High-Top Sneakers', price: 3800, desc: 'Classic high-top sneakers in multiple colors.' },
    { name: 'Brown Leather Sandals', price: 2800, desc: 'Hand-crafted Akala leather sandals.' },
    { name: 'Beaded Leather Sandals', price: 3200, desc: 'Maasai-beaded leather sandals, premium quality.' },
  ],
  Clothing: [
    { name: 'Ankara Wrap Dress', price: 3500, desc: 'Beautiful ankara wrap dress, custom sizes available.' },
    { name: 'Kitenge Maxi Dress', price: 3800, desc: 'Long flowing kitenge maxi for special occasions.' },
    { name: 'Off-Shoulder African Dress', price: 4200, desc: 'Trendy off-shoulder dress in vibrant prints.' },
    { name: 'Ankara Pencil Skirt', price: 1800, desc: 'Bodycon pencil skirt, knee-length.' },
    { name: 'Two-Piece Kitenge Set', price: 5500, desc: 'Coordinated top and skirt set in matching prints.' },
    { name: 'Kitenge Mens Shirt', price: 2200, desc: 'Tailored short-sleeve African print shirt.' },
    { name: 'Embroidered Dashiki Shirt', price: 2800, desc: 'Premium dashiki with traditional embroidery.' },
    { name: 'Mens Kaftan', price: 3500, desc: 'Classic mens kaftan in linen blend.' },
    { name: 'Kanga Wrap (2 Piece)', price: 1500, desc: 'Traditional kanga set with sayings, vibrant colors.' },
    { name: 'Kanga Cotton Throw', price: 1200, desc: 'Lightweight cotton kanga, multipurpose.' },
    { name: 'Mens 2-Piece Suit', price: 12500, desc: 'Slim-fit mens suit in navy or charcoal.' },
    { name: 'Mens 3-Piece Tuxedo', price: 18500, desc: 'Premium tuxedo with vest, perfect for events.' },
    { name: 'Slim Fit Denim Jeans', price: 2800, desc: 'Stretchy slim-fit blue jeans, sizes 28-40.' },
    { name: 'Skinny Black Jeans', price: 2500, desc: 'Mid-rise skinny jeans in classic black.' },
    { name: 'Distressed Jeans', price: 3200, desc: 'Trendy distressed jeans with knee rips.' },
    { name: 'Puffer Winter Jacket', price: 5800, desc: 'Warm puffer jacket for highland weather.' },
    { name: 'Lightweight Bomber Jacket', price: 3500, desc: 'Stylish bomber jacket, water-resistant.' },
  ],
  Handicrafts: [
    { name: 'Carved Wooden Elephant', price: 2500, desc: 'Hand-carved mahogany elephant, premium finish.' },
    { name: 'Wooden Giraffe Sculpture', price: 3200, desc: 'Tall hand-carved giraffe, 60cm height.' },
    { name: 'Carved Maasai Warrior', price: 2800, desc: 'Detailed hand-carved Maasai warrior figurine.' },
    { name: 'Wooden African Map', price: 1800, desc: 'Carved Africa-shape wall hanging, walnut finish.' },
    { name: 'Woven Sisal Basket (L)', price: 1500, desc: 'Large hand-woven sisal basket, multi-purpose.' },
    { name: 'Kiondo Shopping Basket', price: 1200, desc: 'Traditional Kenyan kiondo with leather straps.' },
    { name: 'Storage Basket Set (3)', price: 2200, desc: 'Set of 3 nesting woven baskets.' },
    { name: 'Plant Pot Basket Cover', price: 800, desc: 'Decorative basket cover for indoor plants.' },
    { name: 'Clay Water Pot', price: 1800, desc: 'Traditional handmade clay water pot, naturally cooling.' },
    { name: 'Pottery Coffee Mug Set', price: 2200, desc: 'Set of 4 hand-thrown ceramic mugs.' },
    { name: 'Decorative Clay Vase', price: 2800, desc: 'Hand-painted ceramic vase, perfect centrepiece.' },
    { name: 'Wooden Tribal Mask', price: 4500, desc: 'Authentic hand-carved wooden tribal mask.' },
    { name: 'Beaded Wall Hanging', price: 3200, desc: 'Maasai-beaded decorative wall hanging.' },
    { name: 'Beaded Belt', price: 1800, desc: 'Vibrant Maasai-beaded belt, adjustable.' },
    { name: 'Beaded Earrings (3 pairs)', price: 1200, desc: 'Set of 3 beaded earring pairs, handmade.' },
  ],
  Sports: [
    { name: 'Kenyan Athletes Running Shoes', price: 6500, desc: 'Lightweight performance running shoes.' },
    { name: 'Trail Running Shoes', price: 7800, desc: 'Rugged trail shoes for off-road runs.' },
    { name: 'Marathon Running Shoes', price: 9500, desc: 'Long-distance race shoes with carbon plate.' },
    { name: 'Football Soccer Ball Size 5', price: 1800, desc: 'Official size 5 match-quality football.' },
    { name: 'Training Football', price: 1200, desc: 'Durable training football for daily practice.' },
    { name: 'Premium Yoga Mat 6mm', price: 2500, desc: 'Eco-friendly TPE yoga mat with carry strap.' },
    { name: 'Anti-Slip Yoga Mat', price: 2200, desc: 'Extra-grip yoga mat, washable.' },
    { name: 'Adjustable Dumbbell Set', price: 8500, desc: 'Pair of adjustable dumbbells, 5-25kg.' },
    { name: 'Hex Dumbbell 10kg', price: 3500, desc: 'Single 10kg cast-iron hex dumbbell.' },
    { name: 'Mountain Bicycle 26"', price: 28500, desc: '26-inch mountain bike, 21-speed Shimano gears.' },
    { name: 'City Commuter Bicycle', price: 22000, desc: 'Comfortable city bike with rack and lights.' },
  ],
  Beauty: [
    { name: 'Oud Royal Perfume 100ml', price: 4500, desc: 'Luxurious oud-based eau de parfum, 100ml.' },
    { name: 'African Floral Eau de Toilette', price: 2800, desc: 'Fresh floral perfume inspired by African gardens.' },
    { name: 'Rose & Sandalwood Parfum', price: 3800, desc: 'Romantic rose and sandalwood perfume, 50ml.' },
    { name: 'Vanilla Musk Body Spray', price: 1500, desc: 'Long-lasting vanilla musk body spray, 200ml.' },
    { name: 'Anti-Aging Face Cream', price: 2800, desc: 'Hydrating anti-aging cream with retinol.' },
    { name: 'Hyaluronic Acid Moisturiser', price: 2200, desc: 'Lightweight hydrating cream for daily use.' },
    { name: 'Vitamin C Brightening Cream', price: 2500, desc: 'Brightening face cream with 10% Vitamin C.' },
    { name: 'Matte Liquid Lipstick Set', price: 1800, desc: 'Set of 5 long-lasting matte liquid lipsticks.' },
    { name: 'Velvet Lipstick (Red)', price: 800, desc: 'Classic red velvet matte lipstick.' },
    { name: 'Nude Lip Gloss Trio', price: 1200, desc: 'Set of 3 nude shimmer lip glosses.' },
    { name: 'Pure Shea Butter 250g', price: 1200, desc: '100% raw unrefined shea butter, multi-use.' },
    { name: 'Whipped Shea Body Butter', price: 1800, desc: 'Whipped shea butter with essential oils, 200g.' },
    { name: 'Argan Hair Oil 100ml', price: 1500, desc: 'Pure Moroccan argan oil for hair and skin.' },
    { name: 'Tea Tree Essential Oil', price: 800, desc: '100% pure tea tree essential oil, 30ml.' },
    { name: 'Lavender Essential Oil', price: 900, desc: 'Therapeutic lavender essential oil, 30ml.' },
  ],
  Children: [
    { name: 'Educational Building Blocks', price: 1800, desc: '120-piece colourful building blocks set.' },
    { name: 'Wooden Puzzle Set', price: 1200, desc: 'Set of 4 wooden educational puzzles, ages 3+.' },
    { name: 'Plush Teddy Bear (Large)', price: 1500, desc: 'Soft cuddly teddy bear, 60cm tall.' },
    { name: 'Toy Car Race Set', price: 2200, desc: 'Race track toy car set with 6 cars.' },
    { name: 'Newborn Layette Set (5pc)', price: 2500, desc: '5-piece newborn essentials set, 0-3 months.' },
    { name: 'Toddler Cotton Pyjamas', price: 1200, desc: '2-piece cotton pyjama set, ages 1-5.' },
    { name: 'Baby Onesie 3-Pack', price: 1500, desc: 'Pack of 3 organic cotton onesies, sizes NB-12m.' },
    { name: 'School Backpack (Primary)', price: 1800, desc: 'Durable kids school backpack with multiple compartments.' },
    { name: 'Kids Lunch Bag', price: 800, desc: 'Insulated lunch bag with bottle holder.' },
    { name: 'High School Laptop Backpack', price: 2500, desc: 'Large backpack with padded laptop compartment.' },
  ],
  Kitchen: [
    { name: 'Non-Stick Frying Pan 28cm', price: 2200, desc: 'Premium non-stick pan with heat-resistant handle.' },
    { name: 'Stainless Steel Cooking Pot', price: 3200, desc: '5L stainless steel pot with glass lid.' },
    { name: 'Cast Iron Casserole', price: 4500, desc: 'Heavy cast iron casserole, ideal for slow cooking.' },
    { name: 'Aluminium Sufuria Set (5)', price: 2800, desc: 'Set of 5 nesting aluminium sufurias.' },
    { name: 'High-Speed Blender 1.5L', price: 4200, desc: '1000W high-speed blender with smoothie cup.' },
    { name: 'Hand Mixer & Whisk', price: 1800, desc: 'Electric hand mixer with 5 speed settings.' },
    { name: 'Personal Smoothie Blender', price: 2500, desc: 'Compact 600ml smoothie blender, BPA-free.' },
    { name: 'Ceramic Dinner Set (16pc)', price: 4800, desc: '16-piece ceramic dinner set for 4 people.' },
    { name: 'Porcelain Tea Set (12pc)', price: 3500, desc: 'Elegant 12-piece porcelain tea set.' },
    { name: 'Melamine Plate Set', price: 1500, desc: 'Set of 6 unbreakable melamine plates.' },
  ],
  Food: [
    { name: 'Pilau Spice Mix 200g', price: 350, desc: 'Authentic East African pilau spice blend.' },
    { name: 'Berbere Spice Mix 250g', price: 450, desc: 'Traditional Ethiopian berbere spice blend.' },
    { name: 'Curry Powder 500g', price: 300, desc: 'Aromatic curry powder, perfect for stews.' },
    { name: 'Garam Masala 200g', price: 380, desc: 'Premium garam masala blend, freshly ground.' },
    { name: 'Kenyan AA Coffee Beans 500g', price: 1200, desc: 'Single-origin Kenyan AA whole bean coffee.' },
    { name: 'Ethiopian Yirgacheffe Beans', price: 1500, desc: 'Premium Ethiopian Yirgacheffe coffee, 500g.' },
    { name: 'Ground Arabica Coffee 250g', price: 650, desc: 'Medium-roast ground arabica coffee.' },
    { name: 'Pure Wild Honey 500g', price: 850, desc: 'Raw wild honey from East African forests.' },
    { name: 'Acacia Honey Jar 1kg', price: 1500, desc: 'Premium acacia honey, light and floral.' },
    { name: 'Kericho Black Tea 500g', price: 450, desc: 'Premium Kericho black tea leaves.' },
    { name: 'Green Tea Leaves 250g', price: 550, desc: 'Loose-leaf green tea, antioxidant-rich.' },
    { name: 'Hibiscus Tea 200g', price: 480, desc: 'Dried hibiscus flowers for refreshing tea.' },
  ],
  Furniture: [
    { name: 'Wooden Dining Chair', price: 4500, desc: 'Solid mahogany dining chair, hand-finished.' },
    { name: 'Mid-Century Lounge Chair', price: 12500, desc: 'Modern mid-century style lounge chair.' },
    { name: 'Bar Stool (Set of 2)', price: 8500, desc: 'Pair of adjustable bar stools, leather seat.' },
    { name: 'Modern Floor Lamp', price: 5800, desc: 'Sleek floor lamp with adjustable head.' },
    { name: 'Bedside Table Lamp', price: 2800, desc: 'Elegant bedside lamp with fabric shade.' },
    { name: 'Pendant Ceiling Lamp', price: 4500, desc: 'Modern pendant lamp, brass finish.' },
  ],
  Art: [
    { name: 'African Sunset Canvas', price: 4500, desc: 'Hand-painted African sunset on canvas, 60x40cm.' },
    { name: 'Maasai Portrait Painting', price: 5500, desc: 'Original oil painting of Maasai elder, framed.' },
    { name: 'Acacia Tree Landscape', price: 3800, desc: 'Watercolour landscape with acacia trees.' },
    { name: 'Abstract African Art', price: 4200, desc: 'Bold abstract painting in African colour palette.' },
  ],
};

// ── Distribution: 200 new products across countries ─────────────────────
// Allocation: KE 50, UG 45, RW 35, ET 40, SS 30 = 200
// Distributed across categories proportional to catalog size
const COUNTRY_QUOTA = { KE: 50, UG: 45, RW: 35, ET: 40, SS: 30 };

// Counter to tag titles uniquely if duplicate within same country
function buildNewProducts() {
  const all = [];
  // Flatten catalog into [{cat, ...item}]
  const flat = [];
  for (const [cat, items] of Object.entries(CATALOG)) {
    items.forEach(it => flat.push({ ...it, cat }));
  }
  // Round-robin distribute across countries
  const countryCodes = Object.keys(COUNTRY_QUOTA);
  const remaining = { ...COUNTRY_QUOTA };
  let idx = 0;
  const countryProducts = { KE:[], UG:[], RW:[], ET:[], SS:[] };
  // We'll cycle through flat catalog and place each item in a country that needs more
  // until we hit 200 total
  let placed = 0;
  let cycle = 0;
  while (placed < 200 && cycle < 5) {
    for (const item of flat) {
      if (placed >= 200) break;
      // pick the country with most remaining quota
      const code = countryCodes
        .filter(c => remaining[c] > 0)
        .sort((a,b) => remaining[b] - remaining[a])[0];
      if (!code) break;
      const ci = COUNTRY_INFO[code];
      const localPrice = Math.round(item.price * ci.mult / 10) * 10 || Math.round(item.price * ci.mult);
      const cityIdx = countryProducts[code].length % ci.cities.length;
      const city = ci.cities[cityIdx];
      // suffix to ensure title uniqueness if cycling
      const suffix = cycle > 0 ? ` (${city})` : ` - ${city}`;
      countryProducts[code].push({
        title: item.name + suffix,
        category: item.cat,
        country_code: code,
        county: city,
        price: localPrice,
        description: `${item.desc} Available in ${city}, ${ci.name}.`,
      });
      remaining[code]--;
      placed++;
    }
    cycle++;
  }
  return [].concat(...Object.values(countryProducts));
}

async function main() {
  const t0 = Date.now();
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: 'superadmin@store.com', password: 'super2026'
  });
  if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
  const { data: { user } } = await sb.auth.getUser();
  console.log('Authenticated as superadmin\n');

  // ── Step 1: Map countries ────────────────────────────────────────────
  const { data: countries } = await sb.from('countries').select('id, code');
  const codeToId = {}; const idToCode = {};
  countries.forEach(c => { codeToId[c.code] = c.id; idToCode[c.id] = c.code; });

  // ── Step 2: Reassign unique images to existing 162 products ───────────
  console.log('=== STEP 1: Reassigning unique images to existing products ===');
  const { data: existing } = await sb.from('products')
    .select('id, title, category, country_id, storage_path')
    .eq('product_status','published');
  console.log(`Existing products: ${existing.length}`);

  let dedupOk = 0, dedupFail = 0, dedupSkip = 0;
  for (const p of existing) {
    if (p.storage_path && (p.storage_path.startsWith('seed/p-') || p.storage_path.startsWith('seed/n-'))) {
      dedupSkip++; continue;
    }
    const key = `seed/p-${p.id}.jpg`;
    const okUrl = await tryUploadFromCategory(p.category, key, 6);
    if (!okUrl) { log(`  ✗ no working url for ${p.id} (${p.category})`); dedupFail++; continue; }
    try {
      const { error: e1 } = await sb.from('products').update({ storage_path: key }).eq('id', p.id);
      if (e1) throw e1;
      const { error: e2 } = await sb.from('product_images')
        .update({ storage_path: key })
        .eq('product_id', p.id).eq('is_main', true);
      if (e2) throw e2;
      dedupOk++;
      if (dedupOk % 10 === 0) log(`  dedup progress: ${dedupOk} ok, ${dedupFail} fail, ${dedupSkip} skip`);
    } catch (e) {
      log(`  ✗ DB ${p.id}: ${e.message}`);
      dedupFail++;
    }
  }
  log(`Dedup done: ${dedupOk} ok, ${dedupFail} fail, ${dedupSkip} skip\n`);

  // ── Step 3: Insert 200 new products ───────────────────────────────────
  console.log('=== STEP 2: Inserting 200 new diverse products ===');
  const newProducts = buildNewProducts();
  console.log(`Planned: ${newProducts.length} new products`);

  // Skip titles already inserted (re-runnable)
  const { data: existingTitles } = await sb.from('products').select('title');
  const haveTitles = new Set((existingTitles || []).map(t => t.title));

  const BATCH = parseInt(process.env.BATCH || '0', 10);
  let newOk = 0, newFail = 0, newSkip = 0;
  for (let i = 0; i < newProducts.length; i++) {
    const np = newProducts[i];
    if (haveTitles.has(np.title)) { newSkip++; continue; }
    if (BATCH > 0 && newOk >= BATCH) { log(`  batch limit ${BATCH} reached, stopping`); break; }
    try {
      const countryId = codeToId[np.country_code];
      const { data: prod, error: e1 } = await sb.from('products').insert({
        user_id: user.id,
        title: np.title,
        description: np.description,
        price: np.price,
        category: np.category,
        country_id: countryId,
        county: np.county,
        product_status: 'published',
        available_quantity: Math.floor(Math.random() * 15) + 3,
      }).select('id').single();
      if (e1) throw e1;
      const key = `seed/n-${prod.id}.jpg`;
      const okUrl = await tryUploadFromCategory(np.category, key, 6);
      if (!okUrl) {
        // delete the orphan product
        await sb.from('products').delete().eq('id', prod.id);
        log(`  ✗ no working image for ${np.title}, rolled back`);
        newFail++; continue;
      }
      await sb.from('products').update({ storage_path: key }).eq('id', prod.id);
      await sb.from('product_images').insert({
        product_id: prod.id,
        storage_path: key,
        is_main: true,
        display_order: 0,
      });
      haveTitles.add(np.title);
      newOk++;
      if (newOk % 10 === 0) log(`  new progress: ${newOk} added, ${newFail} fail, ${newSkip} skip`);
    } catch (e) {
      log(`  ✗ ${np.title}: ${e.message}`);
      newFail++;
    }
  }
  log(`New done: ${newOk} ok, ${newFail} fail, ${newSkip} skip\n`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`Done in ${elapsed}s. Total: ${dedupOk} dedup'd, ${newOk} added.`);
}

main().catch(e => { console.error(e); process.exit(1); });
