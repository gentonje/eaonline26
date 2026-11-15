// ─────────────────────────────────────────────────────────────────────────────
// Product quality & safety scanner
//   - Detects blurry/low-quality main images (gpt-4o-mini vision)
//   - Detects harmful / sexually explicit / violent content in title,
//     description and the main image (OpenAI omni-moderation-latest)
// Flagged products are moved back to product_status='draft' and tagged with
// quality_flag = 'blurry' | 'harmful' so admins can see what happened.
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios');

const QUALITY_FLAGS = { BLURRY: 'blurry', HARMFUL: 'harmful' };
const SCAN_RECHECK_DAYS = 14;          // re-check published items every N days
const SCAN_BATCH_SIZE = 25;            // products per daily run (cost cap)
const SCAN_CONCURRENCY = 3;            // parallel checks within a batch

function buildImageUrl(supabaseUrl, storagePath) {
  if (!storagePath) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  return `${supabaseUrl}/storage/v1/object/public/images/${storagePath}`;
}

function pickMainImagePath(product) {
  const imgs = (product.product_images || [])
    .slice()
    .sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || (a.display_order || 0) - (b.display_order || 0));
  return imgs[0]?.storage_path || product.storage_path || null;
}

// ─── Moderation: text + image via omni-moderation-latest ────────────────────
// Categories considered harmful for a public marketplace listing.
const HARMFUL_CATEGORIES = [
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'hate',
  'hate/threatening',
  'harassment/threatening',
  'illicit',
  'illicit/violent',
];

async function runModeration(openai, { text, imageUrl }) {
  const inputs = [];
  if (text && text.trim()) inputs.push({ type: 'text', text: text.slice(0, 4000) });
  if (imageUrl) inputs.push({ type: 'image_url', image_url: { url: imageUrl } });
  if (inputs.length === 0) return { flagged: false, categories: [] };

  try {
    const r = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: inputs,
    });
    const result = r.results?.[0] || {};
    const flagged = !!result.flagged;
    const cats = Object.entries(result.categories || {})
      .filter(([k, v]) => v && HARMFUL_CATEGORIES.includes(k))
      .map(([k]) => k);
    return { flagged: flagged && cats.length > 0, categories: cats };
  } catch (err) {
    console.warn('[quality] moderation failed:', err.message);
    return { flagged: false, categories: [], error: err.message };
  }
}

// ─── Blur / low-quality detection via gpt-4o-mini vision ────────────────────
// We ask the model to assess sharpness, lighting and usability for a product
// listing. It returns strict JSON we can act on.
async function runBlurCheck(openai, imageUrl) {
  if (!imageUrl) return { is_blurry: false, sharpness: 1, reason: 'no image' };
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a strict e-commerce photo QA reviewer. Assess whether the image is ' +
            'usable as the MAIN product photo for an online marketplace listing. ' +
            'Return ONLY JSON with keys: ' +
            '"is_blurry" (boolean — true if the photo is noticeably blurry, out of focus, ' +
            'motion-blurred, heavily pixelated, very low resolution, or so dark/over-exposed ' +
            'the product is hard to see), ' +
            '"sharpness" (number 0..1 where 1 is tack-sharp), ' +
            '"reason" (short string, max 90 chars, plain English). ' +
            'Be strict but fair: a slightly soft phone photo where the product is clearly ' +
            'visible is NOT blurry. Only flag images a buyer would call "blurry" or "bad quality".',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Assess this product photo.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 120,
    });
    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    return {
      is_blurry: !!parsed.is_blurry,
      sharpness: Math.max(0, Math.min(1, Number(parsed.sharpness) || 0)),
      reason: String(parsed.reason || '').slice(0, 120),
    };
  } catch (err) {
    console.warn('[quality] blur check failed:', err.message);
    return { is_blurry: false, sharpness: 1, reason: 'check failed', error: err.message };
  }
}

// ─── Per-product check ──────────────────────────────────────────────────────
// Returns: { flag: 'blurry' | 'harmful' | null, reason, image_path }
async function checkProduct(openai, supabaseUrl, product) {
  const imagePath = pickMainImagePath(product);
  const imageUrl = buildImageUrl(supabaseUrl, imagePath);
  const text = [product.title, product.description, product.category].filter(Boolean).join('\n');

  // Run moderation first (cheaper, single call covers text + image)
  const mod = await runModeration(openai, { text, imageUrl });
  if (mod.flagged) {
    return {
      flag: QUALITY_FLAGS.HARMFUL,
      reason: `Harmful content detected: ${mod.categories.join(', ')}`,
      image_path: imagePath,
    };
  }

  // Then blur check (only if there is an image)
  if (imageUrl) {
    const blur = await runBlurCheck(openai, imageUrl);
    if (blur.is_blurry) {
      return {
        flag: QUALITY_FLAGS.BLURRY,
        reason: blur.reason || `Image is blurry (sharpness ${blur.sharpness.toFixed(2)})`,
        image_path: imagePath,
      };
    }
  }

  return { flag: null, reason: null, image_path: imagePath };
}

// ─── Daily scan runner ──────────────────────────────────────────────────────
// `deps` provides: supabaseUrl, supabaseServiceKey, openai (client instance)
async function runDailyQualityScan(deps, opts = {}) {
  const { supabaseUrl, supabaseServiceKey, openai } = deps;
  const limit = opts.limit || SCAN_BATCH_SIZE;
  const concurrency = opts.concurrency || SCAN_CONCURRENCY;
  if (!supabaseUrl || !supabaseServiceKey || !openai) {
    return { ok: false, error: 'quality scan: missing supabase or openai config' };
  }

  // Pick: published products that have NEVER been checked, OR were last
  // checked > SCAN_RECHECK_DAYS ago, OR whose image_path has changed since
  // last scan. Order by oldest-checked first so we cycle through everyone.
  const recheckBefore = new Date(Date.now() - SCAN_RECHECK_DAYS * 86400_000).toISOString();
  let products = [];
  try {
    const r = await axios.get(`${supabaseUrl}/rest/v1/products`, {
      params: {
        product_status: 'eq.published',
        or: `(quality_checked_at.is.null,quality_checked_at.lt.${recheckBefore})`,
        select: 'id,title,description,category,storage_path,quality_image_path,product_images(storage_path,is_main,display_order)',
        order: 'quality_checked_at.asc.nullsfirst',
        limit: String(limit),
      },
      headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` },
      timeout: 10000,
    });
    products = r.data || [];
  } catch (err) {
    console.error('[quality] failed to fetch products:', err.response?.data || err.message);
    return { ok: false, error: err.message };
  }

  console.log(`[quality] scanning ${products.length} product(s)…`);
  const summary = { scanned: 0, flagged_blurry: 0, flagged_harmful: 0, errors: 0, items: [] };

  // Simple bounded concurrency
  for (let i = 0; i < products.length; i += concurrency) {
    const slice = products.slice(i, i + concurrency);
    await Promise.all(slice.map(async (p) => {
      try {
        const result = await checkProduct(openai, supabaseUrl, p);
        summary.scanned++;
        const patch = {
          quality_flag: result.flag,
          quality_reason: result.reason,
          quality_checked_at: new Date().toISOString(),
          quality_image_path: result.image_path,
        };
        // If flagged, also unpublish
        if (result.flag) {
          patch.product_status = 'draft';
          if (result.flag === QUALITY_FLAGS.BLURRY) summary.flagged_blurry++;
          if (result.flag === QUALITY_FLAGS.HARMFUL) summary.flagged_harmful++;
        }
        await axios.patch(
          `${supabaseUrl}/rest/v1/products?id=eq.${p.id}`,
          patch,
          {
            headers: {
              apikey: supabaseServiceKey,
              Authorization: `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            timeout: 8000,
          }
        );
        summary.items.push({ id: p.id, title: p.title, flag: result.flag, reason: result.reason });
        if (result.flag) {
          console.log(`[quality] flagged "${p.title}" as ${result.flag}: ${result.reason}`);
        }
      } catch (err) {
        summary.errors++;
        console.warn(`[quality] error on ${p.id}:`, err.response?.data || err.message);
      }
    }));
  }

  console.log(
    `[quality] done. scanned=${summary.scanned} blurry=${summary.flagged_blurry} ` +
    `harmful=${summary.flagged_harmful} errors=${summary.errors}`
  );
  return { ok: true, ...summary };
}

// Schedule a recurring daily run at the next 03:00 UTC, then every 24h.
// Re-uses the same setTimeout chain so we don't drift.
function scheduleDailyScan(deps) {
  const HOUR = 3; // 03:00 UTC
  function msUntilNext() {
    const now = new Date();
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), HOUR, 0, 0, 0
    ));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next - now;
  }
  function loop() {
    const wait = msUntilNext();
    setTimeout(async () => {
      try { await runDailyQualityScan(deps); }
      catch (e) { console.error('[quality] daily run crashed:', e.message); }
      loop();
    }, wait);
  }
  loop();
  console.log(`[quality] daily scan scheduled (next run in ${(msUntilNext()/3600000).toFixed(1)}h)`);
}

module.exports = {
  QUALITY_FLAGS,
  checkProduct,
  runDailyQualityScan,
  scheduleDailyScan,
};
