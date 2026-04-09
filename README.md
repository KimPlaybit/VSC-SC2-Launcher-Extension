# SC2 Map Tools — VS Code Extension

Launch StarCraft II maps directly from VS Code without leaving the editor.

---

## Features

- **Status bar button** — `▶ SC2: Launch Map` always visible at the bottom of the window
- **Command palette** — `SC2: Launch Map` via `Ctrl+Shift+P`
- **Run & Debug dropdown** — `SC2: Launch Map` appears as the first entry in the debug configuration list; press F5 to launch
- **Kill & Relaunch** — if SC2 is already running you're prompted to kill it before relaunching
- **Auto-detects map path** — picks the first workspace folder ending in `.SC2Map`

---

## Requirements

- Windows (uses `SC2Switcher_x64.exe` and `taskkill`)
- StarCraft II installed
- VS Code ≥ 1.80

---

## Setup

1. Open **Settings** (`Ctrl+,`) and search for **SC2**.
2. Set **SC2: Install Dir** to your StarCraft II root folder, e.g.:
   ```
   C:\Program Files (x86)\StarCraft II
   ```
   The extension derives the launcher path as:
   ```
   <installDir>\Support64\SC2Switcher_x64.exe
   ```
3. *(Optional)* Set **SC2: Map Path** if you want to override map auto-detection.

---

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| `sc2.installDir` | `""` | **Required.** Path to the StarCraft II root folder (contains `Support64\SC2Switcher_x64.exe`). |
| `sc2.mapPath` | `""` | Absolute path to the `.SC2Map` folder. Leave empty to auto-detect from the workspace (first folder ending in `.SC2Map`). |

---

## How It Works

The extension calls `SC2Switcher_x64.exe` with the following arguments:

```
SC2Switcher_x64.exe -run <mapPath> -preload 1 -NoUserCheats -meleeMod Void -difficulty 2 -speed 2 -displaymode 1
```

The process is spawned detached so VS Code doesn't own it. SC2Switcher in turn starts `SC2_x64.exe` with the map loaded.

---

## Building & Installing

This extension is installed manually by copying the compiled output into the VS Code extensions folder (standard VSIX packaging requires Node ≥ 20; this project targets Node 17+).

### Quick install (PowerShell)

```powershell
.\install.ps1
```

This script:
1. Runs `yarn compile` (TypeScript → `out/`)
2. Copies `package.json` and `out/*.js` to `%USERPROFILE%\.vscode\extensions\sc2-dev.vsc-sc2-0.1.0\`

After running, reload VS Code (`Ctrl+Shift+P` → **Reload Window**).

### Manual steps

```powershell
yarn compile
```

Then copy the following to `%USERPROFILE%\.vscode\extensions\sc2-dev.vsc-sc2-0.1.0\`:

```
package.json
out\extension.js
out\sc2Compiler.js
out\errorParser.js   # unused, but compiled
```

---

## Project Structure

```
vsc-sc2-plugin/
├── src/
│   ├── extension.ts      # Activation entry point, status bar, command + debug provider
│   ├── sc2Compiler.ts    # SC2Launcher class — all launch logic
│   └── errorParser.ts    # Unused; originally for ScriptError.txt diagnostics
├── out/                  # Compiled JS (git-ignored)
├── info/
│   └── sc2-binary-and-launch.md  # Reference doc: all SC2 binary/CLI knowledge
├── package.json          # Extension manifest
├── tsconfig.json         # TS config (target ES2020, commonjs)
├── install.ps1           # Build + install helper script
└── yarn.lock
```

---

## Development

**Watch mode** (recompiles on save):
```powershell
yarn watch
```

**Compile once:**
```powershell
yarn compile
```

To test changes: run `install.ps1`, then **Reload Window** in VS Code.

If you want a proper extension host debug session, use the `Run SC2 Extension` launch configuration in `.vscode/launch.json` (requires the `out/` folder to be populated first).

---

## Known Limitations

- Windows only — uses `taskkill` for kill detection and `SC2Switcher_x64.exe` for launch.
- No VSIX packaging yet (requires Node ≥ 20 for vsce ≥ 3.x; current dev machine runs Node 17).
- `errorParser.ts` is compiled but not used — it was written when Galaxy script compile-from-VS-Code was being explored. That approach was abandoned because the SC2 editor process does not expose a headless compile path.
