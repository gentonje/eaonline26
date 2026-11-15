const test = require('node:test');
const assert = require('node:assert/strict');
const asha = require('../asha/core');
const marketplaceAdapter = require('./assistant');

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
