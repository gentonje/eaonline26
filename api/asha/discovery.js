// Database-driven taxonomy discovery helpers for Asha.
// No product vocabulary is hardcoded here: labels and aliases come from the marketplace taxonomy.
function normalizeTerm(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\\s+/g, ' ');
}

function tokens(value) {
  return normalizeTerm(value).split(' ').filter(token => token.length >= 3);
}

function buildTaxonomyIndex(nodes, aliases) {
  const byId = new Map();
  const children = new Map();
  const terms = new Map();
  const addTerm = (term, nodeId) => {
    const key = normalizeTerm(term);
    if (!key || !byId.has(String(nodeId))) return;
    if (!terms.has(key)) terms.set(key, new Set());
    terms.get(key).add(String(nodeId));
  };
  for (const raw of Array.isArray(nodes) ? nodes : []) {
    const node = { ...raw, id: String(raw.id), parent_id: raw.parent_id ? String(raw.parent_id) : null };
    byId.set(node.id, node);
    if (node.parent_id) {
      if (!children.has(node.parent_id)) children.set(node.parent_id, []);
      children.get(node.parent_id).push(node.id);
    }
  }
  for (const node of byId.values()) addTerm(node.label, node.id);
  for (const alias of Array.isArray(aliases) ? aliases : []) addTerm(alias.normalized_term, alias.node_id);
  return { byId, children, terms };
}

function getMainCategory(nodeId, index) {
  let node = index.byId.get(String(nodeId));
  let guard = 0;
  while (node && node.parent_id && guard++ < 20) node = index.byId.get(node.parent_id);
  return node && node.node_kind === 'main_category' ? node : null;
}

function inferMainCategory(query, index) {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return null;
  const scores = new Map();
  for (const [term, ids] of index.terms.entries()) {
    const termTokens = tokens(term);
    let score = 0;
    for (const q of queryTokens) {
      for (const t of termTokens) {
        if (q === t) score = Math.max(score, 3);
        else if (q.length >= 3 && (t.startsWith(q) || q.startsWith(t))) score = Math.max(score, 2);
      }
    }
    if (!score) continue;
    for (const id of ids) {
      const category = getMainCategory(id, index);
      if (category) scores.set(category.id, (scores.get(category.id) || 0) + score);
    }
  }
  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || (ranked.length > 1 && ranked[0][1] < ranked[1][1] * 1.15)) return null;
  return index.byId.get(ranked[0][0]) || null;
}

function descendantIds(nodeId, index) {
  const found = new Set();
  const visit = id => {
    if (found.has(id)) return;
    found.add(id);
    for (const child of index.children.get(id) || []) visit(child);
  };
  if (index.byId.has(String(nodeId))) visit(String(nodeId));
  return Array.from(found);
}

function hasExactProductType(query, index) {
  const ids = index.terms.get(normalizeTerm(query));
  if (!ids) return false;
  return Array.from(ids).some(id => index.byId.get(id)?.node_kind === 'product_type');
}

function buildRelatedSuggestions(listings, index, query, limit = 4) {
  const counts = new Map();
  for (const row of Array.isArray(listings) ? listings : []) {
    const id = String(row.taxonomy_node_id || '');
    if (!id || !index.byId.has(id)) continue;
    const node = index.byId.get(id);
    if (node.node_kind !== 'product_type') continue;
    const current = counts.get(id) || { count: 0, listingKinds: new Set() };
    current.count += 1;
    if (row.listing_kind) current.listingKinds.add(row.listing_kind);
    counts.set(id, current);
  }
  const queryKey = normalizeTerm(query);
  return Array.from(counts.entries())
    .filter(([id]) => normalizeTerm(index.byId.get(id).label) !== queryKey)
    .sort((a, b) => b[1].count - a[1].count || index.byId.get(a[0]).label.localeCompare(index.byId.get(b[0]).label))
    .slice(0, limit)
    .map(([id, data]) => ({
      label: index.byId.get(id).label,
      value: index.byId.get(id).label,
      description: data.count + (data.count === 1 ? ' listing' : ' listings')
    }));
}

module.exports = {
  normalizeTerm,
  buildTaxonomyIndex,
  inferMainCategory,
  descendantIds,
  hasExactProductType,
  buildRelatedSuggestions
};
