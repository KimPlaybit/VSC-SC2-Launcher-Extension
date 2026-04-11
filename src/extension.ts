import * as vscode from 'vscode';
import { SC2Launcher, LaunchOptions } from './sc2Compiler';

let statusBarItem: vscode.StatusBarItem;
let launcher: SC2Launcher;

export function activate(context: vscode.ExtensionContext): void {
    const diagnostics = vscode.languages.createDiagnosticCollection('sc2');
    context.subscriptions.push(diagnostics);
    launcher = new SC2Launcher(diagnostics);

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

    // ── Clear diagnostics on edited lines ────────────────────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const uri = event.document.uri;
            const existing = diagnostics.get(uri);
            if (!existing || existing.length === 0) return;

            const changedLines = new Set(event.contentChanges.flatMap(c => {
                const lines: number[] = [];
                for (let l = c.range.start.line; l <= c.range.end.line; l++) lines.push(l);
                return lines;
            }));

            const remaining = existing.filter(
                d => !changedLines.has(d.range.start.line),
            );

            if (remaining.length !== existing.length) {
                diagnostics.set(uri, remaining);
            }
        }),
    );

    // ── Debug provider — hooks the Run & Debug dropdown ──────────────────────
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('sc2', {
            resolveDebugConfiguration(_folder, config) {
                launcher.launch(optsFromDebugConfig(config as any));
                return undefined;
            },
        }),
    );
}

export function deactivate(): void {}

function optsFromDebugConfig(cfg: any): LaunchOptions {
    return {
        map:          cfg.map,
        triggerDebug: cfg.triggerDebug === true,
        showErrors:   cfg.showErrors   === true,
        preload:      cfg.preload,
        noUserCheats: cfg.noUserCheats,
        reloadCheck:  cfg.reloadCheck  === true,
        meleeMod:     cfg.meleeMod,
        difficulty:   cfg.difficulty,
        speed:        cfg.speed,
        testMod:      cfg.testMod,
        testConfig:   cfg.testConfig,
    };
}

function getLaunchOptsFromConfig(): LaunchOptions {
    const launchConfigs = vscode.workspace
        .getConfiguration('launch')
        .get<any[]>('configurations', []);

    const sc2Config = launchConfigs.find(c => c.type === 'sc2') ?? {};

    return {
        map:          sc2Config.map,
        triggerDebug: sc2Config.triggerDebug === true,
        showErrors:   sc2Config.showErrors   === true,
        preload:      sc2Config.preload,
        noUserCheats: sc2Config.noUserCheats,
        reloadCheck:  sc2Config.reloadCheck  === true,
        meleeMod:     sc2Config.meleeMod,
        difficulty:   sc2Config.difficulty,
        speed:        sc2Config.speed,
        testMod:      sc2Config.testMod,
        testConfig:   sc2Config.testConfig,
    };
}
