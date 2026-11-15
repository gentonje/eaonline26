const axios = require('axios');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const ALLOWED_ATTRIBUTES = new Set(['color', 'size', 'brand', 'model', 'storage', 'condition', 'gender', 'material']);
const COUNTRIES = {
  kenya: 'KE', uganda: 'UG', tanzania: 'TZ', ethiopia: 'ET',
  rwanda: 'RW', 'south sudan': 'SS', sudan: 'SD'
};

function parseIntent(message) {
  const lower = String(message || '').trim().slice(0, 500).toLowerCase();
  const out = { intent: /\\b(trending|popular|best sellers)\\b/.test(lower) ? 'trending' : /\\b(new arrivals|latest products)\\b/.test(lower) ? 'new' : 'search', query: '', attributes: {}, limit: 4, sort: 'newest' };
  const max = lower.match(/\\b(?:under|below|less than|up to|max(?:imum)?)\\s*(?:ksh|kes|ugx|tzs|usd|ssp)?\\s*([\\d,]+)/);
  const min = lower.match(/\\b(?:above|over|more than)\\s*(?:ksh|kes|ugx|tzs|usd|ssp)?\\s*([\\d,]+)/);
  if (max) out.max_price = Number(max[1].replace(/,/g, ''));
  if (min) out.min_price = Number(min[1].replace(/,/g, ''));
  const color = ['white','black','red','blue','green','yellow','brown','pink','grey','gray'].find(c => new RegExp('\\\\b' + c + '\\\\b').test(lower));
  if (color) out.attributes.color = color;
  const condition = lower.match(/\\b(new|used|refurbished|second hand)\\b/);
  if (condition) out.attributes.condition = condition[1] === 'second hand' ? 'used' : condition[1];
  for (const [name, code] of Object.entries(COUNTRIES)) {
    if (new RegExp('\\\\b' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\\\b').test(lower)) {
      out.country_code = code;
      break;
    }
  }
  const location = lower.match(/\\bin\\s+([a-z][a-z .'-]{1,35})(?:\\s*,|\\s+under\\b|\\s+below\\b|\\s+for\\b|$)/);
  if (location && !COUNTRIES[location[1].trim()]) out.county = location[1].trim();
  out.query = lower
    .replace(/\\b(show me|find me|find|looking for|i need|i want|do you have|any|please|buy|search for)\\b/g, ' ')
    .replace(/\\b(?:under|below|less than|up to|max(?:imum)?|above|over|more than)\\s*(?:ksh|kes|ugx|tzs|usd|ssp)?\\s*[\\d,]+/g, ' ')
    .replace(/\\b(?:white|black|red|blue|green|yellow|brown|pink|grey|gray|new|used|refurbished|second hand)\\b/g, ' ')
    .replace(/\\b(?:in|from)\\s+(kenya|uganda|tanzania|ethiopia|rwanda|south sudan|sudan)\\b/g, ' ')
    .replace(/[^a-z0-9 -]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 100);
  return out;
}

function validateIntent(input, fallback) {
  const intents = new Set(['search', 'trending', 'new', 'clarify']);
  const out = {
    intent: intents.has(input.intent) ? input.intent : fallback.intent,
    query: typeof input.query === 'string' ? input.query.trim().slice(0, 100) : fallback.query,
    attributes: {},
    limit: Math.max(1, Math.min(6, Number(input.limit) || 4)),
    sort: input.sort === 'price_asc' ? 'price_asc' : 'newest'
  };
  if (typeof input.category === 'string') out.category = input.category.slice(0, 80);
  if (typeof input.country_code === 'string' && /^[A-Z]{2}$/i.test(input.country_code)) out.country_code = input.country_code.toUpperCase();
  if (typeof input.county === 'string') out.county = input.county.slice(0, 80);
  for (const key of ['min_price', 'max_price']) {
    const n = Number(input[key]);
    if (Number.isFinite(n) && n >= 0 && n <= 100000000000) out[key] = n;
  }
  if (input.attributes && typeof input.attributes === 'object' && !Array.isArray(input.attributes)) {
    for (const [key, value] of Object.entries(input.attributes)) {
      if (ALLOWED_ATTRIBUTES.has(key) && ['string', 'number'].includes(typeof value)) out.attributes[key] = String(value).slice(0, 60);
    }
  }
  return out;
}

async function interpret(message) {
  const fallback = parseIntent(message);
  if (fallback.query && (fallback.min_price !== undefined || fallback.max_price !== undefined ||
      Object.keys(fallback.attributes).length || fallback.country_code || fallback.county)) return fallback;
  const prompt = [
    'Convert the shopper message into one compact JSON object.',
    'Allowed keys: intent(search|trending|new|clarify), query, category, country_code, county, min_price, max_price, attributes, sort, limit.',
    'Allowed attributes: color,size,brand,model,storage,condition,gender,material.',
    'Never return SQL, code, explanations, or extra keys. Return JSON only.',
    'Shopper message: ' + String(message || '').slice(0, 500)
  ].join(' ');
  if (process.env.GROQ_API_KEY) {
    try {
      const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }], temperature: 0, max_tokens: 180,
        response_format: { type: 'json_object' }
      }, { headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }, timeout: 12000 });
      return validateIntent(JSON.parse(r.data.choices[0].message.content), fallback);
    } catch (e) { console.warn('[asha] Groq unavailable:', e.response?.status || e.message); }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const r = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(process.env.GEMINI_API_KEY),
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 180, responseMimeType: 'application/json' } },
        { timeout: 12000 });
      return validateIntent(JSON.parse(r.data.candidates[0].content.parts[0].text), fallback);
    } catch (e) { console.warn('[asha] Gemini unavailable:', e.response?.status || e.message); }
  }
  return fallback;
}

async function publicQuery(path) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase public credentials are missing');
  const r = await axios.get(SUPABASE_URL + '/rest/v1/' + path, {
    headers: { apikey: SUPABASE_KEY }, timeout: 10000
  });
  return r.data;
}

async function searchProducts(filters) {
  const params = new URLSearchParams();
  params.set('product_status', 'eq.published');
  params.set('select', 'id,title,price,category,county,country_id,attributes,countries(id,code,currency,name),product_images(storage_path,is_main)');
  params.set('limit', String(filters.limit || 4));
  params.set('order', filters.sort === 'price_asc' ? 'price.asc' : 'created_at.desc');
  const conditions = [];
  if (filters.min_price !== undefined) conditions.push('price.gte.' + filters.min_price);
  if (filters.max_price !== undefined) conditions.push('price.lte.' + filters.max_price);
  if (filters.county) conditions.push('county.ilike.*' + filters.county.replace(/[*%,]/g, '') + '*');
  if (filters.category) conditions.push('category.ilike.*' + filters.category.replace(/[*%,]/g, '') + '*');
  if (filters.country_code) {
    const countries = await publicQuery('countries?code=eq.' + encodeURIComponent(filters.country_code) + '&select=id&limit=1');
    if (countries?.[0]?.id) params.set('country_id', 'eq.' + countries[0].id);
  }
  if (filters.intent === 'new') params.set('created_at', 'gte.' + new Date(Date.now() - 7 * 86400000).toISOString());
  const query = String(filters.query || '').trim().replace(/[*%,]/g, ' ').slice(0, 80);
  if (query) {
    const terms = query.split(/\\s+/).filter(Boolean).slice(0, 5);
    conditions.push(...terms.map(term => 'or(title.ilike.*' + term + '*,description.ilike.*' + term + '*,category.ilike.*' + term + '*)'));
  }
  for (const [key, value] of Object.entries(filters.attributes || {})) {
    if (ALLOWED_ATTRIBUTES.has(key)) conditions.push('attributes->>' + key + '.ilike.*' + String(value).replace(/[*%,]/g, '') + '*');
  }
  if (conditions.length) params.set('and', '(' + conditions.join(',') + ')');
  const rows = await publicQuery('products?' + params.toString());
  return Array.isArray(rows) ? rows : [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'Search service not configured' });
  try {
    const user = await axios.get(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_KEY, Authorization: auth }, timeout: 10000
    });
    if (!user.data?.id) return res.status(401).json({ error: 'Invalid session' });
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'message required' });
    if (message.length > 500) return res.status(400).json({ error: 'Message too long' });
    const filters = await interpret(message);
    const countryCode = req.body?.country_code;
    if (countryCode && /^[A-Z]{2}$/i.test(countryCode) && !filters.country_code) filters.country_code = countryCode.toUpperCase();
    if (filters.intent === 'clarify' || (!filters.query && filters.intent === 'search')) {
      return res.status(200).json({ reply: 'What product are you seeking?', products: [], filters });
    }
    const products = await searchProducts(filters);
    const reply = products.length
      ? (filters.intent === 'trending' ? 'Here are recent listings.' : 'Found ' + products.length + ' matching products.')
      : (filters.intent === 'trending' ? 'No recent listings yet.' : 'No matches. Broaden your search.');
    return res.status(200).json({ reply, products, filters, result_count: products.length });
  } catch (err) {
    console.error('[asha] request failed:', {
      message: err.message,
      status: err.response?.status,
      detail: err.response?.data?.message || err.response?.data?.hint || err.response?.data?.details
    });
    return res.status(500).json({ error: 'Shopping search temporarily unavailable' });
  }
};
