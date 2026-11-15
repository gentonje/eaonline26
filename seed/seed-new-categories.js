#!/usr/bin/env node
/**
 * Seeds Electronics, Sports, Clothing, Children, Beauty products
 * with real East African product images.
 */
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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
            timeout: 15000,
        }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
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

async function upload(key, url) {
    try {
        const buf = await fetchBuffer(url);
        if (buf.length < 5000) throw new Error(`Too small: ${buf.length} bytes`);
        const { error } = await sb.storage.from('images').upload(`seed/${key}.jpg`, buf, {
            contentType: 'image/jpeg', upsert: true,
        });
        if (error) throw error;
        console.log(`  ✓ ${key} (${(buf.length/1024).toFixed(0)}KB)`);
        return `seed/${key}.jpg`;
    } catch (e) {
        console.log(`  ✗ ${key}: ${e.message}`);
        return null;
    }
}

// ── Image sources ─────────────────────────────────────────────────────────
const IMAGE_SOURCES = [
    // Electronics
    { key: 'tecno_phone',     url: 'https://public.carlcare.com/public/e9342631e27449f963293f20aebdbbee.jpg' },
    { key: 'tecno_phone2',    url: 'https://public.carlcare.com/public/4c95d73e848fdf864fe5fdb8e6307043.jpg' },
    { key: 'tecno_phone3',    url: 'https://public.carlcare.com/public/86eaec7ad481b8941e6e205c2a666229.jpg' },
    // Sports
    { key: 'sports_shoes',    url: 'https://m.media-amazon.com/images/I/817qv+hpBeL.jpg' },   // repurposed — real running shoes
    { key: 'sports_shoes2',   url: 'https://m.media-amazon.com/images/I/51QAuBYszvL.jpg' },
    // Clothing — shirts
    { key: 'shirt_men',       url: 'https://i.etsystatic.com/25677209/r/il/18df9c/3728660378/il_600x600.3728660378_9ssz.jpg' },
    { key: 'shirt_men2',      url: 'https://i.etsystatic.com/7398748/c/1200/1200/0/0/il/95962b/1911841218/il_600x600.1911841218_2kp.jpg' },
    // Clothing — dresses
    { key: 'dress_kitenge',   url: 'https://i.pinimg.com/originals/50/d4/56/50d456b5d5ee14cd87bf712f6718c9b8.jpg' },
    { key: 'dress_ankara',    url: 'https://i.pinimg.com/originals/fa/6a/50/fa6a5067d994198f8d5cf7457ff24ff1.jpg' },
    { key: 'dress_women',     url: 'https://m.media-amazon.com/images/I/51QAuBYszvL.jpg' },
    // Clothing — skirts
    { key: 'skirt_wrap',      url: 'https://i.ebayimg.com/thumbs/images/g/fKEAAOSwj-dlxbuv/s-l400.webp' },
    { key: 'skirt_maxi',      url: 'https://m.media-amazon.com/images/I/817qv+hpBeL.jpg' },
    // Children
    { key: 'kids_kitenge',    url: 'https://i.pinimg.com/originals/38/4f/92/384f921b581c8648290aa9c8ac18a76a.jpg' },
    { key: 'kids_dashiki',    url: 'https://m.media-amazon.com/images/I/61ZlFoqiStL.jpg' },
    { key: 'kids_dress',      url: 'https://m.media-amazon.com/images/I/61mWxrnhUWL.jpg' },
    // Beauty — perfumes
    { key: 'perfume_musk',    url: 'https://m.media-amazon.com/images/I/316IEx2UzCL.jpg' },
    { key: 'perfume_africa',  url: 'https://flyingsolo.nyc/wp-content/uploads/Scent-of-Africa-RAKH-50ML-BOTTLE-BOX-1-scaled-1.jpg' },
    { key: 'perfume_bezi',    url: 'https://flyingsolo.nyc/wp-content/uploads/Scent-of-Africa-BEZI-50ML-BOTTLE-BOX-scaled-1.jpg' },
];

// ── Product data ──────────────────────────────────────────────────────────
const PRODUCTS = {
    KE: [
        // Electronics
        { title: 'Tecno Spark 20 Pro (Kenya)', cat: 'Electronics', price: 22000, img: 'tecno_phone', desc: 'Tecno Spark 20 Pro with 6.78" AMOLED display, 256GB storage, 108MP camera. Official Kenya warranty. Available in Nairobi CBD.' },
        { title: 'Infinix Hot 40 Pro', cat: 'Electronics', price: 19500, img: 'tecno_phone2', desc: 'Infinix Hot 40 Pro with 6.78" display, 8GB RAM, 256GB storage. Fast charging, dual SIM. Kenya stock.' },
        { title: 'Tecno Camon 20 Premier', cat: 'Electronics', price: 35000, img: 'tecno_phone3', desc: 'Tecno Camon 20 Premier flagship phone. 50MP front camera, 5000mAh battery. Nairobi dealer.' },
        // Sports
        { title: 'Running Shoes (Kenyan Brand)', cat: 'Sports', price: 4500, img: 'sports_shoes', desc: 'Lightweight performance running shoes inspired by Kenyan elite athletes. Available in UK 6–12.' },
        { title: 'Training Sneakers', cat: 'Sports', price: 3800, img: 'sports_shoes2', desc: 'Multi-sport training sneakers with cushioned sole. Popular in Nairobi gyms and schools.' },
        // Clothing
        { title: 'Men\'s Kitenge Print Shirt', cat: 'Clothing', price: 2200, img: 'shirt_men', desc: 'Short-sleeve men\'s shirt in vibrant African Ankara print. Tailored in Nairobi, sizes S–3XL.' },
        { title: 'Embroidered African Shirt (Men)', cat: 'Clothing', price: 2800, img: 'shirt_men2', desc: 'Premium embroidered kitenge shirt for men. Ideal for formal and semi-formal occasions.' },
        { title: 'Kitenge Midi Dress (Women)', cat: 'Clothing', price: 3500, img: 'dress_kitenge', desc: 'Elegant Ankara midi dress for women. Made by Nairobi tailors, custom sizing available.' },
        { title: 'Ankara Print Work Dress', cat: 'Clothing', price: 3200, img: 'dress_ankara', desc: 'Bold African print work dress with structured silhouette. Available in sizes 8–20.' },
        { title: 'African Print Maxi Skirt', cat: 'Clothing', price: 1800, img: 'skirt_wrap', desc: 'Wrap-around maxi skirt in African print fabric. Elastic waistband, one-size-fits-most.' },
        // Children
        { title: 'Kids Kitenge Outfit Set', cat: 'Children', price: 1500, img: 'kids_kitenge', desc: 'Matching top and trouser set for children in bright kitenge print. Ages 2–12 available.' },
        { title: 'Children\'s Dashiki Set', cat: 'Children', price: 1200, img: 'kids_dashiki', desc: 'Colourful dashiki outfit for kids. Comfortable cotton blend, ages 1–8.' },
        { title: 'Baby Girl African Print Dress', cat: 'Children', price: 900, img: 'kids_dress', desc: 'Cute ankara print dress for toddler girls. Machine washable, ages 6 months–3 years.' },
        // Beauty
        { title: 'African Musk Perfume Oil', cat: 'Beauty', price: 1800, img: 'perfume_musk', desc: 'Alcohol-free African musk roll-on perfume oil. Long-lasting, earthy scent. Made in Kenya.' },
        { title: 'Scent of Africa Perfume (50ml)', cat: 'Beauty', price: 3500, img: 'perfume_africa', desc: 'Luxury East African-inspired eau de parfum. Notes of sandalwood, oud and vanilla.' },
    ],
    UG: [
        { title: 'Tecno Pop 7 Pro (Uganda)', cat: 'Electronics', price: 320000, img: 'tecno_phone', desc: 'Tecno Pop 7 Pro with 6.6" display, 4GB RAM, 64GB storage. Uganda MTN network compatible.' },
        { title: 'Infinix Smart 8 Pro', cat: 'Electronics', price: 380000, img: 'tecno_phone2', desc: 'Infinix Smart 8 Pro, 6.6" HD+ display, 5000mAh battery. Available at Kampala tech shops.' },
        { title: 'Tecno Spark 10 (Kampala)', cat: 'Electronics', price: 450000, img: 'tecno_phone3', desc: 'Tecno Spark 10 with 16MP AI camera, 128GB ROM, 8GB RAM. Kampala stock, warranty included.' },
        { title: 'Sports Running Shoes (Kampala)', cat: 'Sports', price: 85000, img: 'sports_shoes', desc: 'Cushioned running shoes ideal for Kampala\'s terrain. Available at Owino market and online.' },
        { title: 'Gym Training Shoes', cat: 'Sports', price: 72000, img: 'sports_shoes2', desc: 'Multi-purpose gym shoes with arch support. Popular at Kampala gyms, sizes 37–46.' },
        { title: 'Men\'s Ankara Short Sleeve Shirt', cat: 'Clothing', price: 45000, img: 'shirt_men', desc: 'Smart casual kitenge print shirt for men. Tailored in Kampala, available in all sizes.' },
        { title: 'Ugandan Embroidered Kaftan Shirt', cat: 'Clothing', price: 65000, img: 'shirt_men2', desc: 'Premium embroidered men\'s shirt in bold African print. Semi-formal, made in Kampala.' },
        { title: 'Kitenge Wrap Dress (Uganda)', cat: 'Clothing', price: 78000, img: 'dress_kitenge', desc: 'Vibrant wrap dress in Ugandan kitenge fabric. Flattering A-line cut, sizes 8–22.' },
        { title: 'African Print Maxi Skirt (UG)', cat: 'Clothing', price: 42000, img: 'skirt_wrap', desc: 'Long wrap skirt in bold East African print. Popular in Kampala and Entebbe markets.' },
        { title: 'Kids Kitenge Party Outfit', cat: 'Children', price: 38000, img: 'kids_kitenge', desc: 'Adorable kitenge party set for children. Perfect for introductions and family gatherings.' },
        { title: 'Children\'s Dashiki Outfit (UG)', cat: 'Children', price: 28000, img: 'kids_dashiki', desc: 'Comfortable dashiki shirt and trouser set for boys. Ages 2–10, made in Kampala.' },
        { title: 'Baby Ankara Romper', cat: 'Children', price: 22000, img: 'kids_dress', desc: 'Cute African print baby romper for infants. Soft cotton, easy snap buttons. Ages 0–18 months.' },
        { title: 'African Musk Perfume (Uganda)', cat: 'Beauty', price: 45000, img: 'perfume_musk', desc: 'Handcrafted African musk oil blend. Popular in Kampala markets. Long-lasting fragrance.' },
        { title: 'Scent of Africa Parfum (UG)', cat: 'Beauty', price: 85000, img: 'perfume_africa', desc: 'Premium African-inspired eau de parfum. Notes of oud, amber and African florals.' },
        { title: 'Bezi African Fragrance 50ml', cat: 'Beauty', price: 78000, img: 'perfume_bezi', desc: 'Unique East African fragrance inspired by the savannah. Fresh and earthy scent profile.' },
    ],
    RW: [
        { title: 'Tecno Camon 30 (Rwanda)', cat: 'Electronics', price: 120000, img: 'tecno_phone', desc: 'Tecno Camon 30 with 50MP triple camera, 8GB RAM, AMOLED display. Kigali warranty.' },
        { title: 'Infinix Note 40 (Kigali)', cat: 'Electronics', price: 145000, img: 'tecno_phone2', desc: 'Infinix Note 40, 108MP camera, 5000mAh with 45W fast charging. Rwanda stock.' },
        { title: 'Men\'s African Print Shirt (RW)', cat: 'Clothing', price: 18000, img: 'shirt_men', desc: 'Kigali-tailored men\'s kitenge shirt. Smart casual, available in sizes S–3XL.' },
        { title: 'Kitenge Dress (Kigali)', cat: 'Clothing', price: 25000, img: 'dress_kitenge', desc: 'Beautiful Rwandan kitenge midi dress. Tailored in Kigali, custom sizes available.' },
        { title: 'African Maxi Skirt (Rwanda)', cat: 'Clothing', price: 14000, img: 'skirt_wrap', desc: 'Wrap-around maxi skirt in vibrant African print. Popular in Kigali fashion markets.' },
        { title: 'Running Shoes (Kigali)', cat: 'Sports', price: 22000, img: 'sports_shoes', desc: 'Lightweight running shoes for Rwanda\'s hilly terrain. Available at Kigali sports shops.' },
        { title: 'Training Sneakers (Rwanda)', cat: 'Sports', price: 18000, img: 'sports_shoes2', desc: 'Multi-sport gym shoes with cushioned insole. Popular at Kigali fitness centres.' },
        { title: 'Kids Kitenge Set (Rwanda)', cat: 'Children', price: 12000, img: 'kids_kitenge', desc: 'Matching kitenge outfit for Rwandan children. Perfect for family celebrations.' },
        { title: 'Baby Ankara Dress (Kigali)', cat: 'Children', price: 8000, img: 'kids_dress', desc: 'Sweet African print baby dress. 100% cotton, ages 6 months–3 years.' },
        { title: 'African Musk Oil (Rwanda)', cat: 'Beauty', price: 15000, img: 'perfume_musk', desc: 'Natural African musk roll-on perfume. Long-lasting, popular in Kigali beauty shops.' },
        { title: 'Scent of Africa Parfum (RW)', cat: 'Beauty', price: 35000, img: 'perfume_bezi', desc: 'Luxury African-inspired fragrance. Notes of rose, oud and warm vanilla.' },
    ],
    ET: [
        { title: 'Tecno Spark 20 (Ethiopia)', cat: 'Electronics', price: 8500, img: 'tecno_phone', desc: 'Tecno Spark 20 with 6.56" display, 128GB storage. Addis Ababa stock with warranty.' },
        { title: 'Infinix Hot 40 (Addis)', cat: 'Electronics', price: 9200, img: 'tecno_phone2', desc: 'Infinix Hot 40 with massive 5000mAh battery, 8GB RAM. Available at Addis tech shops.' },
        { title: 'Men\'s Ethiopian Print Shirt', cat: 'Clothing', price: 1800, img: 'shirt_men', desc: 'Men\'s shirt with traditional Ethiopian tibeb border. Smart casual, made in Addis Ababa.' },
        { title: 'Ethiopian Dress (Habesha Style)', cat: 'Clothing', price: 2500, img: 'dress_kitenge', desc: 'Modern habesha-style dress with colourful tibeb border. Women\'s sizes 8–20.' },
        { title: 'Ankara Maxi Skirt (Ethiopia)', cat: 'Clothing', price: 1200, img: 'skirt_wrap', desc: 'Bold African print maxi skirt. Popular in Addis Ababa\'s fashion markets.' },
        { title: 'Running Shoes (Addis)', cat: 'Sports', price: 2200, img: 'sports_shoes', desc: 'Ethiopian-market running shoes inspired by the country\'s world-champion athletes.' },
        { title: 'Kids Ankara Outfit (ET)', cat: 'Children', price: 950, img: 'kids_kitenge', desc: 'Children\'s African print outfit set. Ages 2–10, comfortable cotton blend.' },
        { title: 'Baby African Print Dress (ET)', cat: 'Children', price: 750, img: 'kids_dress', desc: 'Cute African print baby dress for girls. Machine-washable, sizes 0–3 years.' },
        { title: 'Ethiopian Oud Perfume (50ml)', cat: 'Beauty', price: 1800, img: 'perfume_africa', desc: 'Traditional Ethiopian oud-based perfume. Rich, woody fragrance popular across East Africa.' },
        { title: 'African Musk Oil (Ethiopia)', cat: 'Beauty', price: 950, img: 'perfume_musk', desc: 'Natural African musk roll-on oil. Alcohol-free, long-lasting. Made in Addis Ababa.' },
    ],
    SS: [
        { title: 'Tecno Pop 8 (South Sudan)', cat: 'Electronics', price: 280000, img: 'tecno_phone', desc: 'Tecno Pop 8 entry-level smartphone. 6.6" display, dual SIM, 5000mAh battery. Juba stock.' },
        { title: 'Infinix Smart 7 (Juba)', cat: 'Electronics', price: 320000, img: 'tecno_phone2', desc: 'Infinix Smart 7 with 6.6" display, 64GB storage. Available at Juba electronics shops.' },
        { title: 'Men\'s African Print Shirt (SS)', cat: 'Clothing', price: 18000, img: 'shirt_men', desc: 'Kitenge print shirt for men, tailored in Juba. Smart-casual, all sizes available.' },
        { title: 'Women\'s African Dress (Juba)', cat: 'Clothing', price: 25000, img: 'dress_kitenge', desc: 'Colourful African print dress. Made by Juba tailors, custom measurements accepted.' },
        { title: 'African Maxi Skirt (SS)', cat: 'Clothing', price: 14000, img: 'skirt_wrap', desc: 'Bold print wrap maxi skirt, popular at Juba market stalls.' },
        { title: 'Sports Shoes (Juba)', cat: 'Sports', price: 55000, img: 'sports_shoes', desc: 'Cushioned sports shoes for running and training. Available at Juba sports suppliers.' },
        { title: 'Kids African Outfit (SS)', cat: 'Children', price: 12000, img: 'kids_kitenge', desc: 'Children\'s African print outfit, vibrant and durable. Ages 2–12.' },
        { title: 'Baby Romper African Print (SS)', cat: 'Children', price: 8000, img: 'kids_dress', desc: 'Soft African print baby romper. Easy-wear snap design, ages 0–18 months.' },
        { title: 'African Musk Perfume (SS)', cat: 'Beauty', price: 25000, img: 'perfume_musk', desc: 'African musk roll-on perfume oil. Popular fragrance across Juba markets.' },
        { title: 'Scent of Africa Parfum (SS)', cat: 'Beauty', price: 65000, img: 'perfume_africa', desc: 'Premium African-inspired perfume. Warm woody fragrance with oud and amber notes.' },
    ],
};

const CITIES = {
    KE: ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret'],
    UG: ['Kampala','Entebbe','Jinja','Gulu','Mbarara'],
    RW: ['Kigali','Butare','Gisenyi','Musanze','Huye'],
    ET: ['Addis Ababa','Dire Dawa','Mekelle','Gondar','Hawassa'],
    SS: ['Juba','Wau','Malakal','Yambio','Torit'],
};

async function main() {
    const { error: authErr } = await sb.auth.signInWithPassword({
        email: 'superadmin@store.com', password: 'super2026'
    });
    if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
    console.log('Authenticated\n');

    // 1. Upload images
    console.log('Uploading images...');
    const uploadedPaths = {};
    for (const img of IMAGE_SOURCES) {
        const p = await upload(img.key, img.url);
        if (p) uploadedPaths[img.key] = p;
    }
    console.log(`\nUploaded ${Object.keys(uploadedPaths).length}/${IMAGE_SOURCES.length} images\n`);

    // 2. Fetch country IDs
    const { data: countries } = await sb.from('countries').select('id, code');
    const countryMap = {};
    for (const c of countries) countryMap[c.code] = c.id;

    // 3. Get superadmin user
    const { data: { user } } = await sb.auth.getUser();

    // 4. Insert new products
    console.log('Inserting new products...');
    let total = 0;
    for (const [code, items] of Object.entries(PRODUCTS)) {
        const countryId = countryMap[code];
        if (!countryId) { console.log(`  SKIP ${code}`); continue; }
        const cities = CITIES[code];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const storagePath = uploadedPaths[item.img] || `seed/${item.img}.jpg`;
            const city = cities[i % cities.length];
            const { data: prod, error } = await sb.from('products').insert({
                user_id: user.id,
                title: item.title,
                description: item.desc,
                price: item.price,
                category: item.cat,
                country_id: countryId,
                county: city,
                storage_path: storagePath,
                product_status: 'published',
                available_quantity: Math.floor(Math.random() * 15) + 3,
            }).select('id').single();
            if (error) { console.log(`  ERR ${item.title}: ${error.message}`); continue; }
            await sb.from('product_images').insert({
                product_id: prod.id,
                storage_path: storagePath,
                is_main: true,
                display_order: 0,
            });
            total++;
        }
        console.log(`  ✓ ${code}: ${items.length} products`);
    }
    console.log(`\nDone! Inserted ${total} new products.`);
}

main().catch(e => { console.error(e); process.exit(1); });
