# StarCraft 2 Map Launcher

Launch your StarCraft II map directly from VS Code — no alt-tabbing required.

---

## Features

### Status bar launch button
A `$(run) SC2: Launch Map` button sits in the status bar at all times. One click launches your map.

### Run & Debug integration
The extension registers itself as a debug configuration provider. Open the **Run and Debug** panel and `SC2: Launch Map` appears in the dropdown — no `launch.json` needed.

![Run & Debug dropdown showing SC2 Launcher](https://raw.githubusercontent.com/KimPlaybit/VSC-SC2-Launcher-Extension/master/readme-pic/auto-generated-launch.png)

Press **F5** or click the green play button to launch.

![SC2: Launch Map selected in the Run & Debug panel](https://raw.githubusercontent.com/KimPlaybit/VSC-SC2-Launcher-Extension/master/readme-pic/debug-run.png)

### Advanced launch options via `launch.json`
For full control, add an SC2 configuration to your `.vscode/launch.json`:

```json
{
  "name": "SC2: Launch Map",
  "type": "sc2",
  "request": "launch",
  "triggerDebug": true,
  "speed": 4,
  "showErrors": true,
  "testConfig": "SwarmTest.SC2TestConfig"
}
```

![launch.json with SC2 config options](https://raw.githubusercontent.com/KimPlaybit/VSC-SC2-Launcher-Extension/master/readme-pic/launch-settings.png)

| Option | Type | Description |
|---|---|---|
| `triggerDebug` | boolean | Open the in-game trigger debugger window on launch |
| `showErrors` | boolean | Stream SC2 output to the SC2 Output Channel in VS Code |
| `preload` | boolean | Preload map assets before launching |
| `noUserCheats` | boolean | Disable in-game cheat commands |
| `meleeMod` | string | Game mode/mod override (e.g. `"Void"`) |
| `difficulty` | number | AI difficulty: 0=VeryEasy, 1=Easy, 2=Medium, 3=Hard |
| `speed` | number | Game speed: 0=Slower, 1=Slow, 2=Normal, 3=Fast, 4=Faster |
| `testConfig` | string | Path to a `.SC2TestConfig` file passed as `-testconfig`; accepts an absolute path or a path relative to the workspace root |

### Running SC2 behavior
If StarCraft II is already running when you trigger a launch, the extension kills the existing process and relaunches the map.

Enable `sc2.warnIfRunning` if you want a confirmation dialog before that happens. When this setting is disabled, the extension skips the prompt and immediately kills and relaunches SC2.

### Auto-detects map path
The extension scans your workspace for the first folder ending in `.SC2Map` and uses it as the map path. No configuration needed for standard project layouts.

---

## Setup

1. Open **Settings** (`Ctrl+,`) and search for **SC2**.
2. Set **SC2: Install Dir** to your StarCraft II root folder.

![Settings page showing SC2: Install Dir and SC2: Map Path fields](https://raw.githubusercontent.com/KimPlaybit/VSC-SC2-Launcher-Extension/master/readme-pic/setup.png)

| Setting | Description |
|---|---|
| `sc2.installDir` | **Required.** Path to your StarCraft II root folder (e.g. `C:\StarCraft II`). |
| `sc2.mapPath` | Absolute path to the `.SC2Map` folder. Leave empty to auto-detect from the workspace. |
| `sc2.warnIfRunning` | Show a confirmation dialog before killing a running SC2 instance and relaunching the map. Disable it to skip the prompt and relaunch immediately. |

---

## Requirements

- Windows
- StarCraft II installed
- VS Code >= 1.80