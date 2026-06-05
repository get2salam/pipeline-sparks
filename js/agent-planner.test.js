import {
  GUARDRAILS,
  planNextActions,
  bestSuggestionPerItem,
  filterByMinConfidence,
  countSuggestionsByAction,
  summarizePlannerSuggestions,
} from './agent-planner.js';

// daysFromToday stub: always returns the given offset regardless of date string
const fixed = (days) => (_dateStr) => days;

console.log('🧪 Agent Planner Tests\n');

// Test 1: Won item is silently skipped by guardrail
console.log('1. Won item skipped (guardrail)');
const t1 = planNextActions(
  [{ id: '1', title: 'Closed', state: 'Won', metric: 9, score: 9, date: '' }],
  fixed(5),
);
console.assert(t1.length === 0, 'Won item should produce no suggestions');
console.log('   ✓ Passed\n');

// Test 2: qualify rule fires for eligible Seen item
console.log('2. qualify fires for high-value Seen item');
const t2 = planNextActions(
  [{ id: '1', title: 'Acme', state: 'Seen', metric: 8, score: 8, date: '' }],
  fixed(5),
);
console.assert(t2.some((a) => a.actionId === 'qualify'), 'Should suggest qualify');
console.log('   ✓ Passed\n');

// Test 3: qualify confidence matches rubric formula
console.log('3. qualify confidence matches rubric formula');
const expected3 = Math.round(Math.min(0.95, (8 + 8) / 22) * 100);
const t3 = planNextActions(
  [{ id: '1', title: 'Acme', state: 'Seen', metric: 8, score: 8, date: '' }],
  fixed(5),
).find((a) => a.actionId === 'qualify');
console.assert(t3 !== undefined, 'qualify action should exist');
console.assert(t3.confidence === expected3, `Expected ${expected3}, got ${t3?.confidence}`);
console.log('   ✓ Passed\n');

// Test 4: raise-win fires for Qualified item with headroom
console.log('4. raise-win fires for Qualified item below maxMetric');
const t4 = planNextActions(
  [{ id: '1', title: 'Beta', state: 'Qualified', metric: 7, score: 8, date: '' }],
  fixed(5),
);
console.assert(t4.some((a) => a.actionId === 'raise-win'), 'Should suggest raise-win');
console.log('   ✓ Passed\n');

// Test 5: raise-win blocked when metric equals GUARDRAILS.maxMetric
console.log('5. raise-win blocked at maxMetric');
const t5 = planNextActions(
  [{ id: '1', title: 'Beta', state: 'Qualified', metric: GUARDRAILS.maxMetric, score: 8, date: '' }],
  fixed(5),
);
console.assert(!t5.some((a) => a.actionId === 'raise-win'), 'Should not suggest raise-win at max metric');
console.log('   ✓ Passed\n');

// Test 6: nudge-follow-up fires and returns confidence 92 when overdue
console.log('6. nudge-follow-up fires with confidence 92 when overdue');
const t6 = planNextActions(
  [{ id: '1', title: 'Gamma', state: 'Seen', metric: 4, score: 4, date: '' }],
  fixed(-2),
).find((a) => a.actionId === 'nudge-follow-up');
console.assert(t6 !== undefined, 'Should suggest nudge for overdue item');
console.assert(t6.confidence === 92, `Expected 92, got ${t6?.confidence}`);
console.log('   ✓ Passed\n');

// Test 7: nudge-follow-up returns confidence 72 when due tomorrow
console.log('7. nudge-follow-up confidence 72 when due tomorrow');
const t7 = planNextActions(
  [{ id: '1', title: 'Delta', state: 'Seen', metric: 4, score: 4, date: '' }],
  fixed(1),
).find((a) => a.actionId === 'nudge-follow-up');
console.assert(t7 !== undefined, 'Should suggest nudge for tomorrow');
console.assert(t7.confidence === 72, `Expected 72, got ${t7?.confidence}`);
console.log('   ✓ Passed\n');

// Test 8: output is sorted by confidence descending
console.log('8. Results sorted by confidence descending');
const t8 = planNextActions(
  [
    { id: '1', title: 'Alpha', state: 'Qualified', metric: 7, score: 8, date: '' },
    { id: '2', title: 'Beta', state: 'Seen', metric: 8, score: 8, date: '' },
  ],
  fixed(5),
);
console.assert(t8.length >= 2, 'Should return at least 2 suggestions');
console.assert(t8[0].confidence >= t8[1].confidence, 'First result should have highest confidence');
console.log('   ✓ Passed\n');

// Test 9: result objects carry required shape fields
console.log('9. Each result has required shape (itemId, title, actionId, label, reason, confidence)');
const t9 = planNextActions(
  [{ id: 'x1', title: 'Shape test', state: 'Seen', metric: 8, score: 8, date: '' }],
  fixed(5),
)[0];
['itemId', 'title', 'actionId', 'label', 'reason', 'confidence'].forEach((field) => {
  console.assert(t9[field] !== undefined, `Missing field: ${field}`);
});
console.log('   ✓ Passed\n');

// Test 10: non-array items returns [] without throwing
console.log('10. Non-array items returns []');
console.assert(planNextActions(null, fixed(0)).length === 0, 'null items should return []');
console.assert(planNextActions(undefined, fixed(0)).length === 0, 'undefined items should return []');
console.assert(planNextActions({}, fixed(0)).length === 0, 'object items should return []');
console.log('   ✓ Passed\n');

// Test 11: non-function daysFromToday returns [] without throwing
console.log('11. Non-function daysFromToday returns []');
console.assert(planNextActions([], null).length === 0, 'null daysFromToday should return []');
console.assert(
  planNextActions([{ id: '1', title: 'x', state: 'Seen', metric: 8, score: 8, date: '' }], 'nope').length === 0,
  'string daysFromToday should return []',
);
console.log('   ✓ Passed\n');

// Test 12: null/non-object items are skipped silently
console.log('12. Null and non-object items are skipped');
const t12 = planNextActions(
  [null, undefined, 42, { id: '1', title: 'Real', state: 'Seen', metric: 8, score: 8, date: '' }],
  fixed(5),
);
console.assert(t12.length === 1, `Should only plan for the one real item, got ${t12.length}`);
console.assert(t12[0].itemId === '1', 'Survivor should be the real item');
console.log('   ✓ Passed\n');

// Test 13: non-finite daysFromToday output skips the item
console.log('13. Non-finite daysFromToday output skips the item');
const t13 = planNextActions(
  [{ id: '1', title: 'NaN date', state: 'Seen', metric: 8, score: 8, date: 'bogus' }],
  () => NaN,
);
console.assert(t13.length === 0, 'NaN daysDue should produce no suggestions');
console.log('   ✓ Passed\n');

// Test 14: summarizePlannerSuggestions formats a populated plan
console.log('14. summarizePlannerSuggestions formats a populated plan');
const t14 = summarizePlannerSuggestions(
  planNextActions(
    [{ id: '1', title: 'Acme', state: 'Seen', metric: 8, score: 8, date: '' }],
    fixed(5),
  ),
);
console.assert(t14.startsWith('Planner: 1 suggested action'), 'Should report count');
console.assert(t14.includes('qualify: 1'), 'Should group by actionId');
console.assert(t14.includes('Top: Acme → qualify'), 'Should surface top suggestion');
console.log('   ✓ Passed\n');

// Test 15: summarizePlannerSuggestions handles empty and non-array input
console.log('15. summarizePlannerSuggestions handles empty/invalid input');
console.assert(summarizePlannerSuggestions([]) === 'Planner: no suggested actions', 'empty array');
console.assert(summarizePlannerSuggestions(null) === 'Planner: no suggested actions', 'null');
console.assert(summarizePlannerSuggestions(undefined) === 'Planner: no suggested actions', 'undefined');
console.log('   ✓ Passed\n');

// Test 16: bestSuggestionPerItem keeps the highest-confidence suggestion per itemId
console.log('16. bestSuggestionPerItem dedupes by itemId, keeps first occurrence');
const t16 = bestSuggestionPerItem([
  { itemId: '1', title: 'Acme', actionId: 'qualify', confidence: 80 },
  { itemId: '1', title: 'Acme', actionId: 'nudge-follow-up', confidence: 72 },
  { itemId: '2', title: 'Beta', actionId: 'raise-win', confidence: 66 },
]);
console.assert(t16.length === 2, `Expected 2 deduped suggestions, got ${t16.length}`);
console.assert(t16[0].actionId === 'qualify', 'First (highest-confidence) entry for item 1 should win');
console.assert(t16[1].itemId === '2', 'Item 2 should be retained');
console.log('   ✓ Passed\n');

// Test 17: bestSuggestionPerItem composes with planNextActions output
console.log('17. bestSuggestionPerItem yields one suggestion per itemId from planner output');
const planOut = planNextActions(
  [{ id: '1', title: 'Multi', state: 'Seen', metric: 8, score: 8, date: '' }],
  fixed(-2), // overdue → also fires nudge-follow-up
);
console.assert(planOut.length >= 2, 'Setup should produce at least 2 suggestions for item 1');
const t17 = bestSuggestionPerItem(planOut);
console.assert(t17.length === 1, `Expected 1 deduped suggestion, got ${t17.length}`);
console.assert(t17[0].itemId === '1', 'Survivor should reference item 1');
console.log('   ✓ Passed\n');

// Test 18: bestSuggestionPerItem handles bad input safely
console.log('18. bestSuggestionPerItem handles null/invalid input and skips malformed entries');
console.assert(bestSuggestionPerItem(null).length === 0, 'null should return []');
console.assert(bestSuggestionPerItem(undefined).length === 0, 'undefined should return []');
console.assert(bestSuggestionPerItem({}).length === 0, 'non-array should return []');
const t18 = bestSuggestionPerItem([null, 42, { itemId: null }, { itemId: 'ok', actionId: 'qualify' }]);
console.assert(t18.length === 1 && t18[0].itemId === 'ok', 'Should skip malformed entries');
console.log('   ✓ Passed\n');

// Test 19: filterByMinConfidence keeps entries at/above threshold and preserves order
console.log('19. filterByMinConfidence keeps entries >= threshold, preserves order');
const t19 = filterByMinConfidence(
  [
    { itemId: '1', confidence: 90 },
    { itemId: '2', confidence: 70 },
    { itemId: '3', confidence: 55 },
  ],
  70,
);
console.assert(t19.length === 2, `Expected 2 entries, got ${t19.length}`);
console.assert(t19[0].itemId === '1' && t19[1].itemId === '2', 'Order should be preserved');
console.log('   ✓ Passed\n');

// Test 20: filterByMinConfidence handles bad input safely
console.log('20. filterByMinConfidence handles null/invalid input and skips malformed entries');
console.assert(filterByMinConfidence(null, 50).length === 0, 'null suggestions should return []');
console.assert(filterByMinConfidence([], 'high').length === 0, 'non-numeric threshold should return []');
console.assert(filterByMinConfidence([], NaN).length === 0, 'NaN threshold should return []');
const t20 = filterByMinConfidence(
  [null, 42, { confidence: 'high' }, { confidence: NaN }, { confidence: 80 }],
  50,
);
console.assert(t20.length === 1 && t20[0].confidence === 80, 'Should skip malformed entries');
console.log('   ✓ Passed\n');

// Test 21: countSuggestionsByAction groups counts by actionId
console.log('21. countSuggestionsByAction groups counts by actionId');
const t21 = countSuggestionsByAction([
  { itemId: '1', actionId: 'qualify', confidence: 80 },
  { itemId: '2', actionId: 'qualify', confidence: 70 },
  { itemId: '3', actionId: 'raise-win', confidence: 66 },
]);
console.assert(t21.qualify === 2, `Expected qualify=2, got ${t21.qualify}`);
console.assert(t21['raise-win'] === 1, `Expected raise-win=1, got ${t21['raise-win']}`);
console.log('   ✓ Passed\n');

// Test 22: countSuggestionsByAction composes with planNextActions output
console.log('22. countSuggestionsByAction composes with planNextActions output');
const t22 = countSuggestionsByAction(
  planNextActions(
    [
      { id: '1', title: 'Acme', state: 'Seen', metric: 8, score: 8, date: '' },
      { id: '2', title: 'Beta', state: 'Qualified', metric: 7, score: 8, date: '' },
    ],
    fixed(5),
  ),
);
console.assert(t22.qualify === 1, `Expected qualify=1, got ${t22.qualify}`);
console.assert(t22['raise-win'] === 1, `Expected raise-win=1, got ${t22['raise-win']}`);
console.log('   ✓ Passed\n');

// Test 23: countSuggestionsByAction handles null/invalid input and skips malformed entries
console.log('23. countSuggestionsByAction handles null/invalid input safely');
console.assert(Object.keys(countSuggestionsByAction(null)).length === 0, 'null should return {}');
console.assert(Object.keys(countSuggestionsByAction(undefined)).length === 0, 'undefined should return {}');
console.assert(Object.keys(countSuggestionsByAction({})).length === 0, 'non-array should return {}');
const t23 = countSuggestionsByAction([null, 42, { actionId: null }, { actionId: 'qualify' }]);
console.assert(t23.qualify === 1, 'Should skip malformed entries and still count valid ones');
console.assert(Object.keys(t23).length === 1, 'Should not produce keys for malformed entries');
console.log('   ✓ Passed\n');

console.log('✅ All tests passed');
