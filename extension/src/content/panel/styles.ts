/** Panel styles. They live in the panel's shadow root and reach nothing on the page. */

export const PANEL_CSS = `
.panel {
  --muted: #6b6b76;
  --line: #e4e4ea;
  --accent: #2563eb;
  --danger: #b42318;
  position: fixed;
  top: 16px;
  right: 16px;
  width: 340px;
  max-height: calc(100vh - 32px);
  overflow: auto;
  box-sizing: border-box;
  pointer-events: auto;
  padding: 12px;
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: #1d1d22;
  background: #ffffff;
  border: 1px solid #d8d8df;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.18);
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  .panel {
    --muted: #a0a0ab;
    --line: #34343c;
    --accent: #6ea8fe;
    --danger: #f97066;
    color: #ececf1;
    background: #1e1e23;
    border-color: #3a3a43;
    color-scheme: dark;
  }
}

.panel * { box-sizing: border-box; }

header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
header .host { flex: 1; min-width: 0; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

section { border-top: 1px solid var(--line); padding: 10px 0; }
h2 { margin: 0 0 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
fieldset { border: 0; margin: 8px 0 0; padding: 0; }
legend { padding: 0; margin-bottom: 4px; font-weight: 600; }

.row { display: grid; grid-template-columns: 76px 1fr; align-items: center; gap: 6px; margin-bottom: 4px; }
.row .label { color: var(--muted); }
.row .controls { display: flex; align-items: center; gap: 4px; min-width: 0; }

input[type="text"], select {
  width: 100%;
  min-width: 0;
  padding: 3px 6px;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 5px;
}
input[type="color"] { flex: none; width: 32px; height: 24px; padding: 0; border: 1px solid var(--line); border-radius: 5px; background: none; }

button {
  padding: 3px 9px;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 5px;
  cursor: pointer;
}
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: 0.45; cursor: default; }
button.primary { color: #ffffff; background: var(--accent); border-color: var(--accent); }
button.icon { flex: none; padding: 0 6px; }
button.link {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 12px ui-monospace, Consolas, monospace;
}

.toolbar, .actions { display: flex; flex-wrap: wrap; gap: 6px; }
.check { display: flex; align-items: center; gap: 6px; }
code { font: 12px ui-monospace, Consolas, monospace; overflow-wrap: anywhere; }
.muted { margin: 4px 0; color: var(--muted); }

.notice { margin: 0 0 8px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; }
.notice.error { color: var(--danger); border-color: currentColor; }

ul { list-style: none; margin: 0; padding: 0; }
li { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.badge { flex: none; padding: 0 6px; font-size: 11px; color: var(--danger); border: 1px solid currentColor; border-radius: 999px; }

.highlight {
  position: fixed;
  display: none;
  pointer-events: none;
  outline: 2px solid #2563eb;
  background: rgb(37 99 235 / 0.12);
  border-radius: 2px;
}
`
