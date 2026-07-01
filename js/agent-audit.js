/**
 * Audit helper for autonomous pipeline agent execution.
 * Ensures agents follow safety and consistency guardrails.
 */

// Tunable thresholds used by auditAgentExecution. Exposed so callers and tests
// can reference the same constants the audit logic uses.
export const AUDIT_THRESHOLDS = {
  // Batch warning fires when the average action confidence is below this percent.
  lowAverageConfidence: 30,
};

export const AGENT_AUDIT_CHECKLIST = {
  // Action validation
  action: {
    isValid: (action) => action && ['qualify', 'raise-win', 'nudge-follow-up'].includes(action.actionId),
    reason: 'Action must have a known actionId (qualify, raise-win, nudge-follow-up)',
  },
  // Confidence validation
  confidence: {
    isValid: (action) =>
      typeof action.confidence === 'number' &&
      Number.isFinite(action.confidence) &&
      action.confidence >= 0 &&
      action.confidence <= 100,
    reason: 'Confidence must be a finite number in the range 0-100',
  },
  // Item reference validation
  itemRef: {
    isValid: (action) => action.itemId && action.title,
    reason: 'Action must reference valid itemId and title',
  },
  // State consistency
  stateConsistency: {
    isValid: (action, item) => {
      if (!item) return true; // Skip if item not provided
      // qualify requires 'Seen' state
      if (action.actionId === 'qualify' && item.state !== 'Seen') return false;
      // raise-win requires 'Qualified' state
      if (action.actionId === 'raise-win' && item.state !== 'Qualified') return false;
      return true;
    },
    reason: 'Action state must match item current state',
  },
  // Blocked states (guardrail)
  blockedStates: {
    isValid: (action, item) => {
      if (!item) return true;
      const blocked = new Set(['Won']);
      return !blocked.has(item.state);
    },
    reason: 'Cannot execute actions on Won opportunities (guardrail)',
  },
};

/**
 * Validate a single agent action against audit checklist.
 * @param {Object} action - Action to validate {actionId, itemId, title, confidence, reason}
 * @param {Object} item - Optional item for state consistency checks
 * @returns {Object} {valid: boolean, issues: string[]}
 */
export function validateAgentAction(action, item = null) {
  if (action == null || typeof action !== 'object') {
    return { valid: false, issues: ['[action] Action is missing or not an object'] };
  }

  const issues = [];

  for (const [key, rule] of Object.entries(AGENT_AUDIT_CHECKLIST)) {
    if (!rule.isValid(action, item)) {
      issues.push(`[${key}] ${rule.reason}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Audit a batch of agent actions for consistency.
 * @param {Array} actions - Array of actions from agent execution
 * @param {Array} items - Optional array of items for state validation
 * @returns {Object} {valid: boolean, actionResults: Object[], batchIssues: string[]}
 */
export function auditAgentExecution(actions, items = []) {
  if (!Array.isArray(actions)) {
    return { valid: false, actionResults: [], batchIssues: ['actions must be an array'] };
  }
  const safeItems = Array.isArray(items) ? items.filter((i) => i && i.id != null) : [];
  const itemMap = new Map(safeItems.map((i) => [i.id, i]));
  const actionResults = [];
  const batchIssues = [];

  // Check for duplicates
  const actionIds = new Set();
  for (const a of actions) {
    if (a == null || typeof a !== 'object') continue;
    if (a.itemId == null || !a.actionId) continue; // malformed — itemRef rule will flag independently
    const key = `${a.itemId}-${a.actionId}`;
    if (actionIds.has(key)) {
      batchIssues.push(`Duplicate action: ${a.actionId} on item ${a.itemId}`);
    } else {
      actionIds.add(key);
    }
  }

  // Validate each action
  for (const action of actions) {
    const item = action && typeof action === 'object' ? itemMap.get(action.itemId) : null;
    const result = validateAgentAction(action, item);
    actionResults.push({
      action,
      ...result,
    });
    if (!result.valid) {
      const label = action && action.title ? action.title : '(unknown)';
      batchIssues.push(`Item "${label}": ${result.issues.join(', ')}`);
    }
  }

  // Check confidence distribution (only over numeric confidences)
  const numericConfidences = actions
    .filter((a) => a && typeof a.confidence === 'number')
    .map((a) => a.confidence);
  if (numericConfidences.length > 0) {
    const avgConfidence = numericConfidences.reduce((sum, c) => sum + c, 0) / numericConfidences.length;
    if (avgConfidence < AUDIT_THRESHOLDS.lowAverageConfidence) {
      batchIssues.push(`Low average confidence: ${Math.round(avgConfidence)}% — agent may be uncertain`);
    }
  }

  return {
    valid: batchIssues.length === 0 && actionResults.every(r => r.valid),
    actionResults,
    batchIssues,
  };
}

/**
 * Extract the failing entries from an audit result.
 * Use this when a caller needs programmatic access to just the actions that
 * failed validation — e.g. to retry them, surface them in a UI, or escalate
 * for human review — without re-parsing the {@link summarizeAuditResult} text
 * output or iterating the full actionResults array manually.
 *
 * Order matches the original auditAgentExecution output. Malformed or missing
 * input returns an empty array rather than throwing.
 *
 * @param {Object} result - Output from auditAgentExecution
 * @returns {Array} Action result entries whose `valid` flag is false
 */
export function getFailedAuditResults(result) {
  if (result == null || typeof result !== 'object') return [];
  if (!Array.isArray(result.actionResults)) return [];
  return result.actionResults.filter((r) => r && r.valid === false);
}

/**
 * Extract the passing entries from an audit result.
 * Counterpart to {@link getFailedAuditResults}. Use this when a caller wants to
 * proceed with only the validated subset of an audit batch — e.g. forward the
 * passing actions to an executor while routing failures to review.
 *
 * Order matches the original auditAgentExecution output. Malformed or missing
 * input returns an empty array rather than throwing.
 *
 * @param {Object} result - Output from auditAgentExecution
 * @returns {Array} Action result entries whose `valid` flag is true
 */
export function getPassingAuditResults(result) {
  if (result == null || typeof result !== 'object') return [];
  if (!Array.isArray(result.actionResults)) return [];
  return result.actionResults.filter((r) => r && r.valid === true);
}

/**
 * Format an audit result as a printable summary suitable for console or UI display.
 * @param {Object} result - Output from auditAgentExecution
 * @returns {string} Multi-line summary
 */
export function summarizeAuditResult(result) {
  if (result == null || typeof result !== 'object') {
    return 'No audit result available';
  }
  const actionResults = Array.isArray(result.actionResults) ? result.actionResults : [];
  const batchIssues = Array.isArray(result.batchIssues) ? result.batchIssues : [];
  const total = actionResults.length;
  const passed = actionResults.filter((r) => r && r.valid).length;
  const failed = total - passed;
  const lines = [`Audit: ${result.valid ? 'PASS' : 'FAIL'} — ${passed}/${total} actions valid`];
  if (failed > 0) lines.push(`  ${failed} action(s) failed validation`);
  for (const issue of batchIssues) lines.push(`  • ${issue}`);
  return lines.join('\n');
}
