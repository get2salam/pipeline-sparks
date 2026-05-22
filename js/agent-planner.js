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
  const out = [];
  for (const item of items) {
    if (GUARDRAILS.blockedStates.has(item.state)) continue;
    const daysDue = daysFromToday(item.date);
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
