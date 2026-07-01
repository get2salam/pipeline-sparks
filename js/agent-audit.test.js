import {
  AGENT_AUDIT_CHECKLIST,
  AUDIT_THRESHOLDS,
  validateAgentAction,
  auditAgentExecution,
  getFailedAuditResults,
  getPassingAuditResults,
  summarizeAuditResult,
} from './agent-audit.js';

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

// Test 13: confidence must be a real number — coerced values are rejected
console.log('13. Confidence rejects non-numeric values (null, boolean, string)');
for (const bad of [null, true, false, '50', NaN, Infinity]) {
  const result = validateAgentAction({ ...validAction, confidence: bad });
  console.assert(!result.valid, `confidence=${String(bad)} should be invalid`);
  console.assert(
    result.issues.some((i) => i.includes('confidence')),
    `confidence=${String(bad)} should flag confidence issue`,
  );
}
console.log('   ✓ Passed\n');

// Test 14: summarizeAuditResult formats a passing batch
console.log('14. summarizeAuditResult formats a passing batch');
const test14 = summarizeAuditResult(
  auditAgentExecution([{ ...validAction, itemId: 'opp-1' }]),
);
console.assert(test14.startsWith('Audit: PASS'), 'Should start with PASS line');
console.assert(test14.includes('1/1 actions valid'), 'Should report 1/1 valid');
console.log('   ✓ Passed\n');

// Test 15: summarizeAuditResult reports failure counts and batch issues
console.log('15. summarizeAuditResult reports failures and batch issues');
const test15 = summarizeAuditResult(
  auditAgentExecution([
    { ...validAction, itemId: 'opp-1' },
    { ...validAction, itemId: 'opp-1' }, // duplicate to force a batch issue
    { ...validAction, itemId: null }, // missing itemRef
  ]),
);
console.assert(test15.startsWith('Audit: FAIL'), 'Should start with FAIL line');
console.assert(test15.includes('action(s) failed validation'), 'Should report failed actions');
console.assert(test15.includes('Duplicate'), 'Should surface duplicate batch issue');
console.log('   ✓ Passed\n');

// Test 16: summarizeAuditResult handles null/non-object input safely
console.log('16. summarizeAuditResult handles null input');
console.assert(summarizeAuditResult(null) === 'No audit result available', 'null should be handled');
console.assert(summarizeAuditResult(undefined) === 'No audit result available', 'undefined should be handled');
console.assert(summarizeAuditResult(42) === 'No audit result available', 'non-object should be handled');
console.log('   ✓ Passed\n');

// Test 17: AUDIT_THRESHOLDS exposes the low average confidence threshold
console.log('17. AUDIT_THRESHOLDS exports lowAverageConfidence as a finite number');
console.assert(
  typeof AUDIT_THRESHOLDS.lowAverageConfidence === 'number' &&
    Number.isFinite(AUDIT_THRESHOLDS.lowAverageConfidence),
  'lowAverageConfidence should be a finite number',
);
console.log('   ✓ Passed\n');

// Test 18: Low-confidence warning respects AUDIT_THRESHOLDS.lowAverageConfidence
console.log('18. Low-confidence warning fires below threshold, not at/above it');
const justBelow = Math.max(0, AUDIT_THRESHOLDS.lowAverageConfidence - 1);
const atThreshold = AUDIT_THRESHOLDS.lowAverageConfidence;
const belowResult = auditAgentExecution([{ ...validAction, itemId: 'opp-low', confidence: justBelow }]);
const atResult = auditAgentExecution([{ ...validAction, itemId: 'opp-at', confidence: atThreshold }]);
console.assert(
  belowResult.batchIssues.some((i) => i.includes('Low average confidence')),
  'Should warn when avg confidence is below threshold',
);
console.assert(
  !atResult.batchIssues.some((i) => i.includes('Low average confidence')),
  'Should not warn when avg confidence equals threshold',
);
console.log('   ✓ Passed\n');

// Test 19: getFailedAuditResults returns only failing entries, preserves order
console.log('19. getFailedAuditResults returns only failing entries, preserves order');
const test19Result = auditAgentExecution([
  { ...validAction, itemId: 'opp-ok' },
  { ...validAction, itemId: null }, // fails itemRef
  { ...validAction, itemId: 'opp-bad-conf', confidence: 150 }, // fails confidence
]);
const test19 = getFailedAuditResults(test19Result);
console.assert(test19.length === 2, `Expected 2 failures, got ${test19.length}`);
console.assert(
  test19.every((r) => r.valid === false),
  'Every returned entry should have valid=false',
);
console.assert(test19[0].action.itemId === null, 'First failure should be the missing-itemRef action');
console.assert(test19[1].action.itemId === 'opp-bad-conf', 'Second failure should be the bad-confidence action');
console.log('   ✓ Passed\n');

// Test 20: getFailedAuditResults returns [] when all actions pass
console.log('20. getFailedAuditResults returns [] when all actions pass');
const test20 = getFailedAuditResults(auditAgentExecution([{ ...validAction, itemId: 'opp-ok' }]));
console.assert(test20.length === 0, 'No failures expected');
console.log('   ✓ Passed\n');

// Test 21: getFailedAuditResults handles null/invalid input safely
console.log('21. getFailedAuditResults handles null/invalid input safely');
console.assert(getFailedAuditResults(null).length === 0, 'null should return []');
console.assert(getFailedAuditResults(undefined).length === 0, 'undefined should return []');
console.assert(getFailedAuditResults(42).length === 0, 'non-object should return []');
console.assert(getFailedAuditResults({}).length === 0, 'missing actionResults should return []');
console.assert(
  getFailedAuditResults({ actionResults: 'not-array' }).length === 0,
  'non-array actionResults should return []',
);
console.log('   ✓ Passed\n');

// Test 22: getPassingAuditResults returns only passing entries, preserves order
console.log('22. getPassingAuditResults returns only passing entries, preserves order');
const test22Result = auditAgentExecution([
  { ...validAction, itemId: 'opp-ok-1' },
  { ...validAction, itemId: null }, // fails itemRef
  { ...validAction, itemId: 'opp-ok-2' },
]);
const test22 = getPassingAuditResults(test22Result);
console.assert(test22.length === 2, `Expected 2 passes, got ${test22.length}`);
console.assert(test22.every((r) => r.valid === true), 'Every returned entry should have valid=true');
console.assert(test22[0].action.itemId === 'opp-ok-1', 'First pass should preserve original order');
console.assert(test22[1].action.itemId === 'opp-ok-2', 'Second pass should preserve original order');
console.log('   ✓ Passed\n');

// Test 23: getPassingAuditResults returns [] when all actions fail
console.log('23. getPassingAuditResults returns [] when all actions fail');
const test23 = getPassingAuditResults(
  auditAgentExecution([{ ...validAction, itemId: null }]),
);
console.assert(test23.length === 0, 'No passes expected');
console.log('   ✓ Passed\n');

// Test 24: getPassingAuditResults handles null/invalid input safely
console.log('24. getPassingAuditResults handles null/invalid input safely');
console.assert(getPassingAuditResults(null).length === 0, 'null should return []');
console.assert(getPassingAuditResults(undefined).length === 0, 'undefined should return []');
console.assert(getPassingAuditResults(42).length === 0, 'non-object should return []');
console.assert(getPassingAuditResults({}).length === 0, 'missing actionResults should return []');
console.assert(
  getPassingAuditResults({ actionResults: 'not-array' }).length === 0,
  'non-array actionResults should return []',
);
console.log('   ✓ Passed\n');

// Test 25: two actions with null itemId are NOT flagged as duplicates of each other
console.log('25. Two malformed actions with null itemId are not cross-flagged as duplicates');
const test25 = auditAgentExecution([
  { ...validAction, itemId: null, title: 'First nullId' },
  { ...validAction, itemId: null, title: 'Second nullId' },
]);
const test25DupIssues = test25.batchIssues.filter((i) => i.includes('Duplicate'));
console.assert(test25DupIssues.length === 0, `Null-itemId actions should not produce duplicate warnings, got: ${JSON.stringify(test25DupIssues)}`);
// Both should still fail itemRef validation independently
console.assert(test25.actionResults.every((r) => r.valid === false), 'Both should still fail itemRef validation');
console.log('   ✓ Passed\n');

// Test 26: genuine duplicates (valid, same non-null itemId + actionId) are still detected
console.log('26. Genuine duplicate (same non-null itemId + actionId) is still flagged');
const test26 = auditAgentExecution([
  { ...validAction, itemId: 'opp-real' },
  { ...validAction, itemId: 'opp-real' },
]);
console.assert(
  test26.batchIssues.some((i) => i.includes('Duplicate') && i.includes('opp-real')),
  'Real duplicate should still be flagged',
);
console.log('   ✓ Passed\n');

console.log('✅ All tests passed');
