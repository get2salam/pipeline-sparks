import { AGENT_AUDIT_CHECKLIST, validateAgentAction, auditAgentExecution } from './agent-audit.js';

// Test data
const validAction = {
  itemId: 'opp-1',
  title: 'Acme deal',
  actionId: 'qualify',
  confidence: 85,
  reason: 'Value 8/10, win chance 8/10 — strong enough to qualify.',
};

const validItem = {
  id: 'opp-1',
  title: 'Acme deal',
  state: 'Seen',
  metric: 8,
  score: 8,
};

const wonItem = {
  id: 'opp-2',
  title: 'Won deal',
  state: 'Won',
};

// Test cases
console.log('🧪 Agent Audit Tests\n');

// Test 1: Valid action passes
console.log('1. Valid action passes audit');
const test1 = validateAgentAction(validAction);
console.assert(test1.valid, 'Should be valid');
console.assert(test1.issues.length === 0, 'Should have no issues');
console.log('   ✓ Passed\n');

// Test 2: Invalid actionId fails
console.log('2. Invalid actionId fails');
const test2 = validateAgentAction({ ...validAction, actionId: 'invalid-action' });
console.assert(!test2.valid, 'Should be invalid');
console.assert(test2.issues.some(i => i.includes('actionId')), 'Should flag actionId issue');
console.log('   ✓ Passed\n');

// Test 3: Confidence out of bounds fails
console.log('3. Confidence out of bounds fails');
const test3 = validateAgentAction({ ...validAction, confidence: 150 });
console.assert(!test3.valid, 'Should be invalid');
console.assert(test3.issues.some(i => i.includes('Confidence')), 'Should flag confidence issue');
console.log('   ✓ Passed\n');

// Test 4: Missing itemId fails
console.log('4. Missing itemId fails');
const test4 = validateAgentAction({ ...validAction, itemId: null });
console.assert(!test4.valid, 'Should be invalid');
console.assert(test4.issues.some(i => i.includes('itemRef')), 'Should flag item reference issue');
console.log('   ✓ Passed\n');

// Test 5: State consistency check
console.log('5. State consistency enforced');
const test5 = validateAgentAction(
  { ...validAction, actionId: 'raise-win', title: 'Wrong state test' },
  validItem // 'Seen' state, but raise-win requires 'Qualified'
);
console.assert(!test5.valid, 'Should be invalid');
console.assert(test5.issues.some(i => i.includes('state')), 'Should flag state issue');
console.log('   ✓ Passed\n');

// Test 6: Blocked state enforcement
console.log('6. Blocked state (Won) enforcement');
const test6 = validateAgentAction(validAction, wonItem);
console.assert(!test6.valid, 'Should be invalid');
console.assert(test6.issues.some(i => i.includes('Won')), 'Should flag blocked state');
console.log('   ✓ Passed\n');

// Test 7: Batch audit with duplicates
console.log('7. Batch audit detects duplicates');
const test7 = auditAgentExecution([validAction, validAction]);
console.assert(!test7.valid, 'Should be invalid');
console.assert(test7.batchIssues.some(i => i.includes('Duplicate')), 'Should flag duplicate');
console.log('   ✓ Passed\n');

// Test 8: Batch audit with low confidence warning
console.log('8. Batch audit detects low confidence');
const lowConfActions = [
  { ...validAction, itemId: 'opp-1', confidence: 20 },
  { ...validAction, itemId: 'opp-2', actionId: 'nudge-follow-up', confidence: 25 },
];
const test8 = auditAgentExecution(lowConfActions);
console.assert(test8.batchIssues.some(i => i.includes('Low average confidence')), 'Should warn on low confidence');
console.log('   ✓ Passed\n');

// Test 9: Full batch audit passes with valid data
console.log('9. Full batch audit with valid data');
const test9 = auditAgentExecution(
  [
    { ...validAction, itemId: 'opp-1' },
    { ...validAction, itemId: 'opp-2', actionId: 'raise-win', title: 'Qualified opp' },
  ],
  [
    { id: 'opp-1', title: 'Acme', state: 'Seen', metric: 8, score: 8 },
    { id: 'opp-2', title: 'Qualified opp', state: 'Qualified', metric: 7, score: 8 },
  ]
);
console.assert(test9.valid, 'Should be valid');
console.assert(test9.actionResults.length === 2, 'Should validate 2 actions');
console.log('   ✓ Passed\n');

// Test 10: validateAgentAction guards against null/undefined input
console.log('10. validateAgentAction handles null input without throwing');
const test10a = validateAgentAction(null);
const test10b = validateAgentAction(undefined);
console.assert(!test10a.valid && test10a.issues.length > 0, 'null action should be invalid');
console.assert(!test10b.valid && test10b.issues.length > 0, 'undefined action should be invalid');
console.log('   ✓ Passed\n');

// Test 11: auditAgentExecution rejects non-array actions safely
console.log('11. auditAgentExecution rejects non-array actions');
const test11 = auditAgentExecution(null);
console.assert(!test11.valid, 'Should be invalid');
console.assert(test11.batchIssues.some((i) => i.includes('array')), 'Should flag non-array input');
console.log('   ✓ Passed\n');

// Test 12: auditAgentExecution skips null entries without throwing
console.log('12. auditAgentExecution tolerates null action entries');
const test12 = auditAgentExecution([null, validAction]);
console.assert(test12.actionResults.length === 2, 'Should record a result for each entry');
console.assert(test12.actionResults[0].valid === false, 'null entry should be marked invalid');
console.assert(test12.actionResults[1].valid === true, 'Valid entry should still pass');
console.log('   ✓ Passed\n');

console.log('✅ All tests passed');
