/* Generates web favicons + OG image from assets/icon-source.png */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icon-source.png');
const PUBLIC = path.join(ROOT, 'public');
const ASSETS = path.join(ROOT, 'assets');

if (!fs.existsSync(PUBLIC)) fs.mkdirSync(PUBLIC, { recursive: true });

async function build() {
    const base = sharp(SRC).flatten({ background: '#FFFFFF' });

    await base.clone().resize(16, 16).png().toFile(path.join(PUBLIC, 'favicon-16x16.png'));
    await base.clone().resize(32, 32).png().toFile(path.join(PUBLIC, 'favicon-32x32.png'));
    await base.clone().resize(180, 180).png().toFile(path.join(PUBLIC, 'apple-touch-icon.png'));
    await base.clone().resize(192, 192).png().toFile(path.join(PUBLIC, 'android-chrome-192x192.png'));
    await base.clone().resize(512, 512).png().toFile(path.join(PUBLIC, 'android-chrome-512x512.png'));

    // Browser tab uses /favicon.ico and /favicon.png by default — make both
    // resolve to the real brand mark instead of Expo's placeholder. Modern
    // browsers happily accept PNG content under the .ico extension.
    await base.clone().resize(48, 48).png().toFile(path.join(PUBLIC, 'favicon.ico'));
    await base.clone().resize(192, 192).png().toFile(path.join(PUBLIC, 'favicon.png'));

    await base.clone().resize(192, 192).png().toFile(path.join(ASSETS, 'favicon.png'));

    const ogBg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#FDB913"/>
                    <stop offset="100%" stop-color="#F59E0B"/>
                </linearGradient>
            </defs>
            <rect width="1200" height="630" fill="url(#g)"/>
            <text x="60" y="180" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="86" fill="#0B0F19">East Africa</text>
            <text x="60" y="290" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="86" fill="#0B0F19">Online</text>
            <rect x="60" y="320" width="120" height="10" fill="#00A082"/>
            <text x="60" y="410" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="34" fill="#0B0F19">Shop. Sell. Pay with M-Pesa.</text>
            <text x="60" y="460" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="26" fill="#0B0F19" opacity="0.75">Kenya · Uganda · Ethiopia · Rwanda · South Sudan</text>
        </svg>`
    );

    const iconBuf = await sharp(SRC).resize(380, 380).png().toBuffer();
    await sharp(ogBg)
        .composite([{ input: iconBuf, left: 760, top: 130 }])
        .png()
        .toFile(path.join(PUBLIC, 'og-image.png'));

    console.log('✓ Web icons + OG image generated');
}

build().catch(e => { console.error(e); process.exit(1); });
