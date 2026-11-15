/**
 * Lightweight, explainable product matching for Auto Compare.
 * Matches search terms against listing titles, descriptions and seller attributes,
 * then prefers offers from different sellers.
 */
const ALIASES: Record<string, string[]> = {
    shoe: ['shoes', 'sneaker', 'sneakers', 'trainer', 'trainers', 'footwear'],
    shoes: ['shoe', 'sneaker', 'sneakers', 'trainer', 'trainers', 'footwear'],
    sneaker: ['sneakers', 'shoe', 'shoes', 'trainer', 'trainers'],
    sneakers: ['sneaker', 'shoe', 'shoes', 'trainer', 'trainers'],
    sport: ['sports', 'athletic', 'running', 'training'],
    sports: ['sport', 'athletic', 'running', 'training'],
    trainer: ['trainers', 'sneaker', 'sneakers', 'shoe', 'shoes'],
    trainers: ['trainer', 'sneaker', 'sneakers', 'shoe', 'shoes'],
    phone: ['mobile', 'smartphone', 'handset'],
    phones: ['mobile', 'smartphones', 'handsets'],
};

export function getAutoCompareTerms(query: string): string[] {
    return [...new Set(query.toLowerCase().replace(/[^a-z0-9\\s]/g, ' ').split(/\\s+/).filter(term => term.length > 1))].slice(0, 6);
}

function searchableText(product: any): { title: string; details: string } {
    const title = String(product?.title || '').toLowerCase();
    const attributes = product?.attributes && typeof product.attributes === 'object'
        ? Object.entries(product.attributes).map(([key, value]) => `${key} ${String(value ?? '')}`).join(' ')
        : '';
    return {
        title,
        details: [product?.description, product?.category, attributes, product?.condition, product?.brand, product?.colour, product?.color]
            .filter(Boolean).join(' ').toLowerCase(),
    };
}

export function rankAutoCompareProducts(products: any[], query: string, limit = 4): any[] {
    const terms = getAutoCompareTerms(query);
    if (!terms.length) return [];

    const ranked = products.map(product => {
        const { title, details } = searchableText(product);
        const combined = `${title} ${details}`;
        let matched = 0;
        let score = 0;
        terms.forEach(term => {
            const variants = [term, ...(ALIASES[term] || [])];
            const titleHit = variants.some(value => title.includes(value));
            const detailHit = variants.some(value => details.includes(value));
            if (titleHit || detailHit) matched += 1;
            if (titleHit) score += 4;
            else if (detailHit) score += 2;
        });
        return { product, matched, score, combined };
    }).filter(item => item.matched >= Math.min(2, terms.length));

    if (!ranked.length) return [];
    ranked.sort((a, b) => b.score - a.score);

    // Keep the strongest product category so unrelated categories do not mix.
    const anchorCategory = ranked[0].product?.category;
    const sameCategory = anchorCategory
        ? ranked.filter(item => item.product?.category === anchorCategory)
        : ranked;

    // Prefer a different seller/store for each comparison column.
    const selected: any[] = [];
    const sellerIds = new Set<string>();
    for (const item of sameCategory) {
        const sellerId = String(item.product?.store_id || item.product?.user_id || item.product?.id);
        if (sellerIds.has(sellerId)) continue;
        selected.push(item.product);
        sellerIds.add(sellerId);
        if (selected.length >= limit) break;
    }

    // If the marketplace has too few sellers, fill remaining slots with the next
    // best distinct listings rather than returning an incomplete comparison.
    if (selected.length < limit) {
        for (const item of sameCategory) {
            if (selected.some(product => product.id === item.product.id)) continue;
            selected.push(item.product);
            if (selected.length >= limit) break;
        }
    }
    return selected;
}
