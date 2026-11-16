const test = require('node:test');
const assert = require('node:assert/strict');
const asha = require('../asha/core');
const marketplaceAdapter = require('./assistant');
const discovery = require('../asha/discovery');

test('ambiguous trak spelling returns compact vehicle suggestions', () => {
  const result = asha.detectClarification('I need a 2012 trak');
  assert.equal(result.intent, 'clarify');
  assert.deepEqual(result.suggestions.map(item => item.label), ['Truck', 'Bus', 'Car', 'Tractor']);
});

test('single vehicle year is preserved as an exact year filter', () => {
  const result = asha.parseIntent('2012 truck');
  assert.equal(result.query, 'truck');
  assert.equal(result.year_from, 2012);
  assert.equal(result.year_to, 2012);
});

test('year ranges remain ranges', () => {
  const result = asha.parseIntent('white sedans between 2012 and 2014');
  assert.equal(result.year_from, 2012);
  assert.equal(result.year_to, 2014);
  assert.equal(result.attributes.color, 'white');
});

test('car search expands to vehicle body-type taxonomy terms', () => {
  const [group] = asha.searchGroups('cars');
  for (const term of ['sedan', 'suv', 'hatchback', 'station wagon']) {
    assert.ok(group.includes(term), 'expected car synonyms to include ' + term);
  }
});

test('singular and plural product words normalize consistently', () => {
  assert.equal(asha.normalizeWord('cars'), 'car');
  assert.equal(asha.normalizeWord('shirts'), 'shirt');
});

test('marketplace API keeps the shared Asha engine exports available', () => {
  assert.equal(marketplaceAdapter.parseIntent, asha.parseIntent);
  assert.equal(marketplaceAdapter.interpret, asha.interpret);
});

test('e-commerce vocabulary resolves common aliases across categories', () => {
  const cases = [
    ['fridge', 'refrigerator'], ['mobile', 'phone'], ['cellphone', 'phone'],
    ['couch', 'sofa'], ['pants', 'trouser'], ['trainers', 'shoe'],
    ['matatu', 'bus'], ['boda boda', 'motorcycle'], ['tv', 'television'],
    ['sneekers', 'shoe'], ['labtop', 'laptop']
  ];
  for (const [input, expected] of cases) {
    const groups = asha.searchGroups(input);
    assert.ok(groups.some(group => group.includes(expected)), input + ' should resolve to ' + expected);
  }
});

test('common product misspellings normalize before search', () => {
  assert.equal(asha.normalizeWord('refridgerator'), 'refrigerator');
  assert.equal(asha.normalizeWord('celphone'), 'phone');
  assert.equal(asha.normalizeWord('labtop'), 'laptop');
});

test('shopping request wording is removed without losing the product', () => {
  const result = asha.parseIntent('Please show me some used laptops');
  assert.equal(result.query, 'laptop');
});

test('shared vocabulary covers major everyday shopping departments', () => {
  const cases = [
    ['sedans', 'car'], ['lorry', 'truck'], ['matatu', 'bus'], ['boda boda', 'motorcycle'],
    ['smartphone', 'phone'], ['desktop', 'computer'], ['smart tv', 'television'],
    ['deep freezer', 'refrigerator'], ['trainers', 'shoe'], ['gown', 'dress'],
    ['jeans', 'trouser'], ['rucksack', 'backpack'], ['bunk bed', 'bed'],
    ['couch', 'sofa'], ['desk', 'table'], ['jewelry', 'jewellery'],
    ['makeup', 'cosmetic'], ['sound system', 'speaker'], ['power tools', 'tool'],
    ['cement bags', 'cement'], ['groceries', 'food']
  ];
  for (const [input, expected] of cases) {
    const groups = asha.searchGroups(input);
    assert.ok(groups.some(group => group.includes(expected)), input + ' should resolve to ' + expected);
  }
});

test('multi-word aliases are matched as a single product concept', () => {
  for (const [input, expected] of [['boda boda', 'motorcycle'], ['school bag', 'backpack'], ['beauty products', 'cosmetic'], ['station wagon', 'car']]) {
    const groups = asha.searchGroups(input);
    assert.equal(groups.length, 1, input + ' should be treated as one phrase');
    assert.ok(groups[0].includes(expected));
  }
});

test('live taxonomy maps broad car and hair language to marketplace departments', () => {
  const index = discovery.buildTaxonomyIndex([
    { id: 'auto', label: 'Automotive & Transport', node_kind: 'main_category', parent_id: null },
    { id: 'auto-services', label: 'Automotive services', node_kind: 'subcategory', parent_id: 'auto' },
    { id: 'car-hire', label: 'Car Hire', node_kind: 'product_type', parent_id: 'auto-services' },
    { id: 'car-care', label: 'Car Care Products', node_kind: 'product_type', parent_id: 'beauty-products' },
    { id: 'beauty', label: 'Beauty & Personal Care', node_kind: 'main_category', parent_id: null },
    { id: 'beauty-products', label: 'Beauty products', node_kind: 'subcategory', parent_id: 'beauty' },
    { id: 'personal-care', label: 'Personal Care', node_kind: 'subcategory', parent_id: 'beauty' },
    { id: 'haircare', label: 'Haircare', node_kind: 'product_type', parent_id: 'beauty-products' },
    { id: 'hairdressing', label: 'Hairdressing', node_kind: 'product_type', parent_id: 'beauty-products' }
  ], []);
  assert.equal(discovery.inferMainCategory('car', index).id, 'auto');
  assert.equal(discovery.inferMainCategory('car', index).id, 'auto');
  assert.equal(discovery.inferMainCategory('cars', index).id, 'auto');
  assert.equal(discovery.inferMainCategory('hair', index).id, 'beauty');
  assert.equal(discovery.inferMainCategory('cars', index).id, 'auto');
});

test('broad department discovery expands to its live product types', () => {
  const index = discovery.buildTaxonomyIndex([
    { id: 'auto', label: 'Automotive & Transport', node_kind: 'main_category', parent_id: null },
    { id: 'vehicles', label: 'Passenger vehicles', node_kind: 'subcategory', parent_id: 'auto' },
    { id: 'sedan', label: 'Sedan', node_kind: 'product_type', parent_id: 'vehicles' },
    { id: 'suv', label: 'SUV', node_kind: 'product_type', parent_id: 'vehicles' }
  ], []);
  assert.deepEqual(discovery.descendantIds('auto', index).sort(), ['auto', 'sedan', 'suv', 'vehicles']);
  assert.equal(discovery.hasExactProductType('sedan', index), true);
  assert.equal(discovery.hasExactProductType('car', index), false);
});

test('related alternatives are generated from actual published listing taxonomy ids', () => {
  const index = discovery.buildTaxonomyIndex([
    { id: 'auto', label: 'Automotive & Transport', node_kind: 'main_category', parent_id: null },
    { id: 'sedan', label: 'Sedan', node_kind: 'product_type', parent_id: 'auto' },
    { id: 'vehicle-repair', label: 'Vehicle Repair', node_kind: 'product_type', parent_id: 'auto' }
  ], []);
  const suggestions = discovery.buildRelatedSuggestions([
    { taxonomy_node_id: 'sedan', listing_kind: 'physical_product' },
    { taxonomy_node_id: 'vehicle-repair', listing_kind: 'service' },
    { taxonomy_node_id: 'vehicle-repair', listing_kind: 'service' }
  ], index, 'car');
  assert.deepEqual(suggestions.map(item => item.label), ['Vehicle Repair', 'Sedan']);
  assert.equal(suggestions[0].description, '2 listings');
});

test('intent validation distinguishes service requests from physical products', () => {
  const fallback = asha.parseIntent('find a chef');
  const service = asha.validateIntent({ intent: 'search', query: 'chef', listing_kind: 'service', category: 'Food & Groceries', subcategory: 'Food services' }, fallback);
  assert.equal(service.listing_kind, 'service');
  assert.equal(service.subcategory, 'Food services');
  const invalid = asha.validateIntent({ intent: 'search', query: 'chef', listing_kind: 'people_stock' }, fallback);
  assert.equal(invalid.listing_kind, undefined);
});
