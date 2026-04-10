import * as vscode from 'vscode';
import { SC2Launcher, LaunchOptions } from './sc2Compiler';

let statusBarItem: vscode.StatusBarItem;
let launcher: SC2Launcher;

export function activate(context: vscode.ExtensionContext): void {
    launcher = new SC2Launcher();

    // ── Status bar button ─────────────────────────────────────────────────────
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100,
    );
    statusBarItem.command = 'sc2.launch';
    statusBarItem.text = '$(run) SC2: Launch Map';
    statusBarItem.tooltip = 'Launch the SC2 map in StarCraft II';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // ── Commands ──────────────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('sc2.launch', () => {
            const opts = getLaunchOptsFromConfig();
            launcher.launch(opts);
        }),
    );

    // ── Debug provider — hooks "SC2: Launch Map" in the Run & Debug dropdown ──
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('sc2', {
            resolveDebugConfiguration(_folder, config) {
                const cfg = config as any;
                const opts: LaunchOptions = {
                    triggerDebug: cfg.triggerDebug === true,
                    showErrors:   cfg.showErrors   === true,
                    preload:      cfg.preload,
                    noUserCheats: cfg.noUserCheats,
                    meleeMod:     cfg.meleeMod,
                    difficulty:   cfg.difficulty,
                    speed:        cfg.speed,
                    testConfig:   cfg.testConfig,
                };
                launcher.launch(opts);
                return undefined; // returning undefined cancels the debug session (no debugger attaches)
            },
        }),
    );
}

export function deactivate(): void {}

function getLaunchOptsFromConfig(): LaunchOptions {
    const launchConfigs = vscode.workspace
        .getConfiguration('launch')
        .get<any[]>('configurations', []);

    const sc2Config = launchConfigs.find(c => c.type === 'sc2') ?? {};

    return {
        triggerDebug: sc2Config.triggerDebug === true,
        showErrors:   sc2Config.showErrors   === true,
        preload:      sc2Config.preload,
        noUserCheats: sc2Config.noUserCheats,
        meleeMod:     sc2Config.meleeMod,
        difficulty:   sc2Config.difficulty,
        speed:        sc2Config.speed,
        testConfig:   sc2Config.testConfig,
    };
}
