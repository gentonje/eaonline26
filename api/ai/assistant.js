const axios = require('axios');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const ALLOWED_ATTRIBUTES = new Set(['color', 'colour', 'size', 'brand', 'model', 'storage', 'condition', 'gender', 'material']);
const COUNTRIES = { kenya: 'KE', uganda: 'UG', tanzania: 'TZ', ethiopia: 'ET', rwanda: 'RW', 'south sudan': 'SS', sudan: 'SD' };
const GREETINGS = /^(hi|hello|hey|hiya|good morning|good afternoon|good evening|how are you)[!.?,\s]*$/i;
const NOISE = /^[a-z0-9]{1,2}[!.?,\s]*$/i;

function parseIntent(message) {
  const original = String(message || '').trim().slice(0, 500);
  const lower = original.toLowerCase();
  if (GREETINGS.test(original)) return { intent: 'greeting', query: '', attributes: {}, limit: 4, sort: 'newest' };
  if (NOISE.test(original)) return { intent: 'clarify', query: '', attributes: {}, limit: 4, sort: 'newest' };

  const out = {
    intent: /\b(trending|popular|best sellers)\b/.test(lower) ? 'trending' :
      /\b(new arrivals|latest products)\b/.test(lower) ? 'new' : 'search',
    query: '', attributes: {}, limit: 4, sort: 'newest'
  };
  const parsePrice = (match) => {
    if (!match) return undefined;
    const raw = match[1].replace(/,/g, '').toLowerCase();
    const n = Number(raw.replace(/k$/, ''));
    return Number.isFinite(n) ? n * (raw.endsWith('k') ? 1000 : 1) : undefined;
  };
  const max = lower.match(/\b(?:under|below|less than|up to|max(?:imum)?)\s*(?:kshs?|kes|ugx|tzs|usd|ssp|sh)?\s*([\d,]+(?:\.\d+)?k?)/);
  const min = lower.match(/\b(?:above|over|more than|from)\s*(?:kshs?|kes|ugx|tzs|usd|ssp|sh)?\s*([\d,]+(?:\.\d+)?k?)/);
  const maxPrice = parsePrice(max), minPrice = parsePrice(min);
  if (maxPrice !== undefined) out.max_price = maxPrice;
  if (minPrice !== undefined) out.min_price = minPrice;

  const color = ['white','black','red','blue','green','yellow','brown','pink','grey','gray','orange','purple'].find(c => new RegExp('\\b' + c + '\\b').test(lower));
  if (color) out.attributes.color = color === 'gray' ? 'grey' : color;
  const condition = lower.match(/\b(new|used|refurbished|second hand)\b/);
  if (condition) out.condition = condition[1] === 'second hand' ? 'used' : condition[1];

  for (const [name, code] of Object.entries(COUNTRIES)) {
    if (new RegExp('\\b' + name + '\\b').test(lower)) {
      out.country_code = code;
      break;
    }
  }

  const location = lower.match(/\bin\s+([a-z][a-z .'-]{1,35})(?:\s*,|\s+under\b|\s+below\b|\s+for\b|$)/);
  if (location && !COUNTRIES[location[1].trim()]) out.county = location[1].trim();

  out.query = lower
    .replace(/\b(show me|find me|find|looking for|i need|i want|do you have|any|please|buy|search for|can you get me|i am looking for)\b/g, ' ')
    .replace(/\b(?:under|below|less than|up to|max(?:imum)?|above|over|more than|from)\s*(?:kshs?|kes|ugx|tzs|usd|ssp|sh)?\s*[\d,.]+k?/g, ' ')
    .replace(/\b(?:white|black|red|blue|green|yellow|brown|pink|grey|gray|orange|purple|new|used|refurbished|second hand)\b/g, ' ')
    .replace(/\b(?:in|from)\s+(kenya|uganda|tanzania|ethiopia|rwanda|south sudan|sudan)\b/g, ' ')
    .replace(/\b(?:please|for me|within my budget)\b/g, ' ')
    .replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  return out;
}

function validateIntent(input, fallback) {
  const intents = new Set(['search', 'trending', 'new', 'clarify', 'greeting']);
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
  if (typeof input.condition === 'string') out.condition = input.condition.slice(0, 40);
  if (input.attributes && typeof input.attributes === 'object' && !Array.isArray(input.attributes)) {
    for (const [key, value] of Object.entries(input.attributes)) {
      if (ALLOWED_ATTRIBUTES.has(key) && ['string', 'number'].includes(typeof value)) {
        out.attributes[key === 'colour' ? 'color' : key] = String(value).slice(0, 60);
      }
    }
  }
  return out;
}

async function interpret(message) {
  const fallback = parseIntent(message);
  if (fallback.intent === 'greeting' || fallback.intent === 'clarify') return fallback;
  const prompt = [
    'You interpret natural-language shopping requests for an East African marketplace.',
    'Return one compact JSON object. Extract product type as query; colour, size, brand, model, condition, price bounds, country and county as filters.',
    'Understand synonyms, spelling variants and conversational phrasing. Map sports shoes to Sports Shoes. Do not invent filters or products.',
    'Allowed keys: intent(search|trending|new|clarify), query, category, country_code, county, min_price, max_price, condition, attributes, sort, limit.',
    'Allowed attributes: color,size,brand,model,storage,gender,material. Country codes: KE, UG, TZ, RW, ET, SS.',
    'Never return SQL, code, explanations or extra keys. JSON only.',
    'Example: "Find me white sports shoes under KSh 5,000 in Kenya" => {"intent":"search","query":"sports shoes","country_code":"KE","max_price":5000,"attributes":{"color":"white"}}.',
    'Example: "hi" => {"intent":"greeting","query":""}. Example: "c" => {"intent":"clarify","query":""}.',
    'Shopper message: ' + String(message || '').slice(0, 500)
  ].join(' ');

  let interpreted = null;
  if (process.env.GROQ_API_KEY) {
    try {
      const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }], temperature: 0, max_tokens: 180,
        response_format: { type: 'json_object' }
      }, { headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }, timeout: 12000 });
      interpreted = validateIntent(JSON.parse(r.data.choices[0].message.content), fallback);
    } catch (e) { console.warn('[asha] Groq unavailable:', e.response?.status || e.message); }
  }
  if (!interpreted && process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const r = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(process.env.GEMINI_API_KEY),
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 180, responseMimeType: 'application/json' } },
        { timeout: 12000 });
      interpreted = validateIntent(JSON.parse(r.data.candidates[0].content.parts[0].text), fallback);
    } catch (e) { console.warn('[asha] Gemini unavailable:', e.response?.status || e.message); }
  }
  if (!interpreted) return fallback;
  const merged = { ...fallback, ...interpreted, attributes: { ...fallback.attributes, ...interpreted.attributes } };
  if (fallback.country_code) merged.country_code = fallback.country_code;
  if (fallback.max_price !== undefined) merged.max_price = fallback.max_price;
  if (fallback.min_price !== undefined) merged.min_price = fallback.min_price;
  if (fallback.condition) merged.condition = fallback.condition;
  return merged;
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
  params.set('select', 'id,title,price,category,county,condition,country_id,taxonomy_node_id,attributes,countries(id,code,currency,name),product_images(storage_path,is_main)');
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
    else throw new Error('Country code is not configured: ' + filters.country_code);
  }
  if (filters.intent === 'new') params.set('created_at', 'gte.' + new Date(Date.now() - 7 * 86400000).toISOString());

  const query = String(filters.query || '').trim().replace(/[*%,]/g, ' ').slice(0, 80);
  if (query) {
    for (const term of query.split(/\s+/).filter(Boolean).slice(0, 5)) {
      const safe = term.replace(/[()[\]]/g, '');
      conditions.push('or(title.ilike.*' + safe + '*,description.ilike.*' + safe + '*,category.ilike.*' + safe + '*,taxonomy_node_id.ilike.*' + safe + '*)');
    }
  }
  for (const [key, value] of Object.entries(filters.attributes || {})) {
    const safe = String(value).replace(/[*%,()]/g, '');
    if (key === 'color') conditions.push('or(attributes->>color.ilike.*' + safe + '*,attributes->>colour.ilike.*' + safe + '*)');
    else if (ALLOWED_ATTRIBUTES.has(key)) conditions.push('attributes->>' + key + '.ilike.*' + safe + '*');
  }
  if (filters.condition) {
    const safe = String(filters.condition).replace(/[*%,()]/g, '');
    conditions.push('or(condition.ilike.*' + safe + '*,attributes->>condition.ilike.*' + safe + '*)');
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
    if (filters.intent === 'greeting') return res.status(200).json({ reply: 'Hi! What are you looking for?', products: [], filters });
    if (filters.intent === 'clarify' || !filters.query) return res.status(200).json({ reply: 'What product are you looking for?', products: [], filters });

    const products = await searchProducts(filters);
    const reply = products.length
      ? (filters.intent === 'trending' ? 'Here are recent listings.' : 'Found ' + products.length + ' matching products.')
      : 'No exact matches. Try a nearby product type or a wider budget.';
    return res.status(200).json({ reply, products, filters, result_count: products.length });
  } catch (err) {
    console.error('[asha] request failed:', {
      message: err.message, status: err.response?.status,
      detail: err.response?.data?.message || err.response?.data?.hint || err.response?.data?.details
    });
    return res.status(500).json({ error: 'Shopping search temporarily unavailable' });
  }
};

module.exports.parseIntent = parseIntent;
module.exports.validateIntent = validateIntent;
module.exports.interpret = interpret;
module.exports.searchProducts = searchProducts;
