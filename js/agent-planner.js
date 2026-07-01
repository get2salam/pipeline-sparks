export const GUARDRAILS = {
  blockedStates: new Set(['Won']),
  maxMetric: 9,
  minConfidenceToSurface: 0.5,
};

const RUBRIC = [
  {
    actionId: 'qualify',
    label: 'Qualify now',
    matches: (item) => item.state === 'Seen' && item.metric >= 7 && item.score >= 7,
    reason: (item) => `Value ${item.score}/10, win chance ${item.metric}/10 — strong enough to qualify.`,
    confidence: (item) => Math.min(0.95, (item.metric + item.score) / 22),
  },
  {
    actionId: 'raise-win',
    label: 'Raise win chance',
    matches: (item) => item.state === 'Qualified' && item.metric < GUARDRAILS.maxMetric && item.score >= 7,
    reason: (item) => `Qualified at value ${item.score}/10 — win chance ${item.metric}/10 can be raised.`,
    confidence: (item) => Math.min(0.85, item.score / 12),
  },
  {
    actionId: 'nudge-follow-up',
    label: 'Touch overdue or imminent',
    matches: (_item, daysDue) => daysDue <= 1,
    reason: (_item, daysDue) => daysDue <= 0
      ? `Follow-up ${Math.abs(daysDue)} day(s) overdue — reach out now.`
      : 'Follow-up due tomorrow — consider reaching out today.',
    confidence: (_item, daysDue) => (daysDue <= 0 ? 0.92 : 0.72),
  },
];

/**
 * Return a prioritized list of action suggestions for the given pipeline items.
 * Items in blockedStates are silently skipped (guardrail enforced).
 *
 * @param {Array}    items          Normalized pipeline items.
 * @param {Function} daysFromToday  (dateStr) => number — injected for testability.
 * @returns {Array<{itemId, title, actionId, label, reason, confidence}>}
 */
export function planNextActions(items, daysFromToday) {
  if (!Array.isArray(items) || typeof daysFromToday !== 'function') return [];
  const out = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (GUARDRAILS.blockedStates.has(item.state)) continue;
    const daysDue = daysFromToday(item.date);
    if (typeof daysDue !== 'number' || !Number.isFinite(daysDue)) continue;
    for (const rule of RUBRIC) {
      if (!rule.matches(item, daysDue)) continue;
      const conf = rule.confidence(item, daysDue);
      if (conf < GUARDRAILS.minConfidenceToSurface) continue;
      out.push({
        itemId: item.id,
        title: item.title,
        actionId: rule.actionId,
        label: rule.label,
        reason: rule.reason(item, daysDue),
        confidence: Math.round(conf * 100),
      });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Reduce a sorted suggestion list to the single highest-confidence suggestion
 * per itemId. Useful when a UI slot budget would otherwise be consumed by
 * multiple suggestions for the same opportunity (e.g. an item that matches
 * both `qualify` and `nudge-follow-up`).
 *
 * Order is preserved: the first occurrence of each itemId wins, so callers
 * should pass suggestions already sorted by descending confidence — which is
 * the shape returned by {@link planNextActions}.
 *
 * @param {Array} suggestions - Output from planNextActions
 * @returns {Array} Deduplicated suggestions, at most one per itemId
 */
export function bestSuggestionPerItem(suggestions) {
  if (!Array.isArray(suggestions)) return [];
  const seen = new Set();
  const out = [];
  for (const s of suggestions) {
    if (!s || typeof s !== 'object' || s.itemId == null) continue;
    if (seen.has(s.itemId)) continue;
    seen.add(s.itemId);
    out.push(s);
  }
  return out;
}

/**
 * Filter planner suggestions to those at or above a minimum confidence percent.
 * Use this when the UI wants to suppress borderline suggestions (e.g. only show
 * confidence >= 70%). Confidence values from {@link planNextActions} are already
 * integers in 0-100, so the threshold should be expressed in the same units.
 *
 * Order is preserved. Invalid entries (null, non-object, non-finite confidence)
 * are dropped silently rather than throwing.
 *
 * @param {Array}  suggestions   - Output from planNextActions
 * @param {number} minConfidence - Inclusive lower bound (0-100)
 * @returns {Array} Suggestions whose confidence >= minConfidence
 */
export function filterByMinConfidence(suggestions, minConfidence) {
  if (!Array.isArray(suggestions)) return [];
  if (typeof minConfidence !== 'number' || !Number.isFinite(minConfidence)) return [];
  return suggestions.filter(
    (s) =>
      s &&
      typeof s === 'object' &&
      typeof s.confidence === 'number' &&
      Number.isFinite(s.confidence) &&
      s.confidence >= minConfidence,
  );
}

/**
 * Count planner suggestions grouped by actionId.
 * Returns a plain object keyed by actionId with the number of suggestions for
 * each. Use this to drive distribution dashboards, grouped UI sections, or
 * routing logic without re-walking the raw suggestion array. Both
 * {@link summarizePlannerSuggestions} and {@link planNextActions} produce
 * shapes that flow directly into this helper.
 *
 * Malformed entries (null, non-object, missing actionId) are skipped silently.
 * Bad input returns an empty object rather than throwing.
 *
 * @param {Array} suggestions - Output from planNextActions
 * @returns {Object} Map of actionId → integer count
 */
export function countSuggestionsByAction(suggestions) {
  if (!Array.isArray(suggestions)) return {};
  const counts = {};
  for (const s of suggestions) {
    if (!s || typeof s !== 'object' || !s.actionId) continue;
    counts[s.actionId] = (counts[s.actionId] || 0) + 1;
  }
  return counts;
}

/**
 * Group planner suggestions by actionId, returning the full suggestion entries
 * rather than just counts. Complements {@link countSuggestionsByAction}, which
 * answers "how many of each?"; this answers "which ones are in each bucket?"
 * and is the shape a UI needs to render distinct sections per action type
 * (e.g. a "Qualify" column next to a "Raise win" column).
 *
 * Order within each bucket is preserved from the input, so passing the output
 * of {@link planNextActions} keeps each bucket sorted by descending confidence.
 * Malformed entries (null, non-object, missing actionId) are skipped silently;
 * bad input returns an empty object rather than throwing.
 *
 * @param {Array} suggestions - Output from planNextActions
 * @returns {Object} Map of actionId → array of suggestions
 */
export function groupSuggestionsByAction(suggestions) {
  if (!Array.isArray(suggestions)) return {};
  const groups = {};
  for (const s of suggestions) {
    if (!s || typeof s !== 'object' || !s.actionId) continue;
    (groups[s.actionId] ||= []).push(s);
  }
  return groups;
}

/**
 * Format planner suggestions as a printable summary suitable for console or UI display.
 * @param {Array} suggestions - Output from planNextActions
 * @returns {string} Multi-line summary
 */
export function summarizePlannerSuggestions(suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return 'Planner: no suggested actions';
  }
  const byAction = new Map();
  for (const s of suggestions) {
    if (!s || typeof s !== 'object' || !s.actionId) continue;
    byAction.set(s.actionId, (byAction.get(s.actionId) || 0) + 1);
  }
  const lines = [`Planner: ${suggestions.length} suggested action(s)`];
  for (const [actionId, count] of byAction) lines.push(`  ${actionId}: ${count}`);
  const top = suggestions[0];
  if (top && top.title && top.actionId) {
    lines.push(`  Top: ${top.title} → ${top.actionId} (${top.confidence}%)`);
  }
  return lines.join('\n');
}

/**
 * Compute a 0–100 health score for active pipeline items in a single O(n) pass.
 * Use this when only a summary indicator (dashboard badge, status chip) is needed
 * and re-running the full planNextActions would be wasteful.
 *
 * Items in blockedStates are excluded — they are intentionally done.
 * Items whose daysFromToday returns a non-finite value are counted toward the
 * active total but not toward overdue or imminent (unknown date = no penalty).
 *
 * Score drops when active items have overdue or imminent touch dates.
 * Overdue items are weighted twice as heavily as imminent ones.
 * A pipeline with no active items scores 100 (nothing at risk).
 *
 * @param {Array}    items          Normalized pipeline items.
 * @param {Function} daysFromToday  (dateStr) => number — injected for testability.
 * @returns {{ score: number, breakdown: { total: number, overdue: number, imminent: number } }}
 */
export function scorePipelineHealth(items, daysFromToday) {
  if (!Array.isArray(items) || typeof daysFromToday !== 'function') {
    return { score: 0, breakdown: { total: 0, overdue: 0, imminent: 0 } };
  }
  const blocked = GUARDRAILS.blockedStates;
  let total = 0;
  let overdue = 0;
  let imminent = 0;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (blocked.has(item.state)) continue;
    total++;
    const daysDue = daysFromToday(item.date);
    if (typeof daysDue !== 'number' || !Number.isFinite(daysDue)) continue;
    if (daysDue < 0) overdue++;
    else if (daysDue <= 2) imminent++;
  }

  if (total === 0) return { score: 100, breakdown: { total: 0, overdue: 0, imminent: 0 } };

  const urgencyWeight = (overdue * 2 + imminent) / (total * 2);
  const score = Math.round(Math.max(0, Math.min(100, (1 - urgencyWeight) * 100)));
  return { score, breakdown: { total, overdue, imminent } };
}
