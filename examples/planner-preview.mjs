#!/usr/bin/env node
import { auditAgentExecution, summarizeAuditResult } from '../js/agent-audit.js';
import {
  bestSuggestionPerItem,
  groupSuggestionsByAction,
  planNextActions,
  summarizePlannerSuggestions,
} from '../js/agent-planner.js';

const samplePipeline = [
  {
    id: 'warm-intro',
    title: 'Warm intro from past client',
    state: 'Qualified',
    score: 9,
    metric: 8,
    date: '2026-05-04',
  },
  {
    id: 'partner-demo',
    title: 'Partner demo slot',
    state: 'Seen',
    score: 8,
    metric: 8,
    date: '2026-05-08',
  },
  {
    id: 'closed-sponsor',
    title: 'Closed sponsor referral',
    state: 'Won',
    score: 10,
    metric: 9,
    date: '2026-05-01',
  },
];

const relativeDueDays = {
  '2026-05-04': -2,
  '2026-05-08': 2,
  '2026-05-01': -5,
};

const daysFromToday = (date) => relativeDueDays[date] ?? 999;
const suggestions = planNextActions(samplePipeline, daysFromToday);
const focusedSuggestions = bestSuggestionPerItem(suggestions);
const audit = auditAgentExecution(focusedSuggestions, samplePipeline);
const grouped = groupSuggestionsByAction(focusedSuggestions);

console.log('Pipeline Sparks planner preview');
console.log('================================');
console.log(summarizePlannerSuggestions(focusedSuggestions));
console.log(summarizeAuditResult(audit));

for (const [actionId, entries] of Object.entries(grouped)) {
  console.log(`\n${actionId}`);
  for (const entry of entries) {
    console.log(`- ${entry.title}: ${entry.reason} (${entry.confidence}%)`);
  }
}
