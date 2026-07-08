import {
  safeParseSnapshot,
  MAX_IMPORT_ITEMS,
  MAX_TEXT_LENGTH,
} from './snapshot-schema.js';

console.log('🧪 Snapshot Schema Tests\n');

// Test 1: A well-formed snapshot round-trips unchanged
console.log('1. Valid snapshot parses successfully');
const validSnapshot = JSON.stringify({
  boardTitle: 'Pipeline sparks board',
  boardSubtitle: 'A local-first board',
  items: [{ id: 'a1', title: 'Warm intro' }],
  ui: { search: '', category: 'all', status: 'all', selectedId: null },
});
const test1 = safeParseSnapshot(validSnapshot);
console.assert(test1.items.length === 1, 'Should keep the single item');
console.assert(test1.boardTitle === 'Pipeline sparks board', 'Should keep boardTitle');
console.log('   ✓ Passed\n');

// Test 2: Non-object top level is rejected
console.log('2. Array or primitive top level is rejected');
console.assert(throws(() => safeParseSnapshot('[1,2,3]')), 'Array root should throw');
console.assert(throws(() => safeParseSnapshot('"just a string"')), 'String root should throw');
console.assert(throws(() => safeParseSnapshot('null')), 'Null root should throw');
console.log('   ✓ Passed\n');

// Test 3: items must be an array of objects
console.log('3. Malformed items are rejected');
console.assert(throws(() => safeParseSnapshot(JSON.stringify({ items: 'nope' }))), 'Non-array items should throw');
console.assert(throws(() => safeParseSnapshot(JSON.stringify({ items: [null] }))), 'Null item entry should throw');
console.assert(throws(() => safeParseSnapshot(JSON.stringify({ items: ['nope'] }))), 'Primitive item entry should throw');
console.log('   ✓ Passed\n');

// Test 4: item counts above the cap are rejected
console.log('4. Oversized items array is rejected');
const oversizedItems = Array.from({ length: MAX_IMPORT_ITEMS + 1 }, (_, i) => ({ id: `item-${i}` }));
console.assert(throws(() => safeParseSnapshot(JSON.stringify({ items: oversizedItems }))), 'Item count above cap should throw');
const atCapItems = Array.from({ length: MAX_IMPORT_ITEMS }, (_, i) => ({ id: `item-${i}` }));
console.assert(!throws(() => safeParseSnapshot(JSON.stringify({ items: atCapItems }))), 'Item count at cap should be allowed');
console.log('   ✓ Passed\n');

// Test 5: oversized text fields on an item are rejected
console.log('5. Oversized item text field is rejected');
const hugeTitle = 'x'.repeat(MAX_TEXT_LENGTH + 1);
console.assert(
  throws(() => safeParseSnapshot(JSON.stringify({ items: [{ title: hugeTitle }] }))),
  'Title longer than the cap should throw',
);
console.assert(
  !throws(() => safeParseSnapshot(JSON.stringify({ items: [{ title: 'x'.repeat(MAX_TEXT_LENGTH) }] }))),
  'Title at the cap should be allowed',
);
console.log('   ✓ Passed\n');

// Test 6: boardTitle/boardSubtitle type and length are enforced
console.log('6. boardTitle/boardSubtitle are validated');
console.assert(throws(() => safeParseSnapshot(JSON.stringify({ boardTitle: 123 }))), 'Non-string boardTitle should throw');
console.assert(
  throws(() => safeParseSnapshot(JSON.stringify({ boardSubtitle: 'x'.repeat(MAX_TEXT_LENGTH + 1) }))),
  'Oversized boardSubtitle should throw',
);
console.log('   ✓ Passed\n');

// Test 7: ui must be a plain object when present
console.log('7. Malformed ui is rejected');
console.assert(throws(() => safeParseSnapshot(JSON.stringify({ ui: 'nope' }))), 'Non-object ui should throw');
console.assert(throws(() => safeParseSnapshot(JSON.stringify({ ui: ['nope'] }))), 'Array ui should throw');
console.assert(!throws(() => safeParseSnapshot(JSON.stringify({ ui: { search: '' } }))), 'Plain object ui should be allowed');
console.log('   ✓ Passed\n');

// Test 8: invalid JSON still throws (delegated to JSON.parse)
console.log('8. Invalid JSON throws');
console.assert(throws(() => safeParseSnapshot('{not valid json')), 'Malformed JSON text should throw');
console.log('   ✓ Passed\n');

console.log('✅ All snapshot schema tests completed\n');

function throws(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}
