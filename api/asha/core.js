// Asha's database-independent conversation and intent engine.
// This module interprets shopper language; adapters execute approved business searches.
const axios = require('axios');

const ALLOWED_ATTRIBUTES = new Set(['color', 'colour', 'size', 'brand', 'model', 'storage', 'condition', 'gender', 'material']);
const COUNTRIES = { kenya: 'KE', uganda: 'UG', tanzania: 'TZ', ethiopia: 'ET', rwanda: 'RW', 'south sudan': 'SS', sudan: 'SD' };
const GREETINGS = /^(hi|hello|hey|hiya|good morning|good afternoon|good evening|how are you)[!.?,\s]*$/i;
const NOISE = /^[a-z0-9]{1,2}[!.?,\s]*$/i;
const WORD_FIXES = {
  redd: 'red', reeed: 'red', blu: 'blue', blak: 'black', whte: 'white', wite: 'white', yelow: 'yellow', greay: 'grey',
  colur: 'color', colour: 'color', tshirt: 'shirt', tshirts: 'shirt', tee shirt: 'shirt',
  motercycle: 'motorcycle', motocycle: 'motorcycle', motorbike: 'motorcycle',
  refridgerator: 'refrigerator', refrigirator: 'refrigerator', refri: 'refrigerator',
  celphone: 'phone', cellphone: 'phone', handphone: 'phone', mobil: 'mobile',
  lapto: 'laptop', labtop: 'laptop', computor: 'computer', televsion: 'television',
  furnitures: 'furniture', matress: 'mattress', matresses: 'mattress',
  sneekers: 'sneakers', snickers: 'sneakers', trouser: 'trousers',
  sunglass: 'sunglasses', sunshade: 'sunglasses', jewellry: 'jewellery',
  accesory: 'accessory', accesories: 'accessories', accesories: 'accessories',
  bagpack: 'backpack', backpak: 'backpack', lory: 'lorry', trak: 'truck', truc: 'truck', truk: 'truck'
};
const COLOR_WORDS = { white: ['white','whte','wite'], black: ['black','blak','blk'], red: ['red','redd','reeed'], blue: ['blue','blu'], green: ['green'], yellow: ['yellow','yelow'], brown: ['brown'], pink: ['pink'], grey: ['grey','gray','greay'], orange: ['orange'], purple: ['purple'] };
// Canonical shopping vocabulary. Keep this broad and additive; live taxonomy aliases
// provide the marketplace-specific extension without changing the interpreter.
const SEARCH_SYNONYMS = {
  car: ['car','cars','automobile','automobiles','motor vehicle','sedan','sedans','saloon','suv','suvs','hatchback','hatchbacks','station wagon','estate car','coupe','convertible','pickup','pickups'],
  truck: ['truck','trucks','lorry','lorries','cargo truck','tipper truck','dump truck','refrigerated truck','tractor unit'],
  bus: ['bus','buses','coach','minibus','matatu','shuttle'],
  tractor: ['tractor','tractors','farm tractor'],
  motorcycle: ['motorcycle','motorcycles','motorbike','motorbikes','boda boda','scooter'],
  bicycle: ['bicycle','bicycles','bike','bikes','mountain bike'],
  phone: ['phone','phones','mobile','mobiles','smartphone','smartphones','cellphone','cell phone','handset'],
  laptop: ['laptop','laptops','notebook','notebooks'],
  computer: ['computer','computers','desktop','desktops','pc'],
  television: ['television','televisions','tv','tvs','smart tv'],
  refrigerator: ['refrigerator','fridge','freezer','deep freezer'],
  shirt: ['shirt','shirts','t-shirt','t-shirts','tee','tees','polo shirt'],
  shoe: ['shoe','shoes','footwear','sneaker','sneakers','trainer','trainers','boots','sandals','heels','flats'],
  dress: ['dress','dresses','gown','gowns'],
  trouser: ['trouser','trousers','pants','jeans','slacks'],
  skirt: ['skirt','skirts'],
  jacket: ['jacket','jackets','coat','coats'],
  bag: ['bag','bags','handbag','handbags','purse','purses'],
  backpack: ['backpack','backpacks','rucksack','school bag'],
  bed: ['bed','beds','bunk bed','bunk beds'],
  mattress: ['mattress','mattresses'],
  sofa: ['sofa','sofas','couch','couches','settee'],
  chair: ['chair','chairs','stool','stools'],
  table: ['table','tables','desk','desks'],
  furniture: ['furniture','furnishing'],
  watch: ['watch','watches','wristwatch','wristwatches'],
  jewellery: ['jewellery','jewelry','necklace','necklaces','bracelet','bracelets','earring','earrings','ring','rings'],
  cosmetic: ['cosmetic','cosmetics','makeup','make-up','beauty products','skincare','skin care'],
  appliance: ['appliance','appliances','home appliance','kitchen appliance'],
  camera: ['camera','cameras','photography camera'],
  speaker: ['speaker','speakers','loudspeaker','sound system'],
  tool: ['tool','tools','power tool','power tools'],
  cement: ['cement','cement bags'],
  food: ['food','groceries','grocery','foodstuff','foodstuffs']
};
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
  if (/\b(?:trak|truc|truk)\b/.test(text) && !/\b(?:truck|lorry)\b/.test(text)) {
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
  // A single four-digit year in a vehicle search means that exact model year.
  const singleYear = lower.match(/\b(?:19|20)\d{2}\b/);
  if (singleYear && out.year_from === undefined) {
    out.year_from = Number(singleYear[0]);
    out.year_to = Number(singleYear[0]);
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
    .replace(/\b(?:price\s+range\s*)?(?:between|from)?\s*[\d,]+\s*(?:and|to|-)\s*[\d,]+\s*(?:usd|kes|ksh|ugx|tzs|ssp|rwf|etb)?\b/g, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b(?:usd|kes|ksh|ugx|tzs|ssp|rwf|etb)\b/g, ' ')
    .replace(/\b(?:price\s+range\s*)?(?:between|from)?\s*[\d,]+\s*(?:and|to|-)\s*[\d,]+\s*(?:usd|kes|ksh|ugx|tzs|ssp|rwf|etb)?\b/g, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\b(?:usd|kes|ksh|ugx|tzs|ssp|rwf|etb)\b/g, ' ')
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
  const clarification = detectClarification(message);
  if (clarification) return clarification;
  const fallback = parseIntent(message);
  if (fallback.intent === 'greeting' || fallback.intent === 'clarify') return fallback;
  const prompt = [
    'You interpret natural-language shopping requests for an East African marketplace.',
    'Return one compact JSON object. Extract product type as query; colour, size, brand, model, condition, price bounds, country and county as filters.',
    'Be a forgiving shopping interpreter, not an exact-keyword matcher. Keep shopper-facing language warm, natural and extremely brief; avoid bot-like explanations and unnecessary acknowledgements. Correct likely typos (redd=red, whte=white), normalize singular/plural (bed/beds, shirt/shirts, car/cars, truck/trucks), understand everyday descriptions and broad requests. "show me some cars" means search the car category even without a make/model. Use broad e-commerce vocabulary across vehicles, electronics, phones, computers, appliances, clothing, footwear, furniture, home goods, beauty, jewellery, groceries, tools, building materials and services. Understand regional East African terms (matatu, boda boda, mobile money, shamba, etc.) when relevant. Map common synonyms (lorry=truck, matatu=bus, motorbike=bicycle/motorcycle according to context, mobile=phone, fridge=refrigerator, TV=television, couch=sofa, pants=trousers, tee=t-shirt, trainers=sneakers). Understand common misspellings and phonetic spellings; preserve the intended product category. Map sports shoes to Sports Shoes. Return the broad product type when no model is given; never demand an exact model. Do not invent filters or products.',
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

module.exports = {
  ALLOWED_ATTRIBUTES,
  COUNTRIES,
  normalizeWord,
  searchGroups,
  detectClarification,
  parseIntent,
  validateIntent,
  interpret
};
