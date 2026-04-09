---
name: build-and-install
description: TypeScript compilation, yarn workflow, and manual extension installation for vsc-sc2. Use when rebuilding after source changes, installing the extension into VS Code, or understanding why VSIX packaging is not used. Do not use for VS Code API patterns (use vsc-extension-api) or SC2 launch logic (use sc2-launch-mechanics).
---

# Build & Install — vsc-sc2

## Why No VSIX Packaging

Standard VSIX packaging (`vsce package`) requires **Node ≥ 20** (for vsce ≥ 3.x). The dev machine runs **Node 17.0.1**, which is incompatible. Instead, the extension is installed by directly copying compiled files into the VS Code extensions folder.

---

## TypeScript Configuration

`tsconfig.json`:
```json
{
    "compilerOptions": {
        "module": "commonjs",
        "target": "ES2020",
        "lib": ["ES2020"],
        "outDir": "./out",
        "rootDir": "./src",
        "strict": true,
        "sourceMap": true,
        "esModuleInterop": true,
        "skipLibCheck": true
    },
    "exclude": ["node_modules", ".vscode-test", "out"]
}
```

Output goes to `out/`. Source is in `src/`.

---

## Yarn Commands

```powershell
yarn install      # restore node_modules from yarn.lock
yarn compile      # tsc -p ./ — compile once
yarn watch        # tsc -watch -p ./ — recompile on save
```

> **Note:** On machines with PowerShell execution policy restrictions, yarn can be run via:
> ```powershell
> node -e "require('child_process').execSync('yarn compile', {stdio:'inherit'})"
> ```

---

## Install Script (`install.ps1`)

Run this after any source change to push updates into VS Code:

```powershell
.\install.ps1
```

**What it does:**
1. `yarn compile` — compiles TypeScript to `out/`
2. Creates `%USERPROFILE%\.vscode\extensions\sc2-dev.vsc-sc2-0.1.0\out\`
3. Copies `package.json` → extension root
4. Copies `out\*.js` → `out\` inside the extension folder

**After running:** `Ctrl+Shift+P` → **Reload Window** to pick up changes.

---

## Extension Folder Name

The installed extension folder name follows the VS Code convention:

```
<publisher>.<name>-<version>
```

For this extension:
```
%USERPROFILE%\.vscode\extensions\sc2-dev.vsc-sc2-0.1.0\
```

Defined by the `package.json` fields:
- `"publisher": "sc2-dev"`
- `"name": "vsc-sc2"`
- `"version": "0.1.0"`

---

## What Gets Installed

Only two things need to be in the extensions folder for VS Code to load the extension:

| File | Purpose |
|---|---|
| `package.json` | Extension manifest — commands, settings, debuggers, activation events |
| `out/extension.js` | Compiled entry point |
| `out/sc2Compiler.js` | Compiled launcher class |
| `out/errorParser.js` | Compiled (unused, but compiled as part of `src/`) |

Source maps (`out/*.js.map`) are optional — copy them if you want breakpoints to work in the extension host debugger.

---

## Development Loop

```
1. Edit src/*.ts
2. yarn compile  (or yarn watch runs automatically)
3. .\install.ps1
4. Ctrl+Shift+P → Reload Window
```

For a proper extension host debug session (breakpoints in extension code), use the `Run SC2 Extension` launch config in `.vscode/launch.json` — this starts a second VS Code window with the extension loaded in dev mode.

---

## `.vscodeignore`

Files excluded when packaging with vsce (not relevant for manual install, but kept for future use):

```
.vscode/**
node_modules/**
src/**
out/**/*.map
```

---

## Upgrading the Version

When bumping the version:
1. Update `"version"` in `package.json`
2. Update the destination folder name in `install.ps1`:
   ```powershell
   $dest = "$env:USERPROFILE\.vscode\extensions\sc2-dev.vsc-sc2-<NEW_VERSION>"
   ```
3. Delete the old version folder from `.vscode\extensions\` to avoid conflicts.
