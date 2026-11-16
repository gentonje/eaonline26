const axios = require('axios');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const {
  ALLOWED_ATTRIBUTES,
  COUNTRIES,
  normalizeWord,
  searchGroups,
  detectClarification,
  parseIntent,
  validateIntent,
  interpret
} = require('../asha/core');
const {
  buildTaxonomyIndex, inferMainCategory, descendantIds,
  hasExactProductType, buildRelatedSuggestions, normalizeTerm
} = require('../asha/discovery');

async function publicQuery(path) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase public credentials are missing');
  const r = await axios.get(SUPABASE_URL + '/rest/v1/' + path, {
    headers: { apikey: SUPABASE_KEY }, timeout: 10000
  });
  return r.data;
}

let taxonomyIndexCache = { expiresAt: 0, index: null };

async function getTaxonomyIndex() {
  if (!taxonomyIndexCache.expiresAt || taxonomyIndexCache.expiresAt <= Date.now()) {
    const [nodes, aliases] = await Promise.all([
      publicQuery('marketplace_taxonomy_nodes?is_active=eq.true&select=id,label,node_kind,parent_id&limit=2000'),
      publicQuery('marketplace_taxonomy_aliases?select=normalized_term,node_id&limit=2000')
    ]);
    taxonomyIndexCache = {
      expiresAt: Date.now() + 5 * 60 * 1000,
      index: buildTaxonomyIndex(nodes, aliases)
    };
  }
  return taxonomyIndexCache.index;
}

async function getTaxonomyContext() {
  const index = await getTaxonomyIndex();
  const nodes = Array.from(index.byId.values());
  return {
    categories: nodes.filter(node => node.node_kind === 'main_category')
      .map(node => ({ id: node.id, label: node.label })),
    subcategories: nodes.filter(node => node.node_kind === 'subcategory')
      .map(node => ({ id: node.id, label: node.label, parent_id: node.parent_id }))
  };
}

async function getTaxonomyIds(terms) {
  const index = await getTaxonomyIndex();
  const ids = new Set();
  for (const term of terms || []) {
    const matches = index.terms.get(normalizeTerm(term));
    if (!matches) continue;
    for (const id of matches) {
      if (index.byId.get(id)?.node_kind === 'product_type') ids.add(id);
    }
  }
  return Array.from(ids);
}

async function getTaxonomyCategoryIds(category, subcategory) {
  if (!category && !subcategory) return [];
  const index = await getTaxonomyIndex();
  const nodes = Array.from(index.byId.values());
  const subcategoryKey = normalizeTerm(subcategory);
  let node = subcategory
    ? nodes.find(item => item.node_kind === 'subcategory' && normalizeTerm(item.label) === subcategoryKey)
    : null;
  if (!node && category) {
    const categoryKey = normalizeTerm(category);
    node = nodes.find(item => item.node_kind === 'main_category' && normalizeTerm(item.label) === categoryKey);
  }
  if (!node) return [];
  return descendantIds(node.id, index).filter(id => index.byId.get(id)?.node_kind === 'product_type');
}

async function getRelatedListingSuggestions(filters, query) {
  if (!filters.category && !filters.subcategory) return [];
  const ids = await getTaxonomyCategoryIds(filters.category, filters.subcategory);
  if (!ids.length) return [];
  const listingKindFilter = filters.listing_kind ? '&listing_kind=eq.' + encodeURIComponent(filters.listing_kind) : '';
  const rows = await publicQuery('products?product_status=eq.published' + listingKindFilter + '&taxonomy_node_id=in.(' +
    ids.map(id => encodeURIComponent(id)).join(',') +
    ')&select=taxonomy_node_id,listing_kind&limit=500');
  const index = await getTaxonomyIndex();
  return buildRelatedSuggestions(rows, index, query, 4);
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
  if (filters.category || filters.subcategory) {
    const categoryText = String(filters.subcategory || filters.category).replace(/[*%,()]/g, '').trim();
    const taxonomyIds = await getTaxonomyCategoryIds(filters.category, filters.subcategory);
    const categoryAlternatives = filters.subcategory ? [] : ["category.ilike.*" + categoryText + "*"];
    if (taxonomyIds.length) categoryAlternatives.push('taxonomy_node_id.in.(' + taxonomyIds.join(',') + ')');
    if (!categoryAlternatives.length) categoryAlternatives.push("category.ilike.*" + categoryText + "*");
    conditions.push('or(' + categoryAlternatives.join(',') + ')');
  }
  if (filters.year_from !== undefined) conditions.push('attributes->>year.gte.' + filters.year_from);
  if (filters.year_to !== undefined) conditions.push('attributes->>year.lte.' + filters.year_to);

  if (filters.country_code) {
    const countries = await publicQuery('countries?code=eq.' + encodeURIComponent(filters.country_code) + '&select=id&limit=1');
    if (countries?.[0]?.id) params.set('country_id', 'eq.' + countries[0].id);
    else throw new Error('Country code is not configured: ' + filters.country_code);
  }
  if (filters.intent === 'new') params.set('created_at', 'gte.' + new Date(Date.now() - 7 * 86400000).toISOString());
  if (filters.listing_kind) params.set('listing_kind', 'eq.' + filters.listing_kind);

  const query = String(filters.query || '').trim().replace(/[*%,]/g, ' ').slice(0, 80);
  if (query && !filters.category_browse) {
    for (const group of searchGroups(query).slice(0, 5)) {
      const taxonomyIds = await getTaxonomyIds(group);
      const alternatives = group.flatMap(term => {
        const safe = String(term).replace(/[^a-z0-9 ]/g, ' ').trim().replace(/\s+/g, ' ');
        // Word-based search avoids substring collisions such as "car" in "skin care".
        return [
          'title.fts(english).' + safe,
          'category.fts(english).' + safe,
          'description.fts(english).' + safe
        ];
      });
      if (taxonomyIds.length) alternatives.push('taxonomy_node_id.in.(' + taxonomyIds.join(',') + ')');
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
    const resolvedMessage = selectedSuggestion
      ? (/\b(?:trak|truc|truk)\b/i.test(message)
        ? message.replace(/\b(?:trak|truc|truk)\b/gi, selectedSuggestion)
        : message + ' ' + selectedSuggestion)
      : message;
    const conversationMessages = Array.isArray(req.body?.messages)
      ? req.body.messages
        .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
        .slice(-10)
        .map(item => ({ role: item.role, content: item.content.slice(0, 500) }))
      : [];
    const taxonomyIndex = await getTaxonomyIndex();
    const taxonomyContext = await getTaxonomyContext();
    const filters = await interpret(resolvedMessage, { ...taxonomyContext, messages: conversationMessages });
    const countryCode = req.body?.country_code;
    if (countryCode && /^[A-Z]{2}$/i.test(countryCode) && !filters.country_code) filters.country_code = countryCode.toUpperCase();
    if (filters.intent === 'greeting') return res.status(200).json({ reply: 'Hi! What are you looking for?', products: [], filters });

    // Prefer a valid live department returned by the model; otherwise infer one from
    // matching taxonomy labels and aliases already stored in the marketplace database.
    const requestedCategory = String(filters.category || '').trim();
    const liveCategories = taxonomyContext.categories.filter(item => normalizeTerm(item.label) === normalizeTerm(requestedCategory));
    if (requestedCategory && liveCategories.length) filters.category = liveCategories[0].label;
    else if (requestedCategory) delete filters.category;
    const requestedSubcategory = String(filters.subcategory || '').trim();
    const liveSubcategories = taxonomyContext.subcategories.filter(item => normalizeTerm(item.label) === normalizeTerm(requestedSubcategory));
    if (requestedSubcategory && liveSubcategories.length) filters.subcategory = liveSubcategories[0].label;
    else if (requestedSubcategory) delete filters.subcategory;
    if (filters.subcategory) {
      const parentCategory = inferMainCategory(filters.subcategory, taxonomyIndex);
      if (parentCategory) filters.category = parentCategory.label;
    }
    if (!filters.category) {
      const inferred = inferMainCategory(filters.query || resolvedMessage, taxonomyIndex);
      if (inferred) filters.category = inferred.label;
    }

    if (filters.intent === 'clarify' || !filters.query) {
      const suggestions = Array.isArray(filters.suggestions) ? filters.suggestions : [];
      return res.status(200).json({
        reply: suggestions.length ? 'Did you mean one of these?' : 'What would you like to find? You can describe it in your own words.',
        products: [], filters, suggestions
      });
    }

    const itemName = String(filters.query || filters.category || 'that item').trim();
    // Broad concepts without an exact product-type match browse the relevant live
    // department instead of failing because the exact word is absent from listings.
    filters.category_browse = Boolean((filters.subcategory || filters.category) && !hasExactProductType(filters.query, taxonomyIndex));
    let products = await searchProducts(filters);
    let broadenedToDepartment = filters.category_browse;
    let resultScope = filters.subcategory || filters.category;
    let suggestions = (filters.category || filters.subcategory) ? await getRelatedListingSuggestions(filters, itemName) : [];

    // If the closest subdepartment has no listings, broaden one level to its
    // parent department. If an exact product search fails, first browse its
    // selected subdepartment. Every fallback remains grounded in published listings.
    if (!products.length && filters.subcategory && filters.category) {
      const broader = { ...filters, subcategory: undefined, query: '', category_browse: true, limit: 6 };
      const relatedProducts = await searchProducts(broader);
      if (relatedProducts.length) {
        products = relatedProducts;
        broadenedToDepartment = true;
        resultScope = filters.category;
        suggestions = await getRelatedListingSuggestions(broader, itemName);
      }
    } else if (!products.length && filters.category && !filters.category_browse) {
      const broader = { ...filters, query: '', category_browse: true, limit: 6 };
      const relatedProducts = await searchProducts(broader);
      if (relatedProducts.length) {
        products = relatedProducts;
        broadenedToDepartment = true;
        suggestions = await getRelatedListingSuggestions(filters, itemName);
      }
    }

    let reply;
    if (products.length && broadenedToDepartment) {
      reply = 'I couldn’t find ' + itemName + ' exactly, but here are some related options from ' + resultScope + '. Would you like to explore one?';
    } else if (products.length) {
      reply = filters.intent === 'trending'
        ? 'Here are some popular listings.'
        : 'Here are ' + products.length + ' ' + (products.length === 1 ? 'option' : 'options') + ' for ' + itemName + '.';
    } else if (suggestions.length) {
      reply = 'I couldn’t find ' + itemName + ' listed at the moment. Would you like to explore one of these related options?';
    } else {
      reply = 'I couldn’t find ' + itemName + ' listed at the moment. Could you describe what you need another way?';
    }
    return res.status(200).json({
      reply, products, filters, suggestions,
      summary: products.length ? describeSearch(filters) : null,
      result_count: products.length
    });
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
