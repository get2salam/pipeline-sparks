# Pipeline Sparks

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

## Keyboard shortcuts

Shortcuts only fire when no input is focused and no modifier keys (Cmd, Ctrl, Alt) are held, so browser shortcuts like Cmd+N keep working as expected.

- `N` creates a new opportunity
- `/` focuses the search box

## Privacy

Everything stays in your browser unless you export a JSON backup.

## License

MIT
