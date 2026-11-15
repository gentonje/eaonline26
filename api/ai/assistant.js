const axios = require('axios');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const ALLOWED_ATTRIBUTES = new Set(['color', 'colour', 'size', 'brand', 'model', 'storage', 'condition', 'gender', 'material']);
const COUNTRIES = { kenya: 'KE', uganda: 'UG', tanzania: 'TZ', ethiopia: 'ET', rwanda: 'RW', 'south sudan': 'SS', sudan: 'SD' };
const GREETINGS = /^(hi|hello|hey|hiya|good morning|good afternoon|good evening|how are you)[!.?,\s]*$/i;
const NOISE = /^[a-z0-9]{1,2}[!.?,\s]*$/i;
const WORD_FIXES = { redd: 'red', reeed: 'red', blu: 'blue', blak: 'black', whte: 'white', wite: 'white', yelow: 'yellow', greay: 'grey', colur: 'color', colour: 'color', tshirt: 'shirt', motercycle: 'motorcycle', motocycle: 'motorcycle', refridgerator: 'refrigerator' };
const COLOR_WORDS = { white: ['white','whte','wite'], black: ['black','blak','blk'], red: ['red','redd','reeed'], blue: ['blue','blu'], green: ['green'], yellow: ['yellow','yelow'], brown: ['brown'], pink: ['pink'], grey: ['grey','gray','greay'], orange: ['orange'], purple: ['purple'] };
const SEARCH_SYNONYMS = { car: ['car','cars','automobile','automobiles'], truck: ['truck','trucks','lorry','lorries'], motorcycle: ['motorcycle','motorcycles','motorbike','motorbikes'], bicycle: ['bicycle','bicycles','bike','bikes'], phone: ['phone','phones','mobile','mobiles','smartphone','smartphones'], shirt: ['shirt','shirts','t-shirt','t-shirts','tee'], shoe: ['shoe','shoes','footwear'], bed: ['bed','beds'], dress: ['dress','dresses'] };
const STOP_WORDS = new Set(['a','an','the','some','any','me','for','please','show','find','get','looking','want','need','give','of','to','with','and']);
function normalizeWord(word) {
  let value = String(word || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  value = WORD_FIXES[value] || value;
  if (value.endsWith('ies') && value.length > 4) value = value.slice(0, -3) + 'y';
  else if (value.endsWith('es') && /(sh|ch|ss|x|z)es$/.test(value)) value = value.slice(0, -2);
  else if (value.endsWith('s') && !/(ss|us|is)$/.test(value) && value.length > 3) value = value.slice(0, -1);
  return value;
}
function searchGroups(query) {
  return String(query || '').toLowerCase().split(/\s+/).filter(Boolean).map(normalizeWord)
    .filter(word => word && !STOP_WORDS.has(word))
    .map(word => SEARCH_SYNONYMS[word] || [word, word + 's']);
}

function detectClarification(message) {
  const text = String(message || '').toLowerCase();
  // Only clarify genuinely ambiguous misspellings; valid broad categories search normally.
  if (/\\b(?:trak|truc|truk)\\b/.test(text) && !/\\b(?:truck|lorry)\\b/.test(text)) {
    return {
      intent: 'clarify', query: '', attributes: {},
      suggestions: [
        { label: 'Truck', description: 'Goods and cargo vehicles', value: 'truck' },
        { label: 'Bus', description: 'Passenger vehicles', value: 'bus' },
        { label: 'Car', description: 'Personal vehicles', value: 'car' },
        { label: 'Tractor', description: 'Farm and utility vehicles', value: 'tractor' }
      ]
    };
  }
  return null;
}

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
  const range = lower.match(/\b(?:between|from)\s*([\d,]+)\s*(?:and|to|-)\s*([\d,]+)\b/);
  if (range) {
    const first = Number(range[1].replace(/,/g, ''));
    const second = Number(range[2].replace(/,/g, ''));
    if (Number.isFinite(first) && Number.isFinite(second)) {
      // A 4-digit year pair is a year range; other ranges are price bounds.
      if (first >= 1900 && first <= 2100 && second >= 1900 && second <= 2100) {
        out.year_from = Math.min(first, second);
        out.year_to = Math.max(first, second);
      } else {
        out.min_price = Math.min(first, second);
        out.max_price = Math.max(first, second);
      }
    }
  }
  const currencyMatch = lower.match(/\b(usd|kes|ksh|ugx|tzs|ssp|rwf|etb)\b/);
  if (currencyMatch) out.currency = currencyMatch[1].toUpperCase();
  if (maxPrice !== undefined) out.max_price = maxPrice;
  if (minPrice !== undefined) out.min_price = minPrice;
  const rangePrice = lower.match(/\b(?:price\s+range\s*)?(?:between|from)?\s*([\d,]+)\s*(?:and|to|-)\s*([\d,]+)\s*(?:usd|kes|ksh|ugx|tzs|ssp|rwf|etb)?\b/);
  if (rangePrice) { const a = Number(rangePrice[1].replace(/,/g, '')); const b = Number(rangePrice[2].replace(/,/g, '')); if (a < 1900 || a > 2100 || b < 1900 || b > 2100) { out.min_price = Math.min(a,b); out.max_price = Math.max(a,b); } }

  for (const [canonical, variants] of Object.entries(COLOR_WORDS)) {
    if (variants.some(word => new RegExp('\\b' + word + '\\b').test(lower))) {
      out.attributes.color = canonical;
      break;
    }
  }
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
    .replace(/\b(show me|find me|find|looking for|i need|i want|do you have|please|buy|search for|can you get me|i am looking for|i want to see|give me)\b/g, ' ')
    .replace(/\b(some|a few|any kind of|kind of)\b/g, ' ')
    .replace(/\b(?:under|below|less than|up to|max(?:imum)?|above|over|more than|from)\s*(?:kshs?|kes|ugx|tzs|usd|ssp|sh)?\s*[\d,.]+k?/g, ' ')
    .replace(/\b(?:white|whte|wite|black|blak|blk|red|redd|reeed|blue|blu|green|yellow|yelow|brown|pink|grey|gray|greay|orange|purple|color|colour|new|used|refurbished|second hand)\b/g, ' ')
    .replace(/\b(?:in|from)\s+(kenya|uganda|tanzania|ethiopia|rwanda|south sudan|sudan)\b/g, ' ')
    .replace(/\b(?:for me|within my budget)\b/g, ' ')
    .replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').map(normalizeWord).filter(Boolean).join(' ').slice(0, 100);
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
  for (const key of ['year_from', 'year_to']) {
    const n = Number(input[key]);
    if (Number.isInteger(n) && n >= 1900 && n <= 2100) out[key] = n;
  }
  if (typeof input.currency === 'string' && /^[A-Z]{3,4}$/.test(input.currency.toUpperCase())) out.currency = input.currency.toUpperCase();
  if (Array.isArray(input.suggestions)) out.suggestions = input.suggestions.slice(0, 4).map(item => ({
    label: String(item.label || '').slice(0, 30),
    description: String(item.description || '').slice(0, 60),
    value: String(item.value || item.label || '').slice(0, 30)
  })).filter(item => item.label && item.value);
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
    'Be a forgiving shopping interpreter, not an exact-keyword matcher. Correct likely typos (redd=red, whte=white), normalize singular/plural (bed/beds, shirt/shirts, car/cars, truck/trucks), understand everyday descriptions and broad requests. "show me some cars" means search the car category even without a make/model. Map common synonyms (lorry=truck, motorbike=motorcycle, mobile=phone, tee=t-shirt). Map sports shoes to Sports Shoes. Return the broad product type when no model is given; never demand an exact model. Do not invent filters or products.',
    'Allowed keys: intent(search|trending|new|clarify), query, category, country_code, county, min_price, max_price, currency, year_from, year_to, condition, attributes, sort, limit, suggestions.',
    'Allowed attributes: color,size,brand,model,storage,gender,material. Country codes: KE, UG, TZ, RW, ET, SS.',
    'Never return SQL, code, explanations or extra keys. JSON only.',
    'Examples: "Find me white sports shoes under KSh 5,000 in Kenya" => {"intent":"search","query":"sports shoes","country_code":"KE","max_price":5000,"attributes":{"color":"white"}}. "show me some cars" => {"intent":"search","query":"car"}. "I need redd shirts" => {"intent":"search","query":"shirt","attributes":{"color":"red"}}. "do you have beds?" => {"intent":"search","query":"bed"}. A broad product category is a valid search; do not ask for make/model.',
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
  if (fallback.year_from !== undefined) merged.year_from = fallback.year_from;
  if (fallback.year_to !== undefined) merged.year_to = fallback.year_to;
  if (fallback.currency) merged.currency = fallback.currency;
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
    for (const group of searchGroups(query).slice(0, 5)) {
      const alternatives = group.flatMap(term => {
        const safe = term.replace(/[()[\\]]/g, '');
        return ['title.ilike.*' + safe + '*','description.ilike.*' + safe + '*','category.ilike.*' + safe + '*','taxonomy_node_id.ilike.*' + safe + '*'];
      });
      conditions.push('or(' + alternatives.join(',') + ')');
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

function describeSearch(filters) {
  const parts = [];
  if (filters.attributes?.color) parts.push(filters.attributes.color + ' ');
  if (filters.query) parts.push(filters.query);
  if (filters.condition) parts.push(filters.condition);
  let description = parts.join(' ').replace(/\s+/g, ' ').trim();
  const currency = filters.country_code === 'KE' ? 'KSh' : filters.country_code === 'UG' ? 'UGX' :
    filters.country_code === 'TZ' ? 'TSh' : filters.country_code === 'RW' ? 'RWF' :
    filters.country_code === 'SS' ? 'SSP' : filters.country_code === 'ET' ? 'ETB' : '';
  if (filters.min_price !== undefined) description += ' above ' + currency + ' ' + Number(filters.min_price).toLocaleString('en');
  if (filters.max_price !== undefined) description += (filters.min_price !== undefined ? '–' : ' under ') + currency + ' ' + Number(filters.max_price).toLocaleString('en');
  if (filters.year_from !== undefined || filters.year_to !== undefined) description += ' · ' + (filters.year_from || filters.year_to) + (filters.year_to && filters.year_from ? '–' + filters.year_to : '');
  if (filters.county) description += ' in ' + filters.county;
  const country = Object.keys(COUNTRIES).find(name => COUNTRIES[name] === filters.country_code);
  if (country) description += ' in ' + country.replace(/\b\w/g, c => c.toUpperCase());
  return description || filters.query || 'your search';
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
    const message = String(req.body?.original_message || req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'message required' });
    if (message.length > 500) return res.status(400).json({ error: 'Message too long' });

    const selectedSuggestion = String(req.body?.selected_suggestion || '').trim().slice(0, 40);
    const resolvedMessage = selectedSuggestion ? message.replace(/\b(?:trak|truc|truk)\b/gi, selectedSuggestion) : message;
    const filters = await interpret(resolvedMessage);
    const countryCode = req.body?.country_code;
    if (countryCode && /^[A-Z]{2}$/i.test(countryCode) && !filters.country_code) filters.country_code = countryCode.toUpperCase();
    if (filters.intent === 'greeting') return res.status(200).json({ reply: 'Hi! What are you looking for?', products: [], filters });
    if (filters.intent === 'clarify' || !filters.query) return res.status(200).json({ reply: 'What product are you looking for?', products: [], filters });

    const products = await searchProducts(filters);
    const searchDescription = describeSearch(filters);
    const reply = products.length
      ? (filters.intent === 'trending' ? 'Here are recent listings.' : 'Found ' + products.length + ': ' + searchDescription + '.')
      : 'No matches for ' + searchDescription + '.';
    return res.status(200).json({ reply: products.length ? 'Found ' + products.length + '. Take a look.' : 'No matches yet. Try changing a filter?', products, filters, summary: describeSearch(filters), result_count: products.length });
  } catch (err) {
    console.error('[asha] request failed:', {
      message: err.message, status: err.response?.status,
      detail: err.response?.data?.message || err.response?.data?.hint || err.response?.data?.details
    });
    return res.status(500).json({ error: 'Shopping search temporarily unavailable' });
  }
};

module.exports.parseIntent = parseIntent;
module.exports.detectClarification = detectClarification;
module.exports.normalizeWord = normalizeWord;
module.exports.searchGroups = searchGroups;
module.exports.validateIntent = validateIntent;
module.exports.interpret = interpret;
module.exports.searchProducts = searchProducts;
