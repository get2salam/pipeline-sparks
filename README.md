# Pipeline Sparks

[![tests](https://github.com/get2salam/pipeline-sparks/actions/workflows/tests.yml/badge.svg)](https://github.com/get2salam/pipeline-sparks/actions/workflows/tests.yml)

Track lightweight opportunities before they either compound or cool off.

![Pipeline Sparks preview](docs/preview.svg)

Pipeline Sparks is a local-first workspace for founders, operators, and solo builders who want a cleaner way to manage opportunities. It keeps win chance, source, next touch, and review timing visible so the right things move forward with less drift.

## What it does

- ranks opportunities by leverage, win chance, timing, and friction
- tracks **source**, **next touch**, **follow-up date**, and **win chance** for each opportunity
- highlights the best current bet, the next review slot, and the strongest signal on the board
- renders a dedicated queue plus a category mix snapshot beneath the main board
- saves locally in the browser with JSON import/export backups
- quick action: **Qualify now**
- quick action: **Raise win chance**
- quick action: **Mark won**

## Why it feels different

Pipeline Sparks is not just a generic list. It is shaped around the real workflow behind opportunities, so the board helps you decide what matters next instead of simply storing records.

## Quick start

```bash
git clone https://github.com/get2salam/pipeline-sparks.git
cd pipeline-sparks
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Running the agent tests

The pipeline agent logic in `js/agent-audit.js` and `js/agent-planner.js`, plus the backup/import guardrails in `js/snapshot-schema.js`, are covered by Node-based assertion suites in `js/*.test.js`. Run them with:

```bash
npm test
```

The runner in `scripts/run-tests.mjs` patches `console.assert` so failed assertions exit with a non-zero status, which makes the suite safe to wire into CI. Individual suites are available via `npm run test:audit`, `npm run test:planner`, and `npm run test:schema`.

### Import hardening

`js/snapshot-schema.js` is the parsing boundary for JSON backups, whether restored from `localStorage` or picked via **Import**. It rejects malformed shapes (non-object roots, non-array `items`, wrong-typed fields) and caps both the number of items (`MAX_IMPORT_ITEMS`) and the length of free-text fields (`MAX_TEXT_LENGTH`), so a corrupted or oversized backup fails with a clear error instead of bloating `localStorage` or freezing the board. `js/main.js` also rejects an import file outright if it exceeds `MAX_IMPORT_FILE_BYTES` before ever reading its contents.

The same `npm test` command runs in CI via [`.github/workflows/tests.yml`](.github/workflows/tests.yml) on every push and pull request to `main`, against Node 20 and Node 22.

## Runnable planner preview

Use the checked-in example to see how the planner and audit helpers compose before wiring them into a UI or automation loop:

```bash
npm run example:planner
```

The preview runs `examples/planner-preview.mjs`, which builds a small deterministic opportunity pipeline, plans the next actions, reduces them to one suggestion per opportunity, audits the focused batch, and prints grouped recommendations. It is intentionally offline and dependency-free so it can double as a quick smoke test for agent-facing changes.

## Keyboard shortcuts

Shortcuts only fire when no input is focused and no modifier keys (Cmd, Ctrl, Alt) are held, so browser shortcuts like Cmd+N keep working as expected.

- `N` creates a new opportunity
- `/` focuses the search box

## Privacy

Everything stays in your browser unless you export a JSON backup.

## License

MIT
