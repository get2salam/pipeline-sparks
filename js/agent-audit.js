/**
 * Audit helper for autonomous pipeline agent execution.
 * Ensures agents follow safety and consistency guardrails.
 */

export const AGENT_AUDIT_CHECKLIST = {
  // Action validation
  action: {
    isValid: (action) => action && ['qualify', 'raise-win', 'nudge-follow-up'].includes(action.actionId),
    reason: 'Action must have a known actionId (qualify, raise-win, nudge-follow-up)',
  },
  // Confidence validation
  confidence: {
    isValid: (action) => action.confidence >= 0 && action.confidence <= 100,
    reason: 'Confidence must be 0-100%',
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
  const itemMap = new Map(items.map(i => [i.id, i]));
  const actionResults = [];
  const batchIssues = [];

  // Check for duplicates
  const actionIds = new Set();
  const duplicates = actions.filter(a => {
    const key = `${a.itemId}-${a.actionId}`;
    if (actionIds.has(key)) {
      batchIssues.push(`Duplicate action: ${a.actionId} on item ${a.itemId}`);
      return true;
    }
    actionIds.add(key);
    return false;
  });

  // Validate each action
  for (const action of actions) {
    const item = itemMap.get(action.itemId);
    const result = validateAgentAction(action, item);
    actionResults.push({
      action,
      ...result,
    });
    if (!result.valid) {
      batchIssues.push(`Item "${action.title}": ${result.issues.join(', ')}`);
    }
  }

  // Check confidence distribution
  if (actions.length > 0) {
    const avgConfidence = actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length;
    if (avgConfidence < 30) {
      batchIssues.push(`Low average confidence: ${Math.round(avgConfidence)}% — agent may be uncertain`);
    }
  }

  return {
    valid: batchIssues.length === 0 && actionResults.every(r => r.valid),
    actionResults,
    batchIssues,
  };
}
