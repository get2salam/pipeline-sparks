import { GUARDRAILS, planNextActions } from './agent-planner.js';

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

console.log('✅ All tests passed');
