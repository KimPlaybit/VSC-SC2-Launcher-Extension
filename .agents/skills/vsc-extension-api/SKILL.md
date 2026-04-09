---
name: vsc-extension-api
description: VS Code extension API patterns used in this project — commands, status bar items, workspace configuration, debug configuration providers, and message dialogs. Use when adding new commands, hooking the Run & Debug dropdown, reading settings, or showing error/info messages. Do not use for SC2-specific launch logic (use sc2-launch-mechanics) or build tooling (use build-and-install).
---

# VS Code Extension API — Patterns Used in vsc-sc2

## Extension Entry Point

`src/extension.ts` is the `"main"` entry point declared in `package.json`.

```ts
export function activate(context: vscode.ExtensionContext): void {
    // all setup goes here — subscriptions, commands, status bar, debug provider
}

export function deactivate(): void {}
```

All disposables must be pushed onto `context.subscriptions` so VS Code cleans them up when the extension deactivates.

---

## Commands

**Declare in `package.json`:**
```json
"contributes": {
    "commands": [
        { "command": "sc2.launch", "title": "SC2: Launch Map", "icon": "$(run)" }
    ]
}
```

**Register handler in `extension.ts`:**
```ts
context.subscriptions.push(
    vscode.commands.registerCommand('sc2.launch', () => launcher.launch())
);
```

The command ID must match exactly between `package.json` and `registerCommand`.

---

## Status Bar Item

```ts
const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,  // priority — higher = further left
);
statusBarItem.command = 'sc2.launch';   // fires this command on click
statusBarItem.text = '$(run) SC2: Launch Map';  // $(icon-id) from codicons
statusBarItem.tooltip = 'Launch the SC2 map in StarCraft II';
statusBarItem.show();
context.subscriptions.push(statusBarItem);
```

Codicon names: https://microsoft.github.io/vscode-codicons/dist/codicon.html

---

## Workspace Configuration (Settings)

**Declare in `package.json`:**
```json
"contributes": {
    "configuration": {
        "title": "SC2 Map Tools",
        "properties": {
            "sc2.installDir": {
                "type": "string",
                "default": "",
                "description": "Path to your StarCraft II root folder."
            },
            "sc2.mapPath": {
                "type": "string",
                "default": "",
                "description": "Leave empty to auto-detect from workspace."
            }
        }
    }
}
```

**Read in TypeScript:**
```ts
const ws = vscode.workspace.getConfiguration('sc2');
const installDir = ws.get<string>('installDir', '').trim();
```

**Open settings to a specific key programmatically:**
```ts
vscode.commands.executeCommand('workbench.action.openSettings', 'sc2.installDir');
```

---

## Error & Info Messages

```ts
// Simple info message
vscode.window.showInformationMessage('SC2: Map launched.');

// Error with an action button
vscode.window.showErrorMessage(
    'SC2: Installation folder not configured.',
    'Open Settings',
).then(choice => {
    if (choice === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'sc2.installDir');
    }
});

// Modal warning with confirm button
const choice = await vscode.window.showWarningMessage(
    'SC2 is already running. Kill it and relaunch?',
    { modal: true },
    'Kill & Relaunch',
);
if (choice !== 'Kill & Relaunch') { return; }
```

---

## Debug Configuration Provider (Run & Debug Dropdown Hook)

This is how "SC2: Launch Map" appears in the **Run & Debug** dropdown and responds to F5 **without** attaching a real debugger.

**1. Declare the debug type in `package.json`:**
```json
"contributes": {
    "debuggers": [
        { "type": "sc2", "label": "SC2: Launch Map" }
    ]
}
```

**2. Add a launch config in `.vscode/launch.json`:**
```json
{
    "name": "SC2: Launch Map",
    "type": "sc2",
    "request": "launch"
}
```

**3. Register the provider in `extension.ts`:**
```ts
context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider('sc2', {
        resolveDebugConfiguration(_folder, _config) {
            launcher.launch();
            return undefined; // returning undefined cancels the debug session (no debugger attaches)
        },
    })
);
```

> **Key insight:** Returning `undefined` from `resolveDebugConfiguration` silently cancels the debug session. This means the UI reacts as if you pressed F5 (momentary spinner), but no debugger attaches — only the side effect (`launcher.launch()`) fires.

---

## Activation Events

```json
"activationEvents": ["onStartupFinished"]
```

`onStartupFinished` activates the extension once VS Code is fully loaded. This is the right choice for a status-bar-always-visible extension. Alternatives: `onCommand:sc2.launch` (lazy, but then the status bar never shows on first open).

---

## Workspace Folder Detection

```ts
const folders = vscode.workspace.workspaceFolders ?? [];
const sc2Folder = folders.find(f => f.uri.fsPath.endsWith('.SC2Map'));
const mapPath = sc2Folder?.uri.fsPath ?? folders[0]?.uri.fsPath ?? '';
```

---

## Package.json Minimum Required Fields

```json
{
    "name": "vsc-sc2",
    "displayName": "SC2 Map Tools",
    "version": "0.1.0",
    "publisher": "Playbitstudios",
    "engines": { "vscode": "^1.80.0" },
    "main": "./out/extension.js",
    "activationEvents": ["onStartupFinished"],
    "contributes": { ... }
}
```

The `"publisher"` field is required even for manually-installed extensions — it becomes part of the extension folder name: `<publisher>.<name>-<version>`.
