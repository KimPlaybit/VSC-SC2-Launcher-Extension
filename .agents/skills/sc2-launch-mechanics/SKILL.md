---
name: sc2-launch-mechanics
description: Everything about launching StarCraft II outside the editor — SC2Switcher_x64.exe, its CLI arguments, process detection, kill/relaunch, and the path derivation from sc2.installDir. Use when modifying launch behavior, adding new CLI args, or changing how the switcher is located. Do not use for VS Code API patterns (use vsc-extension-api) or build tooling (use build-and-install).
---

# SC2 Launch Mechanics

## How SC2 Launches Outside the Editor

StarCraft II cannot be compiled from an external process — the editor's compile pipeline is internal and not exposed via CLI.

**What does work:** Launching a precompiled `.SC2Map` folder via `SC2Switcher_x64.exe`. The switcher acts as a proxy launcher — it reads the `-run` argument, starts `SC2_x64.exe`, and passes the map to it.

---

## Launcher Path Derivation

The user sets `sc2.installDir` to their SC2 root (e.g. `C:\Program Files (x86)\StarCraft II`).

The switcher is always at a fixed relative path:

```ts
const switcherPath = path.join(installDir, 'Support64', 'SC2Switcher_x64.exe');
```

Validate it exists before spawning:
```ts
if (!fs.existsSync(switcherPath)) {
    // show error
}
```

---

## CLI Arguments

```
SC2Switcher_x64.exe -run <mapPath> -preload 1 -NoUserCheats -meleeMod Void -difficulty 2 -speed 2 -displaymode 1
```

| Flag | Value | Meaning |
|---|---|---|
| `-run` | `<path to .SC2Map folder>` | Map to load. Must be the `.SC2Map` folder, **not** `.SC2Components`. |
| `-preload` | `1` | Preload assets before launching. |
| `-NoUserCheats` | *(flag)* | Disables in-game cheat commands. |
| `-meleeMod` | `Void` | Sets the game mode/mod (`Void` = LotV melee). |
| `-difficulty` | `2` | AI difficulty (0–3). |
| `-speed` | `2` | Game speed (0=Slower, 1=Slow, 2=Normal, 3=Fast, 4=Faster). |
| `-displaymode` | `1` | 0=windowed, 1=fullscreen. |

> **Important:** Pass the `.SC2Map` folder (e.g. `C:\map\SwarmComponents.SC2Map`) as the `-run` target. `.SC2Components` is a metadata file format and is not a valid `-run` target.

---

## Spawning the Process

```ts
import * as cp from 'child_process';

const args = [
    '-run', cfg.mapPath,
    '-preload', '1',
    '-NoUserCheats',
    '-meleeMod', 'Void',
    '-difficulty', '2',
    '-speed', '2',
    '-displaymode', '1',
];

const proc = cp.spawn(cfg.switcherPath, args, {
    detached: true,       // VS Code does not own the process
    cwd: cfg.sc2WorkDir,  // SC2 install root (not the map folder)
    stdio: 'ignore',      // don't inherit VS Code's stdio handles
});
proc.unref();             // let VS Code exit without waiting for this process
```

Key points:
- `detached: true` — SC2 keeps running if VS Code closes.
- `stdio: 'ignore'` — prevents the child from holding VS Code's handles open.
- `proc.unref()` — removes the process from the Node event loop reference count.
- `cwd` should be the SC2 install root, not the map path.

---

## Detecting If SC2 Is Already Running

Uses Windows `tasklist`:

```ts
function isProcessRunning(name: string): Promise<boolean> {
    return new Promise(resolve => {
        cp.exec(
            `tasklist /FI "IMAGENAME eq ${name}" /FO CSV /NH`,
            (_, stdout) => resolve(stdout.toLowerCase().includes(name.toLowerCase())),
        );
    });
}

const already = await isProcessRunning('SC2_x64.exe');
```

---

## Killing SC2

Uses Windows `taskkill`:

```ts
function killSC2(): Promise<void> {
    return new Promise(resolve => {
        cp.exec('taskkill /IM SC2_x64.exe /F', () => setTimeout(resolve, 1_000));
    });
}
```

The 1 second delay after `taskkill` gives the OS time to fully release file handles before relaunching.

---

## Map Path Auto-Detection

If the user hasn't set `sc2.mapPath`, the extension picks the first workspace folder whose path ends in `.SC2Map`:

```ts
const folders = vscode.workspace.workspaceFolders ?? [];
const sc2Folder = folders.find(f => f.uri.fsPath.endsWith('.SC2Map'));
mapPath = sc2Folder?.uri.fsPath ?? folders[0]?.uri.fsPath ?? '';
```

For a workspace opened on `C:\map\SwarmComponents.SC2Map`, this resolves to that folder directly.

---

## Known Dead Ends (Compile Approach)

These approaches were researched and confirmed **not viable**:

| Approach | Result |
|---|---|
| `SC2Editor.exe -compile <map>` | No `-compile` flag exists; editor ignores unknown flags |
| `SC2Editor.exe <map>` | Opens the editor UI, does not headlessly compile |
| Watching for `ScriptError.txt` | File exists but is only written by the editor UI during its own compile run — cannot trigger it externally |
| GalaxyBuild (community tool) | Does not interface with the official editor pipeline; limited utility |

**Conclusion:** There is no way to trigger Galaxy script compilation outside the SC2 editor. The only viable external action is launching an already-saved/compiled `.SC2Map`.
