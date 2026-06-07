#!/usr/bin/env node
/**
 * Test runner that makes assertion failures actually fail the process.
 *
 * The agent test suites in js/*.test.js use `console.assert`, which writes a
 * message to stderr but does NOT throw and does NOT change the exit code.
 * Running those files directly therefore reports "all tests passed" even when
 * assertions fail, which would silently hide regressions in CI.
 *
 * This runner wraps each test file by:
 *   1. patching `console.assert` to count failures while preserving its output,
 *   2. importing the test file as an ES module,
 *   3. tracking any thrown errors as failures, and
 *   4. exiting with code 1 if anything failed across the run.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_TESTS = [
  'js/agent-audit.test.js',
  'js/agent-planner.test.js',
];

const args = process.argv.slice(2);
const testFiles = args.length > 0 ? args : DEFAULT_TESTS;

let failures = 0;
const originalAssert = console.assert.bind(console);
console.assert = (condition, ...rest) => {
  if (!condition) failures += 1;
  originalAssert(condition, ...rest);
};

for (const file of testFiles) {
  const absolute = path.resolve(process.cwd(), file);
  const url = pathToFileURL(absolute).href;
  try {
    await import(url);
  } catch (err) {
    failures += 1;
    console.error(`\n✗ ${file} threw during execution:`);
    console.error(err && err.stack ? err.stack : err);
  }
}

if (failures > 0) {
  console.error(`\n❌ ${failures} test assertion(s) failed`);
  process.exit(1);
}

console.log(`\n✅ ${testFiles.length} test file(s) completed with no failures`);
