/**
 * Backup/import schema guardrails for pipeline snapshots.
 * Hardens the JSON.parse boundary so a malformed, truncated, or hostile
 * backup file cannot corrupt board state, blow the localStorage quota, or
 * freeze the tab rendering an unreasonably large board.
 */

// A hand-edited or exported backup should never need more than a few
// thousand opportunities; this caps the blast radius of a corrupted or
// maliciously oversized items array.
export const MAX_IMPORT_ITEMS = 2000;

// Free-text fields are rendered directly in the UI and persisted to
// localStorage on every change; cap their length so a single field can't
// exhaust the per-origin storage quota or make the list unusable to scroll.
export const MAX_TEXT_LENGTH = 4000;

// Guards the file picker itself: reading an arbitrarily large file into
// memory via file.text() before it is even parsed is wasted work (or a tab
// freeze) if the file was never going to be a valid backup.
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

const TEXT_FIELDS = ['title', 'note', 'textOne', 'textTwo'];

function assertTextFieldLengths(entry, index) {
  for (const field of TEXT_FIELDS) {
    const value = entry[field];
    if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) {
      throw new Error(`Backup item at position ${index} field "${field}" exceeds ${MAX_TEXT_LENGTH} characters.`);
    }
  }
}

/**
 * Parse and validate a JSON backup/snapshot string before it reaches
 * application state. Throws a descriptive Error on any structural, type,
 * or size violation rather than letting bad data flow into localStorage
 * or the DOM.
 *
 * @param {string} raw - Raw JSON text from a file import or localStorage.
 * @returns {Object} The parsed snapshot, guaranteed to match the expected shape.
 */
export function safeParseSnapshot(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup must be a JSON object.');
  }
  if (parsed.items !== undefined) {
    if (!Array.isArray(parsed.items)) {
      throw new Error('Backup items must be an array.');
    }
    if (parsed.items.length > MAX_IMPORT_ITEMS) {
      throw new Error(`Backup has ${parsed.items.length} items, which exceeds the ${MAX_IMPORT_ITEMS} limit.`);
    }
    parsed.items.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`Backup item at position ${index} must be an object.`);
      }
      assertTextFieldLengths(entry, index);
    });
  }
  for (const field of ['boardTitle', 'boardSubtitle']) {
    const value = parsed[field];
    if (value !== undefined && typeof value !== 'string') {
      throw new Error(`Backup ${field} must be a string.`);
    }
    if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) {
      throw new Error(`Backup ${field} exceeds ${MAX_TEXT_LENGTH} characters.`);
    }
  }
  const { ui } = parsed;
  if (ui !== undefined && (ui === null || typeof ui !== 'object' || Array.isArray(ui))) {
    throw new Error('Backup ui must be an object.');
  }
  return parsed;
}
