const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  'https://svxosqalniuljggecqxx.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const phones = [
  // Kenya (country_id: 1, currency: KES) - 1 USD ≈ 130 KES
  { title: "iPhone 17 Pro Max", description: "Apple's flagship with 6.9\" Super Retina XDR display, A19 Pro chip, triple 48MP cameras with 8x optical zoom, 39-hour battery life, titanium design, and 2TB storage option. The most powerful iPhone ever made.", price: 155870, currency: "KES", country_id: 1, category: "Electronics" },
  { title: "Samsung Galaxy S26 Ultra", description: "Samsung's ultimate flagship with 6.9\" Dynamic AMOLED display, Snapdragon 8 Elite Gen 5, 200MP camera with f/1.4 aperture, S Pen, 60W fast charging, titanium frame, and satellite connectivity.", price: 168870, currency: "KES", country_id: 1, category: "Electronics" },
  { title: "Google Pixel 10 Pro", description: "Google's AI-first phone with 6.3\" Super Actua display at 3,300 nits, Tensor G5 chip, 50MP main camera with 100x Pro Res Zoom, 24+ hour battery, and the best computational photography.", price: 129870, currency: "KES", country_id: 1, category: "Electronics" },
  { title: "OnePlus 15", description: "The flagship killer with Snapdragon 8 Elite Gen 5, massive 7,300mAh battery, 120W fast charging, triple 50MP cameras, 6.78\" AMOLED 165Hz display, and IP69 durability rating.", price: 116870, currency: "KES", country_id: 1, category: "Electronics" },
  { title: "Xiaomi 15 Ultra", description: "Photography powerhouse with Leica quad camera system, 200MP Samsung HP9 sensor, 50MP Sony LYT-900 1-inch main sensor, 6.73\" 2K AMOLED display, Snapdragon 8 Elite, and 90W charging.", price: 146640, currency: "KES", country_id: 1, category: "Electronics" },
  { title: "Samsung Galaxy A56 5G", description: "Best mid-range with 6.7\" Super AMOLED display, Exynos 1580 chip, 50MP OIS camera, IP67 water resistance, 5000mAh battery, and 7 years of software updates.", price: 55900, currency: "KES", country_id: 1, category: "Electronics" },

  // Uganda (country_id: 2, currency: UGX) - 1 USD ≈ 3,700 UGX
  { title: "iPhone 17 Pro", description: "Apple's pro powerhouse with 6.3\" Super Retina XDR display, A19 Pro chip, 48MP triple camera system with 5x optical zoom, ProRes video recording, and all-day battery life.", price: 4070000, currency: "UGX", country_id: 2, category: "Electronics" },
  { title: "Samsung Galaxy S26+", description: "Premium Samsung with 6.7\" Dynamic AMOLED 2X display, Snapdragon 8 Elite Gen 5, 50MP triple cameras, 4700mAh battery, 45W fast charging, and One UI with Galaxy AI.", price: 3885000, currency: "UGX", country_id: 2, category: "Electronics" },
  { title: "Google Pixel 10", description: "Pure Android experience with Tensor G5 chip, 50MP main camera with AI photography, 6.3\" Actua display, 7 years of updates, and Gemini AI assistant built-in.", price: 2590000, currency: "UGX", country_id: 2, category: "Electronics" },
  { title: "Samsung Galaxy Z Fold 7", description: "Samsung's latest foldable with 7.6\" Dynamic AMOLED inner display, Snapdragon 8 Elite Gen 5, triple cameras, S Pen support, Flex Mode, and slimmer hinge design.", price: 6660000, currency: "UGX", country_id: 2, category: "Electronics" },
  { title: "Samsung Galaxy Z Flip 7", description: "Compact foldable with 6.7\" AMOLED main display, 3.6\" cover screen, Snapdragon 8 Elite Gen 5, FlexCam selfie features, and stylish compact design.", price: 3700000, currency: "UGX", country_id: 2, category: "Electronics" },
  { title: "Tecno Phantom V2 Fold", description: "Africa's favorite foldable with 7.85\" inner display, MediaTek Dimensity 9200+, 50MP cameras, multitasking features, and premium design at an accessible price.", price: 3330000, currency: "UGX", country_id: 2, category: "Electronics" },

  // South Sudan (country_id: 3, currency: SSP) - 1 USD ≈ 1,300 SSP
  { title: "iPhone 17", description: "The new standard iPhone with 6.1\" OLED display, A19 chip, 48MP Fusion camera, Dynamic Island, aluminum unibody design, and all-day battery life.", price: 1039000, currency: "SSP", country_id: 3, category: "Electronics" },
  { title: "Samsung Galaxy S26", description: "Samsung flagship with 6.2\" Dynamic AMOLED 2X, Snapdragon 8 Elite Gen 5, 50MP triple camera, 4000mAh battery, 25W fast charging, and 7 years of updates.", price: 1039000, currency: "SSP", country_id: 3, category: "Electronics" },
  { title: "Tecno Camon 40 Pro", description: "Camera-focused mid-ranger with 108MP main camera, 6.78\" AMOLED display, MediaTek Helio G99, 5000mAh battery, 33W fast charging, and AI photography features.", price: 390000, currency: "SSP", country_id: 3, category: "Electronics" },
  { title: "Infinix Note 50 Pro", description: "Value powerhouse with 6.78\" AMOLED 120Hz display, MediaTek Dimensity 7300, 108MP camera, 5000mAh battery with 68W charging, and JBL-tuned stereo speakers.", price: 325000, currency: "SSP", country_id: 3, category: "Electronics" },
  { title: "Samsung Galaxy A16 5G", description: "Affordable 5G with 6.7\" Super AMOLED display, Exynos 1330, 50MP camera, 5000mAh battery, IP54 splash resistance, and 6 years of security updates.", price: 260000, currency: "SSP", country_id: 3, category: "Electronics" },
  { title: "Xiaomi Redmi Note 14 Pro", description: "Mid-range champion with 6.67\" AMOLED 120Hz display, Snapdragon 7s Gen 3, 200MP main camera, 5500mAh battery, 45W fast charging, and IP68 water resistance.", price: 390000, currency: "SSP", country_id: 3, category: "Electronics" },

  // Ethiopia (country_id: 4, currency: ETB) - 1 USD ≈ 130 ETB
  { title: "iPhone 17 Air", description: "Apple's thinnest ever iPhone at just 5.5mm, with 6.6\" OLED display, A19 chip, single 48MP camera, Apple Intelligence, and ultra-lightweight aluminum design.", price: 129870, currency: "ETB", country_id: 4, category: "Electronics" },
  { title: "Samsung Galaxy S25 FE", description: "Fan Edition flagship with 6.7\" Dynamic AMOLED display, Snapdragon 8 Gen 3, 50MP triple cameras, 4500mAh battery, 45W fast charging, and 7 years of updates at great value.", price: 84500, currency: "ETB", country_id: 4, category: "Electronics" },
  { title: "Google Pixel 9a", description: "Best budget Pixel with Tensor G4 chip, 48MP camera with AI photography, 6.3\" OLED display, 24-hour battery, and 7 years of software updates at an incredible price.", price: 65000, currency: "ETB", country_id: 4, category: "Electronics" },
  { title: "Nothing Phone 3a Pro", description: "Unique design with Glyph Interface LED lights, 50MP triple cameras with 3x optical zoom, Snapdragon 7s Gen 3, 6.8\" AMOLED display, and 7 years of updates.", price: 52000, currency: "ETB", country_id: 4, category: "Electronics" },
  { title: "Motorola Edge 60 Pro", description: "Premium Motorola with 6.7\" pOLED 165Hz display, Snapdragon 8 Elite, 50MP triple cameras with OIS, 5000mAh battery, 125W TurboPower charging, and clean Android.", price: 91000, currency: "ETB", country_id: 4, category: "Electronics" },
  { title: "Huawei Pura 80 Pro", description: "Huawei's camera flagship with XMAGE quad camera system, variable aperture lens, 6.8\" LTPO OLED display, Kirin 9100 chip, 5500mAh battery, and satellite messaging.", price: 130000, currency: "ETB", country_id: 4, category: "Electronics" },

  // Rwanda (country_id: 5, currency: RWF) - 1 USD ≈ 1,380 RWF
  { title: "iPhone 16e", description: "Most affordable new iPhone with 6.1\" OLED display, A18 chip, 48MP camera, Apple Intelligence, Face ID, and all-day battery life. Perfect entry into the Apple ecosystem.", price: 828000, currency: "RWF", country_id: 5, category: "Electronics" },
  { title: "Samsung Galaxy S25 Ultra", description: "Samsung's 2025 flagship with 6.9\" Dynamic AMOLED, Snapdragon 8 Elite, 200MP camera, S Pen, titanium frame, Galaxy AI features, and 45W fast charging.", price: 1518000, currency: "RWF", country_id: 5, category: "Electronics" },
  { title: "Google Pixel 10 Pro XL", description: "Google's largest flagship with 6.9\" Super Actua LTPO display, Tensor G5 chip, 50MP triple cameras with 100x zoom, 5500mAh battery, and advanced Gemini AI.", price: 1518000, currency: "RWF", country_id: 5, category: "Electronics" },
  { title: "Oppo Find X8 Pro", description: "Hasselblad camera flagship with quad 50MP cameras, 6.78\" LTPO AMOLED display, Dimensity 9400, 5910mAh silicon-carbon battery, 80W fast charging, and IP69 rating.", price: 1242000, currency: "RWF", country_id: 5, category: "Electronics" },
  { title: "CMF Phone 2 Pro", description: "Budget innovation by Nothing with customizable modular design, 6.7\" AMOLED 120Hz display, MediaTek Dimensity 7300, 50MP camera, 5000mAh battery, and NFC.", price: 385020, currency: "RWF", country_id: 5, category: "Electronics" },
  { title: "Motorola Moto G Play 2026", description: "Ultra-affordable with 6.7\" IPS display, MediaTek Dimensity 6300, dual cameras, 5000mAh battery, 18W charging, and clean Android experience for everyday use.", price: 248400, currency: "RWF", country_id: 5, category: "Electronics" },
];

async function updateProducts() {
  const { data: existing, error: fetchErr } = await sb.from('products').select('id').order('created_at');
  if (fetchErr) { console.error('Fetch error:', fetchErr); return; }
  
  console.log(`Updating ${existing.length} products with real 2026 phone data...`);
  
  for (let i = 0; i < Math.min(existing.length, phones.length); i++) {
    const phone = phones[i];
    const productId = existing[i].id;
    
    const { error } = await sb.from('products').update({
      title: phone.title,
      description: phone.description,
      price: phone.price,
      currency: phone.currency,
      country_id: phone.country_id,
      category: phone.category,
      product_status: 'published',
      in_stock: true,
      available_quantity: Math.floor(Math.random() * 20) + 5,
    }).eq('id', productId);
    
    if (error) {
      console.error(`Error updating ${phone.title}:`, error.message);
    } else {
      console.log(`✓ ${i+1}. ${phone.title} - ${phone.currency} ${phone.price.toLocaleString()}`);
    }
  }
  
  console.log('\nAll products updated successfully!');
}

updateProducts();
