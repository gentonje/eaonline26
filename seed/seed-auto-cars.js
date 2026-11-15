#!/usr/bin/env node
/**
 * Seeds 50 cars/trucks across 5 East African countries (10 per country).
 * Uses 50 unique high-quality car images stored in seed/auto_images/.
 * Uploads images to bucket 'images' under seed/auto/ folder
 * (per-category folder = "category bucket" convention).
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const CATEGORY_FOLDER = 'auto';

// Each car has: key (matches local filename), label
const CARS = [
    { key: 'auto_toyota_vitz_hatchback',         label: 'Toyota Vitz' },
    { key: 'auto_toyota_premio_sedan_white',     label: 'Toyota Premio' },
    { key: 'auto_toyota_probox_station_wagon',   label: 'Toyota Probox' },
    { key: 'auto_toyota_mark_x_sedan',           label: 'Toyota Mark X' },
    { key: 'auto_toyota_corolla_fielder_wagon',  label: 'Toyota Corolla Fielder' },
    { key: 'auto_toyota_allion_sedan',           label: 'Toyota Allion' },
    { key: 'auto_toyota_wish_mpv',               label: 'Toyota Wish' },
    { key: 'auto_toyota_passo_hatchback',        label: 'Toyota Passo' },
    { key: 'auto_toyota_axio_sedan',             label: 'Toyota Axio' },
    { key: 'auto_toyota_crown_sedan',            label: 'Toyota Crown' },
    { key: 'auto_toyota_harrier_suv',            label: 'Toyota Harrier' },
    { key: 'auto_toyota_rav4_suv',               label: 'Toyota RAV4' },
    { key: 'auto_toyota_land_cruiser_prado',     label: 'Toyota Land Cruiser Prado' },
    { key: 'auto_toyota_land_cruiser_v8',        label: 'Toyota Land Cruiser V8' },
    { key: 'auto_toyota_hilux_pickup_truck',     label: 'Toyota Hilux' },
    { key: 'auto_toyota_hiace_van',              label: 'Toyota Hiace' },
    { key: 'auto_toyota_noah_mpv_van',           label: 'Toyota Noah' },
    { key: 'auto_toyota_voxy_van',               label: 'Toyota Voxy' },
    { key: 'auto_toyota_coaster_bus',            label: 'Toyota Coaster (Bus)' },
    { key: 'auto_honda_fit_hatchback',           label: 'Honda Fit' },
    { key: 'auto_honda_cr_v_suv',                label: 'Honda CR-V' },
    { key: 'auto_honda_vezel_crossover',         label: 'Honda Vezel' },
    { key: 'auto_honda_stream_mpv',              label: 'Honda Stream' },
    { key: 'auto_mazda_demio_hatchback',         label: 'Mazda Demio' },
    { key: 'auto_mazda_cx_5_suv',                label: 'Mazda CX-5' },
    { key: 'auto_mazda_axela_sedan',             label: 'Mazda Axela' },
    { key: 'auto_subaru_forester_suv',           label: 'Subaru Forester' },
    { key: 'auto_subaru_outback_wagon',          label: 'Subaru Outback' },
    { key: 'auto_subaru_impreza_sedan',          label: 'Subaru Impreza' },
    { key: 'auto_subaru_legacy_sedan',           label: 'Subaru Legacy' },
    { key: 'auto_nissan_note_hatchback',         label: 'Nissan Note' },
    { key: 'auto_nissan_x_trail_suv',            label: 'Nissan X-Trail' },
    { key: 'auto_nissan_patrol_suv',             label: 'Nissan Patrol' },
    { key: 'auto_nissan_navara_pickup',          label: 'Nissan Navara' },
    { key: 'auto_nissan_march_hatchback',        label: 'Nissan March' },
    { key: 'auto_nissan_tiida_sedan',            label: 'Nissan Tiida' },
    { key: 'auto_nissan_caravan_van',            label: 'Nissan Caravan' },
    { key: 'auto_mitsubishi_pajero_suv',         label: 'Mitsubishi Pajero' },
    { key: 'auto_mitsubishi_outlander_suv',      label: 'Mitsubishi Outlander' },
    { key: 'auto_mitsubishi_l200_pickup',        label: 'Mitsubishi L200' },
    { key: 'auto_mitsubishi_canter_truck',       label: 'Mitsubishi Canter (Truck)' },
    { key: 'auto_isuzu_d_max_pickup',            label: 'Isuzu D-Max' },
    { key: 'auto_isuzu_npr_truck',               label: 'Isuzu NPR (Truck)' },
    { key: 'auto_isuzu_frr_truck',               label: 'Isuzu FRR (Truck)' },
    { key: 'auto_suzuki_escudo_suv',             label: 'Suzuki Escudo' },
    { key: 'auto_suzuki_swift_hatchback',        label: 'Suzuki Swift' },
    { key: 'auto_hino_300_truck',                label: 'Hino 300 (Truck)' },
    { key: 'auto_hino_500_truck',                label: 'Hino 500 (Truck)' },
    { key: 'auto_mercedes_benz_actros_truck',    label: 'Mercedes-Benz Actros (Truck)' },
    { key: 'auto_ford_ranger_pickup',            label: 'Ford Ranger' },
];

// Per-country pricing tier (KE base in KES; others use local currency rough equivalents)
// Years are realistic East-Africa import-age examples.
const COUNTRY_CONFIG = {
    KE: {
        currency: 'KES',
        cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Kiambu', 'Machakos', 'Nyeri', 'Meru'],
        priceFor: (label) => carPriceKES(label),
        descSuffix: 'Available in Nairobi. Logbook ready, KRA cleared, foreign-used / locally-used import.',
    },
    UG: {
        currency: 'UGX',
        cities: ['Kampala', 'Entebbe', 'Jinja', 'Mbarara', 'Gulu', 'Mbale', 'Lira', 'Masaka', 'Soroti', 'Fort Portal'],
        priceFor: (label) => Math.round(carPriceKES(label) * 28), // ~UGX per KES rough
        descSuffix: 'Available in Kampala. URA cleared, registration in progress / completed.',
    },
    RW: {
        currency: 'RWF',
        cities: ['Kigali', 'Butare', 'Gisenyi', 'Musanze', 'Huye', 'Rubavu', 'Nyagatare', 'Muhanga', 'Rwamagana', 'Kibuye'],
        priceFor: (label) => Math.round(carPriceKES(label) * 9.5),
        descSuffix: 'Available in Kigali. RRA cleared, ready for transfer.',
    },
    ET: {
        currency: 'ETB',
        cities: ['Addis Ababa', 'Dire Dawa', 'Mekelle', 'Gondar', 'Hawassa', 'Bahir Dar', 'Adama', 'Jimma', 'Dessie', 'Harar'],
        priceFor: (label) => Math.round(carPriceKES(label) * 0.95),
        descSuffix: 'Available in Addis Ababa. Customs cleared, libre book ready.',
    },
    SS: {
        currency: 'SSP',
        cities: ['Juba', 'Wau', 'Malakal', 'Yambio', 'Torit', 'Bor', 'Bentiu', 'Aweil', 'Rumbek', 'Yei'],
        priceFor: (label) => Math.round(carPriceKES(label) * 9),
        descSuffix: 'Available in Juba. Documentation complete.',
    },
};

// Rough East-Africa used-car indicative pricing in KES.
function carPriceKES(label) {
    const l = label.toLowerCase();
    if (l.includes('actros') || l.includes('hino 500')) return 4500000;
    if (l.includes('canter') || l.includes('isuzu npr') || l.includes('frr') || l.includes('hino 300')) return 2400000;
    if (l.includes('coaster')) return 3200000;
    if (l.includes('land cruiser v8') || l.includes('patrol')) return 6500000;
    if (l.includes('prado') || l.includes('harrier')) return 4200000;
    if (l.includes('hilux') || l.includes('navara') || l.includes('d-max') || l.includes('ranger') || l.includes('l200')) return 2800000;
    if (l.includes('crown') || l.includes('mark x') || l.includes('outback') || l.includes('legacy')) return 1900000;
    if (l.includes('rav4') || l.includes('cx-5') || l.includes('cr-v') || l.includes('forester') || l.includes('x-trail') || l.includes('outlander') || l.includes('escudo') || l.includes('vezel') || l.includes('pajero')) return 2200000;
    if (l.includes('hiace') || l.includes('caravan') || l.includes('noah') || l.includes('voxy') || l.includes('stream') || l.includes('wish')) return 1700000;
    if (l.includes('premio') || l.includes('allion') || l.includes('axio') || l.includes('axela') || l.includes('impreza') || l.includes('tiida')) return 1300000;
    if (l.includes('fielder') || l.includes('probox')) return 1100000;
    // Hatchbacks
    return 850000;
}

function descFor(label, suffix) {
    const yearPool = [2014, 2015, 2016, 2017, 2018, 2019];
    const year = yearPool[Math.floor(Math.random() * yearPool.length)];
    const mileage = Math.floor(Math.random() * 90000) + 40000;
    const colorPool = ['Pearl White', 'Silver', 'Black', 'Dark Grey', 'Champagne', 'Beige'];
    const color = colorPool[Math.floor(Math.random() * colorPool.length)];
    return `${year} ${label} in excellent condition. ${color} exterior, ${mileage.toLocaleString()} km on the clock. Well-maintained, full service history, accident-free. ${suffix} Test drives welcome — serious buyers only.`;
}

async function uploadOne(localPath, remotePath) {
    const buf = fs.readFileSync(localPath);
    const { error } = await sb.storage.from('images').upload(remotePath, buf, {
        contentType: 'image/jpeg', upsert: true,
    });
    if (error) throw error;
    return remotePath;
}

async function main() {
    // 0) Sign in as superadmin so RLS policies allow inserts
    const { error: authErr } = await sb.auth.signInWithPassword({
        email: 'superadmin@store.com', password: 'super2026'
    });
    if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
    console.log('Authenticated as superadmin\n');

    // 1) Upload all 50 images to seed/auto/
    console.log('STEP 1 — Uploading 50 car images to images/seed/auto/ ...');
    const localDir = path.join(__dirname, 'auto_images');
    const pathMap = {};
    let okUp = 0, failUp = 0;
    for (const car of CARS) {
        const local = path.join(localDir, car.key + '.jpg');
        if (!fs.existsSync(local)) { console.log(`  ✗ missing local: ${car.key}`); failUp++; continue; }
        const remote = `seed/${CATEGORY_FOLDER}/${car.key}.jpg`;
        try {
            await uploadOne(local, remote);
            pathMap[car.key] = remote;
            okUp++;
        } catch (e) {
            console.log(`  ✗ upload ${car.key}: ${e.message}`);
            failUp++;
        }
    }
    console.log(`  ✓ Uploaded ${okUp}/${CARS.length} (failed ${failUp})`);

    // 2) Get country IDs and an admin user
    const { data: countries, error: cErr } = await sb.from('countries').select('id, code');
    if (cErr) throw cErr;
    const countryMap = Object.fromEntries(countries.map(c => [c.code, c.id]));

    const { data: { user } } = await sb.auth.getUser();
    const sellerId = user.id;

    // 3) Insert products — assign 10 cars per country (round-robin so each car appears in some countries)
    console.log('\nSTEP 2 — Inserting 50 product listings (10 per country) ...');
    let inserted = 0;
    const codes = Object.keys(COUNTRY_CONFIG);
    let carIdx = 0;
    for (const code of codes) {
        const cfg = COUNTRY_CONFIG[code];
        const countryId = countryMap[code];
        if (!countryId) { console.log(`  SKIP ${code} (no country row)`); continue; }
        for (let i = 0; i < 10; i++) {
            const car = CARS[carIdx % CARS.length];
            carIdx++;
            const storage_path = pathMap[car.key];
            if (!storage_path) { console.log(`  SKIP ${car.key} (no upload)`); continue; }
            const city = cfg.cities[i % cfg.cities.length];
            const price = cfg.priceFor(car.label);

            const { data: prod, error } = await sb.from('products').insert({
                user_id: sellerId,
                title: `${car.label} (${code === 'KE' ? 'Kenya' : code === 'UG' ? 'Uganda' : code === 'RW' ? 'Rwanda' : code === 'ET' ? 'Ethiopia' : 'South Sudan'})`,
                description: descFor(car.label, cfg.descSuffix),
                price,
                category: 'Auto',
                country_id: countryId,
                county: city,
                storage_path,
                product_status: 'published',
                available_quantity: 1,
            }).select('id').single();
            if (error) { console.log(`  ✗ ${car.label} / ${code}: ${error.message}`); continue; }

            const { error: imgErr } = await sb.from('product_images').insert({
                product_id: prod.id,
                storage_path,
                is_main: true,
                display_order: 0,
            });
            if (imgErr) console.log(`  ! image link ${car.label}: ${imgErr.message}`);
            inserted++;
        }
        console.log(`  ✓ ${code}: ${10} listings`);
    }

    console.log(`\nDone. Inserted ${inserted}/50 cars in 'Auto' category.`);
    console.log(`Bucket folder: images/seed/${CATEGORY_FOLDER}/  (per-category folder convention)`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
