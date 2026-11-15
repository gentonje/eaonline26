#!/usr/bin/env node
/**
 * Downloads East African product images and re-seeds 100 products
 * with culturally accurate names, categories, prices, and images.
 */
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ── helpers ──────────────────────────────────────────────────────────────
function fetchBuffer(rawUrl, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(rawUrl);
        const lib = parsed.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; EastAfricaOnline/1.0)',
                'Accept': 'image/*,*/*',
            },
        };
        lib.get(options, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
                return fetchBuffer(res.headers.location, maxRedirects - 1).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${rawUrl}`));
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function upload(key, url) {
    try {
        const buf = await fetchBuffer(url);
        const storagePath = `seed/${key}.jpg`;
        const { error } = await sb.storage.from('images').upload(storagePath, buf, {
            contentType: 'image/jpeg', upsert: true,
        });
        if (error) throw error;
        console.log(`  ✓ ${key}`);
        return storagePath;
    } catch (e) {
        console.log(`  ✗ ${key}: ${e.message}`);
        return null;
    }
}

// ── image catalogue ───────────────────────────────────────────────────────
const IMAGE_SOURCES = [
    { key: 'bead_maasai_necklace',  url: 'https://i.etsystatic.com/21150098/r/il/df9b6f/2711417624/il_600x600.2711417624_ltno.jpg' },
    { key: 'bead_collar_necklace',  url: 'https://i.etsystatic.com/61608587/r/il/0cfb06/7172719122/il_340x270.7172719122_sgd2.jpg' },
    { key: 'bead_collar_wide',      url: 'https://m.media-amazon.com/images/I/81DyKr+ecDL.jpg' },
    { key: 'bead_anklet',           url: 'https://i.etsystatic.com/23570896/r/il/3b801a/3642379618/il_600x600.3642379618_qkif.jpg' },
    { key: 'bead_belt',             url: 'https://i.etsystatic.com/61577339/r/il/c1f956/7131860570/il_300x300.7131860570_tlhb.jpg' },
    { key: 'bead_leather_belt',     url: 'https://i.etsystatic.com/61061460/r/il/30cea3/7136472415/il_300x300.7136472415_m713.jpg' },
    { key: 'kitenge_fabric',        url: 'https://i.etsystatic.com/6827550/r/il/8e55f6/2419189774/il_340x270.2419189774_pw89.jpg' },
    { key: 'kitenge_fabric2',       url: 'https://i.etsystatic.com/6827550/r/il/cace67/2863639435/il_340x270.2863639435_ducl.jpg' },
    { key: 'kanga_print',           url: 'https://i.etsystatic.com/18823161/r/il/e3d008/3833422583/il_794xN.3833422583_kak4.jpg' },
    { key: 'kanga_print2',          url: 'https://i.etsystatic.com/18823161/r/il/fb9b68/3833421487/il_794xN.3833421487_94jt.jpg' },
    { key: 'leather_sandals',       url: 'https://mawuafrica.com/cdn/shop/products/OfycmYV8oE.jpg?v=1672926098&width=1100' },
    { key: 'sisal_basket',          url: 'https://i.etsystatic.com/48344997/r/il/21cdeb/6792077909/il_340x270.6792077909_lepv.jpg' },
    { key: 'sisal_basket2',         url: 'https://i.etsystatic.com/48344997/r/il/eae79b/6744258432/il_340x270.6744258432_nb9k.jpg' },
    { key: 'woven_bag',             url: 'https://i.etsystatic.com/24008784/r/il/c3bdb8/2470082513/il_340x270.2470082513_41la.jpg' },
    { key: 'wooden_carving',        url: 'https://i.ebayimg.com/images/g/ObsAAeSwIZJpHFqN/s-l400.webp' },
    { key: 'wooden_figurine',       url: 'https://i.ebayimg.com/images/g/BN0AAeSwsFZod72p/s-l400.webp' },
    { key: 'pottery_bowl',          url: 'https://epicureandculture.com/wp-content/uploads/2015/07/rsz_img_8001.jpg' },
    { key: 'pottery2',              url: 'https://epicureandculture.com/wp-content/uploads/2015/07/rsz_1img_8005.jpg' },
    { key: 'kanga_wrap',            url: 'https://www.imagediva.com/cdn/shop/products/20200802_011351000_iOS_400x.jpg?v=1607919434' },
    { key: 'bead_anklet2',          url: 'https://m.media-amazon.com/images/I/31wt9mPLnDL.jpg' },
];

// ── product catalogue (100 products, 20 per country) ────────────────────
// img refs cycle through uploaded images
const PRODUCTS = {
    KE: [
        { title: 'Maasai Beaded Choker Necklace', cat: 'Handicrafts', price: 2500, img: 'bead_maasai_necklace', desc: 'Hand-beaded Maasai choker in vibrant reds and blues. Each piece is unique, made by Maasai women artisans in Kajiado.' },
        { title: 'Maasai Collar Necklace Wide', cat: 'Handicrafts', price: 3200, img: 'bead_collar_necklace', desc: 'Wide collar bib necklace with traditional Maasai bead patterns. Perfect statement piece.' },
        { title: 'Kitenge Ankara Fabric (2 yards)', cat: 'Fashion', price: 1800, img: 'kitenge_fabric', desc: 'High-quality Ankara wax print fabric. Ideal for dresses, shirts and bags. 100% cotton.' },
        { title: 'Kitenge Print Fabric Assorted', cat: 'Fashion', price: 1600, img: 'kitenge_fabric2', desc: 'Bold African wax print fabric in assorted patterns. 2-yard cut, ready for tailoring.' },
        { title: 'Beaded Leather Sandals (Maasai)', cat: 'Fashion', price: 3500, img: 'leather_sandals', desc: 'Genuine leather sandals hand-beaded by Maasai craftsmen in Nairobi. Durable and colourful.' },
        { title: 'Sisal Woven Basket (Large)', cat: 'Handicrafts', price: 2200, img: 'sisal_basket', desc: 'Hand-woven sisal basket from Nairobi artisans. Used for market shopping and home décor.' },
        { title: 'Sisal Tote Basket Bag', cat: 'Handicrafts', price: 1900, img: 'sisal_basket2', desc: 'Lightweight and sturdy sisal tote, woven in Kiambu County. Perfect beach or market bag.' },
        { title: 'African Kanga Fabric Wrap', cat: 'Fashion', price: 900, img: 'kanga_print', desc: 'Authentic Kenyan kanga with traditional Swahili proverb border. 100% cotton, 2-piece set.' },
        { title: 'Kanga Leso East African Wrap', cat: 'Fashion', price: 950, img: 'kanga_print2', desc: 'Bright multi-colour kanga fabric in pink and yellow tones. Versatile clothing and décor.' },
        { title: 'African Beaded Anklet Set', cat: 'Handicrafts', price: 1100, img: 'bead_anklet', desc: 'Set of 3 hand-beaded anklets in bold East African colours. Adjustable, fits all sizes.' },
        { title: 'African Pottery Bowl (Handmade)', cat: 'Handicrafts', price: 2800, img: 'pottery_bowl', desc: 'Traditional hand-thrown pottery bowl fired with wood kiln. Each piece unique, from Machakos.' },
        { title: 'Clay Cooking Pot (Fired)', cat: 'Kitchen', price: 1500, img: 'pottery2', desc: 'Traditional clay cooking pot used across Kenya for stews and ugali. Enhances natural flavour.' },
        { title: 'Woven Sisal Market Handbag', cat: 'Fashion', price: 2100, img: 'woven_bag', desc: 'Handmade sisal handbag with leather straps. Colourful geometric pattern, eco-friendly.' },
        { title: 'Maasai Beaded Leather Belt', cat: 'Fashion', price: 1700, img: 'bead_belt', desc: 'Genuine cowhide belt with hand-sewn Maasai bead detail. Unisex, all waist sizes available.' },
        { title: 'African Wooden Carving Sculpture', cat: 'Handicrafts', price: 4500, img: 'wooden_carving', desc: 'Hand-carved African hardwood sculpture depicting the Tree of Life. Signed by Nairobi artist.' },
        { title: 'Wooden Tribal Figurine', cat: 'Handicrafts', price: 3800, img: 'wooden_figurine', desc: 'Intricately carved tribal women figurine in ebony wood. A collector\'s piece from Mombasa craftsmen.' },
        { title: 'Neutral Maasai Leather Belt', cat: 'Fashion', price: 1800, img: 'bead_leather_belt', desc: 'Earth-toned Maasai beaded leather belt. Handmade in Nairobi, durable stitching.' },
        { title: 'African Print Ankara Dress Fabric', cat: 'Fashion', price: 2000, img: 'kitenge_fabric', desc: '3-yard Ankara wax print fabric in vibrant patterns for full dress making. 100% cotton.' },
        { title: 'Maasai Bib Collar Necklace', cat: 'Handicrafts', price: 2900, img: 'bead_collar_wide', desc: 'Statement Maasai bib collar necklace in multicolour beads. Hand-strung by Kajiado artisans.' },
        { title: 'African Beaded Anklet Pair', cat: 'Handicrafts', price: 800, img: 'bead_anklet2', desc: 'Pair of colourful handmade beaded anklets. Traditional Kenyan pattern, adjustable fit.' },
    ],
    UG: [
        { title: 'Kiganda Bark Cloth Table Runner', cat: 'Handicrafts', price: 45000, img: 'kanga_wrap', desc: 'UNESCO heritage bark cloth (olubugo) hand-processed from fig trees in Central Uganda. Unique table décor.' },
        { title: 'Ugandan Raffia Woven Basket', cat: 'Handicrafts', price: 38000, img: 'sisal_basket', desc: 'Hand-woven raffia basket from Busoga artisans. Used for storage and as a wedding gift (obusuulo).' },
        { title: 'Kente-Style Kitenge Fabric', cat: 'Fashion', price: 28000, img: 'kitenge_fabric', desc: 'Bold Ugandan kitenge fabric in gold and green patterns. 2 yards, perfect for gomesi or shirt.' },
        { title: 'Beaded Gorilla Souvenir Necklace', cat: 'Handicrafts', price: 22000, img: 'bead_collar_necklace', desc: 'Beaded necklace featuring gorilla motif — symbol of Uganda. Handmade in Bwindi community workshop.' },
        { title: 'Uganda Pottery Water Pot', cat: 'Handicrafts', price: 35000, img: 'pottery_bowl', desc: 'Traditional unglazed water storage pot made by Buganda potters. Naturally cools water inside.' },
        { title: 'Matooke Serving Bowl (Clay)', cat: 'Kitchen', price: 18000, img: 'pottery2', desc: 'Handmade clay serving bowl used for matooke and groundnut stew. From Masaka potters.' },
        { title: 'Ugandan Sisal Tote Bag', cat: 'Fashion', price: 32000, img: 'woven_bag', desc: 'Colourful sisal and recycled fabric tote bag woven by Kampala women cooperatives.' },
        { title: 'Wooden Drum (Engalabi)', cat: 'Handicrafts', price: 85000, img: 'wooden_carving', desc: 'Traditional Ugandan long drum (engalabi) hand-carved from Mvule wood. Used in cultural ceremonies.' },
        { title: 'African Ankara Gomesi Fabric', cat: 'Fashion', price: 25000, img: 'kitenge_fabric2', desc: 'Premium Ankara fabric for tailoring the traditional Ugandan gomesi dress. 4-yard cut.' },
        { title: 'Beaded Leather Sandals (Kampala)', cat: 'Fashion', price: 55000, img: 'leather_sandals', desc: 'Hand-stitched leather sandals with colourful bead work. Made by Kampala cobblers.' },
        { title: 'Kanga Wrap (Ugandan Print)', cat: 'Fashion', price: 15000, img: 'kanga_print', desc: 'East African kanga wrap with bright Ugandan-inspired print. 100% cotton, versatile use.' },
        { title: 'Ebony Wood Elephant Carving', cat: 'Handicrafts', price: 120000, img: 'wooden_figurine', desc: 'Hand-carved ebony elephant sculpture from Jinja craftsmen. Fair-trade certified artwork.' },
        { title: 'Ugandan Beaded Choker', cat: 'Handicrafts', price: 18000, img: 'bead_maasai_necklace', desc: 'Beaded choker in traditional Ugandan red and black pattern. Handmade in Gulu cooperative.' },
        { title: 'African Print Kanga Set (2-piece)', cat: 'Fashion', price: 20000, img: 'kanga_print2', desc: 'Two matching kanga pieces in complementary African print. Popular in Ugandan markets.' },
        { title: 'Sisal Floor Basket (Handwoven)', cat: 'Handicrafts', price: 42000, img: 'sisal_basket2', desc: 'Large flat floor basket woven from natural sisal. Traditional Ugandan storage and décor.' },
        { title: 'Maasai-Style Beaded Anklet', cat: 'Handicrafts', price: 14000, img: 'bead_anklet', desc: 'Colourful beaded anklet popular across East Africa. Handmade in Mbarara craft market.' },
        { title: 'Ugandan Leather Wallet', cat: 'Fashion', price: 28000, img: 'bead_leather_belt', desc: 'Genuine cowhide wallet with beaded exterior panel. Handmade by Kampala leather artisans.' },
        { title: 'Clay Stew Pot (Traditional)', cat: 'Kitchen', price: 22000, img: 'pottery_bowl', desc: 'Traditional clay pot for slow-cooking groundnut stew and beans. From Fort Portal potters.' },
        { title: 'Beaded Collar Necklace (Wide)', cat: 'Handicrafts', price: 26000, img: 'bead_collar_wide', desc: 'Wide beaded collar in multicolour patterns inspired by Karamojong adornment traditions.' },
        { title: 'African Bead & Leather Belt', cat: 'Fashion', price: 30000, img: 'bead_belt', desc: 'Handcrafted leather belt with colourful bead panels. Unisex design from Entebbe artisans.' },
    ],
    RW: [
        { title: 'Rwandan Agaseke Peace Basket', cat: 'Handicrafts', price: 15000, img: 'sisal_basket', desc: 'Iconic Rwanda peace basket (agaseke) woven by women cooperatives. UNESCO recognised craft.' },
        { title: 'Agaseke Basket with Lid', cat: 'Handicrafts', price: 20000, img: 'sisal_basket2', desc: 'Coiled sisal agaseke with traditional geometric pattern lid. A symbol of Rwandan heritage.' },
        { title: 'Imigongo Geometric Wall Art', cat: 'Handicrafts', price: 35000, img: 'pottery_bowl', desc: 'Traditional Rwandan imigongo wall art made from cattle dung and clay. Black-and-white geometric patterns.' },
        { title: 'Rwandan Kitenge Fabric (2 yds)', cat: 'Fashion', price: 12000, img: 'kitenge_fabric', desc: 'Quality kitenge fabric in traditional Rwandan colours. Perfect for umushanana or modern dress.' },
        { title: 'Umushanana Fabric Set', cat: 'Fashion', price: 18000, img: 'kitenge_fabric2', desc: '3-yard matching fabric set for tailoring the Rwandan umushanana ceremonial dress.' },
        { title: 'Beaded Rwandan Necklace', cat: 'Handicrafts', price: 8000, img: 'bead_maasai_necklace', desc: 'Handmade beaded necklace by Kigali women artisans cooperative. Traditional red and white beads.' },
        { title: 'Kanga Wrap (Rwanda Print)', cat: 'Fashion', price: 7000, img: 'kanga_print', desc: 'Light cotton kanga wrap in Rwanda-inspired green and yellow print. Versatile daily use.' },
        { title: 'Hand-thrown Clay Pot', cat: 'Handicrafts', price: 14000, img: 'pottery2', desc: 'Traditional Rwandan inziya clay pot used for serving banana beer. Handmade in Nyanza.' },
        { title: 'Sisal Market Tote (Kigali)', cat: 'Fashion', price: 10000, img: 'woven_bag', desc: 'Eco-friendly sisal shopping bag from Kigali market weavers. Colourful stripe pattern.' },
        { title: 'Rwandan Wooden Sculpture', cat: 'Handicrafts', price: 25000, img: 'wooden_carving', desc: 'Hand-carved wooden sculpture depicting Rwandan family unity. From Butare wood carvers.' },
        { title: 'Leather Sandals (Kigali-made)', cat: 'Fashion', price: 22000, img: 'leather_sandals', desc: 'Hand-stitched genuine leather sandals made by Kigali cobblers. Comfortable all-day wear.' },
        { title: 'Beaded Choker Collar', cat: 'Handicrafts', price: 9000, img: 'bead_collar_necklace', desc: 'Elegant beaded choker in traditional East African bead colours. Handmade in Kigali.' },
        { title: 'African Wooden Figurine (Rwanda)', cat: 'Handicrafts', price: 30000, img: 'wooden_figurine', desc: 'Carved soapstone and wood figurine from Gisenyi artisans. Symbol of Rwandan hospitality.' },
        { title: 'Colourful Beaded Anklet', cat: 'Handicrafts', price: 5000, img: 'bead_anklet', desc: 'Three-piece beaded anklet set inspired by East African colour traditions. Adjustable size.' },
        { title: 'Maasai-Style Wide Bib Necklace', cat: 'Handicrafts', price: 11000, img: 'bead_collar_wide', desc: 'Wide bib necklace in bright multicolour beads. Popular in Kigali craft markets.' },
        { title: 'Rwandan Leather Belt (Beaded)', cat: 'Fashion', price: 13000, img: 'bead_belt', desc: 'Genuine leather belt with colourful bead panel. Handcrafted by Kigali leather artisans.' },
        { title: 'Kanga Set (East African Print)', cat: 'Fashion', price: 8000, img: 'kanga_print2', desc: 'Two-piece matching kanga set in vibrant East African colours. 100% cotton.' },
        { title: 'Clay Cooking Pot (Rwanda)', cat: 'Kitchen', price: 12000, img: 'pottery_bowl', desc: 'Traditional Rwandan clay pot for cooking isombe and other local dishes. Wood-fired finish.' },
        { title: 'Neutral Beaded Leather Belt', cat: 'Fashion', price: 14000, img: 'bead_leather_belt', desc: 'Earth-tone leather belt with subtle bead detail. Handmade in Butare craft workshop.' },
        { title: 'Agaseke-Style Woven Bag', cat: 'Handicrafts', price: 16000, img: 'sisal_basket', desc: 'Handbag inspired by the iconic agaseke weaving technique. Practical and culturally meaningful.' },
    ],
    ET: [
        { title: 'Ethiopian Habesha Kemis Fabric', cat: 'Fashion', price: 850, img: 'kitenge_fabric', desc: 'Traditional Ethiopian white cotton fabric with coloured border (tilet) for habesha kemis dress.' },
        { title: 'Ethiopian Tibeb Scarf (Handwoven)', cat: 'Fashion', price: 1200, img: 'kanga_print', desc: 'Hand-loomed Ethiopian scarf with traditional tibeb (border) pattern. Pure cotton, lightweight.' },
        { title: 'Lalibela Stone Cross Necklace', cat: 'Handicrafts', price: 650, img: 'bead_collar_necklace', desc: 'Carved obsidian stone cross necklace from Lalibela artisans. Symbol of Ethiopian Orthodox faith.' },
        { title: 'Ethiopian Beaded Collar Necklace', cat: 'Handicrafts', price: 950, img: 'bead_collar_wide', desc: 'Wide beaded collar necklace in traditional Ethiopian gold, red and green. Handmade in Addis.' },
        { title: 'Pottery Coffee Jebena', cat: 'Kitchen', price: 380, img: 'pottery_bowl', desc: 'Traditional Ethiopian clay coffee pot (jebena) used in the coffee ceremony. Hand-shaped in Tigray.' },
        { title: 'Clay Injera Plate (Mitad)', cat: 'Kitchen', price: 420, img: 'pottery2', desc: 'Hand-crafted clay injera griddle (mitad) for making traditional Ethiopian flatbread at home.' },
        { title: 'Ethiopian Woven Basket (Mesob)', cat: 'Handicrafts', price: 1800, img: 'sisal_basket', desc: 'Traditional Ethiopian mesob (woven table) used for serving injera. Handmade by Harari weavers.' },
        { title: 'Tibeb Kanga Cotton Wrap', cat: 'Fashion', price: 750, img: 'kanga_wrap', desc: 'Ethiopian-style cotton wrap with traditional border pattern. Multi-purpose daily and ceremonial use.' },
        { title: 'Dorze Woven Cotton Blanket', cat: 'Fashion', price: 2200, img: 'kanga_print2', desc: 'Hand-loomed cotton blanket from the Dorze weavers of Chencha, SNNPR. Natural dyes used.' },
        { title: 'Ethiopian Leather Sandals', cat: 'Fashion', price: 1500, img: 'leather_sandals', desc: 'Genuine Ethiopian leather sandals from Addis Ababa cobblers. Comfortable, hand-stitched.' },
        { title: 'Wooden Coptic Carved Panel', cat: 'Handicrafts', price: 3500, img: 'wooden_carving', desc: 'Hand-carved wooden panel with Coptic cross motifs from Lalibela artisans. Wall décor.' },
        { title: 'Ethiopian Tribal Wooden Figure', cat: 'Handicrafts', price: 2800, img: 'wooden_figurine', desc: 'Carved wooden figurine representing Mursi or Hamar tribe traditions. From Jinka craftsmen.' },
        { title: 'Beaded Surma Necklace', cat: 'Handicrafts', price: 1100, img: 'bead_maasai_necklace', desc: 'Beaded necklace inspired by Surma and Mursi adornment traditions of the Omo Valley.' },
        { title: 'Sisal Shopping Basket (Harar)', cat: 'Handicrafts', price: 900, img: 'sisal_basket2', desc: 'Woven sisal basket from Harari weavers known for colourful geometric patterns.' },
        { title: 'Ethiopian Leather Shoulder Bag', cat: 'Fashion', price: 1800, img: 'woven_bag', desc: 'Hand-stitched Ethiopian leather shoulder bag with Coptic cross embossed detail.' },
        { title: 'Beaded Ankle Bracelet (Omo)', cat: 'Handicrafts', price: 450, img: 'bead_anklet', desc: 'Colourful beaded anklet inspired by Omo Valley tribes\' traditions. Handmade in Addis craft market.' },
        { title: 'Ethiopian Tibeb Scarf (Premium)', cat: 'Fashion', price: 1600, img: 'kitenge_fabric2', desc: 'Premium hand-loomed tibeb scarf with elaborate border in gold thread. Perfect for gala events.' },
        { title: 'Beaded Belt (Ethiopian Style)', cat: 'Fashion', price: 800, img: 'bead_belt', desc: 'Wide beaded belt in Ethiopian red, gold and green. Traditional style from Gondar artisans.' },
        { title: 'Ethiopian Leather Sandal Belt', cat: 'Fashion', price: 950, img: 'bead_leather_belt', desc: 'Combined leather sandal and belt set from Addis Ababa leather market. Hand-tooled design.' },
        { title: 'Anklet Bead Set (Ethiopia)', cat: 'Handicrafts', price: 550, img: 'bead_anklet2', desc: 'Set of colourful bead anklets from Addis Ababa market stalls. Adjustable, vibrant colours.' },
    ],
    SS: [
        { title: 'Dinka Beaded Corset Necklace', cat: 'Handicrafts', price: 12000, img: 'bead_collar_wide', desc: 'Elaborate beaded corset necklace from Dinka cultural tradition. Symbol of beauty and status.' },
        { title: 'Dinka Beaded Choker (Youth)', cat: 'Handicrafts', price: 7000, img: 'bead_maasai_necklace', desc: 'Dinka beaded choker necklace worn during initiation ceremonies. Handmade in Bor community.' },
        { title: 'South Sudan Kitenge Fabric', cat: 'Fashion', price: 8000, img: 'kitenge_fabric', desc: 'Vibrant kitenge wax-print fabric popular in Juba\'s markets. Perfect for dresses and shirts.' },
        { title: 'Nuer Hand-woven Grass Mat', cat: 'Handicrafts', price: 5500, img: 'sisal_basket', desc: 'Traditional Nuer sleeping and sitting mat woven from local grass. From Upper Nile region.' },
        { title: 'Nuer Hand-woven Basket', cat: 'Handicrafts', price: 6000, img: 'sisal_basket2', desc: 'Colourful woven storage basket by Nuer women artisans. Practical and decorative.' },
        { title: 'Wooden Carved Dinka Stool', cat: 'Handicrafts', price: 25000, img: 'wooden_carving', desc: 'Traditional Dinka one-legged stool (yieth) carved from single piece of wood. Cultural artefact.' },
        { title: 'Zande Carved Tribal Figure', cat: 'Handicrafts', price: 18000, img: 'wooden_figurine', desc: 'Hand-carved wooden figure from Azande artistic tradition in Western Equatoria.' },
        { title: 'South Sudan Kanga Wrap', cat: 'Fashion', price: 4500, img: 'kanga_print', desc: 'Colourful cotton kanga wrap popular across South Sudan. Traditional daily wear.' },
        { title: 'Woven Market Basket (Juba)', cat: 'Fashion', price: 4000, img: 'woven_bag', desc: 'Large woven market bag from Juba craft market. Durable sisal and palm fibre construction.' },
        { title: 'Mundu Clay Water Pot', cat: 'Kitchen', price: 7500, img: 'pottery_bowl', desc: 'Traditional Mundu clay water pot from Western Equatoria. Keeps water naturally cool.' },
        { title: 'Clay Cooking Pot (Juba)', cat: 'Kitchen', price: 5000, img: 'pottery2', desc: 'Hand-shaped clay cooking pot from Juba potters. Used for sorghum porridge and stews.' },
        { title: 'Leather Sandals (Juba-made)', cat: 'Fashion', price: 9500, img: 'leather_sandals', desc: 'Handmade leather sandals from Juba cobbler cooperatives. Sturdy and comfortable.' },
        { title: 'Dinka Beaded Anklet', cat: 'Handicrafts', price: 3500, img: 'bead_anklet', desc: 'Traditional Dinka beaded anklet worn by women during celebrations. Handmade in Bor.' },
        { title: 'African Ankara Fabric (SS)', cat: 'Fashion', price: 7000, img: 'kitenge_fabric2', desc: 'Bold Ankara wax print fabric popular in Juba. 2-yard cut suitable for one outfit.' },
        { title: 'Bead & Leather Belt (Dinka)', cat: 'Fashion', price: 6500, img: 'bead_belt', desc: 'Wide beaded leather belt worn by Dinka men during ceremonies. Handmade in Rumbek.' },
        { title: 'Toposa Beaded Collar', cat: 'Handicrafts', price: 8500, img: 'bead_collar_necklace', desc: 'Large beaded collar from Toposa community in Eastern Equatoria. Rich in colour and symbolism.' },
        { title: 'Kanga Leso Set (South Sudan)', cat: 'Fashion', price: 5000, img: 'kanga_print2', desc: 'Two-piece kanga set in East African print colours. Popular in Juba and Wau markets.' },
        { title: 'Zande Woven Palm Basket', cat: 'Handicrafts', price: 7000, img: 'sisal_basket', desc: 'Intricately woven palm-leaf basket from Azande tradition in Western Equatoria.' },
        { title: 'Nuer Beaded Anklet Set', cat: 'Handicrafts', price: 4000, img: 'bead_anklet2', desc: 'Set of 3 beaded anklets in traditional Nuer pattern. Popular across South Sudan.' },
        { title: 'South Sudan Leather Belt', cat: 'Fashion', price: 5500, img: 'bead_leather_belt', desc: 'Hand-tooled leather belt from Juba\'s leather market. Sturdy cowhide, beaded panel detail.' },
    ],
};

// ── country lookup ────────────────────────────────────────────────────────
const COUNTRY_CODES = { KE: null, UG: null, RW: null, ET: null, SS: null };
const CITIES = {
    KE: ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret'],
    UG: ['Kampala','Entebbe','Jinja','Gulu','Mbarara'],
    RW: ['Kigali','Butare','Gisenyi','Musanze','Huye'],
    ET: ['Addis Ababa','Dire Dawa','Mekelle','Gondar','Hawassa'],
    SS: ['Juba','Wau','Malakal','Yambio','Torit'],
};

async function main() {
    // Auth
    const { error: authErr } = await sb.auth.signInWithPassword({
        email: 'superadmin@store.com', password: 'super2026'
    });
    if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
    console.log('Authenticated as superadmin\n');

    // ── 1. Upload images ──────────────────────────────────────────────────
    console.log('Uploading images...');
    const uploadedPaths = {};
    for (const img of IMAGE_SOURCES) {
        const p = await upload(img.key, img.url);
        if (p) uploadedPaths[img.key] = p;
    }
    console.log(`\nUploaded ${Object.keys(uploadedPaths).length}/${IMAGE_SOURCES.length} images\n`);

    // ── 2. Fetch country IDs ──────────────────────────────────────────────
    const { data: countries } = await sb.from('countries').select('id, code');
    for (const c of countries) {
        if (COUNTRY_CODES[c.code] !== undefined) COUNTRY_CODES[c.code] = c.id;
    }
    console.log('Country IDs:', COUNTRY_CODES);

    // ── 3. Delete old seeded products ─────────────────────────────────────
    console.log('\nRemoving old seeded products...');
    const { data: oldProds } = await sb.from('products').select('id').in('country_id', Object.values(COUNTRY_CODES).filter(Boolean));
    if (oldProds?.length) {
        const oldIds = oldProds.map(p => p.id);
        await sb.from('product_images').delete().in('product_id', oldIds);
        await sb.from('products').delete().in('id', oldIds);
        console.log(`  Removed ${oldIds.length} old products`);
    }

    // ── 4. Insert new products ────────────────────────────────────────────
    console.log('\nInserting new products...');
    const { data: { user } } = await sb.auth.getUser();
    let insertedCount = 0;

    for (const [code, items] of Object.entries(PRODUCTS)) {
        const countryId = COUNTRY_CODES[code];
        if (!countryId) { console.log(`  SKIP ${code}: country not found`); continue; }
        const cities = CITIES[code];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const storagePath = uploadedPaths[item.img] || `seed/${item.img}.jpg`;
            const city = cities[i % cities.length];

            const { data: prod, error: prodErr } = await sb.from('products').insert({
                user_id: user.id,
                title: item.title,
                description: item.desc,
                price: item.price,
                category: item.cat,
                country_id: countryId,
                county: city,
                storage_path: storagePath,
                product_status: 'published',
                available_quantity: Math.floor(Math.random() * 20) + 5,
            }).select('id').single();

            if (prodErr) { console.log(`  ERR ${item.title}: ${prodErr.message}`); continue; }

            await sb.from('product_images').insert({
                product_id: prod.id,
                storage_path: storagePath,
                is_main: true,
                display_order: 0,
            });

            insertedCount++;
        }
        console.log(`  ✓ ${code}: ${items.length} products`);
    }

    console.log(`\nDone! Inserted ${insertedCount} products total.`);
}

main().catch(e => { console.error(e); process.exit(1); });
