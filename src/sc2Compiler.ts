import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SC2Config {
    switcherPath: string;
    sc2WorkDir: string;
    mapPath: string;
}

export interface LaunchOptions {
    triggerDebug?: boolean;
    showErrors?: boolean;
    preload?: boolean;
    noUserCheats?: boolean;
    meleeMod?: string;
    difficulty?: number;
    speed?: number;
}

export class SC2Launcher {

    private outputChannel: vscode.OutputChannel | undefined;

    async launch(opts: LaunchOptions = {}): Promise<void> {
        const cfg = this.resolveConfig();
        if (!cfg) {
            return;
        }

        const already = await this.isProcessRunning('SC2_x64.exe');
        if (already) {
            const warnIfRunning = vscode.workspace.getConfiguration('sc2').get<boolean>('warnIfRunning', true);
            if (warnIfRunning) {
                const choice = await vscode.window.showWarningMessage(
                    'SC2 is already running. Kill it and relaunch?',
                    { modal: true },
                    'Kill & Relaunch',
                );
                if (choice !== 'Kill & Relaunch') {
                    return;
                }
            }
            await this.killSC2();
        }

        this.spawnSC2(cfg, opts);
        vscode.window.showInformationMessage('SC2: Map launched.');
    }

    // -------------------------------------------------------------------------

    private resolveConfig(): SC2Config | undefined {
        const ws = vscode.workspace.getConfiguration('sc2');

        const installDir = ws.get<string>('installDir', '').trim();
        if (!installDir) {
            vscode.window.showErrorMessage(
                'SC2: Installation folder not configured. ' +
                'Set "SC2: Install Dir" in Settings to your StarCraft II root folder.',
                'Open Settings',
            ).then(choice => {
                if (choice === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'sc2.installDir');
                }
            });
            return undefined;
        }

        const switcherPath = path.join(installDir, 'Support64', 'SC2Switcher_x64.exe');
        if (!fs.existsSync(switcherPath)) {
            vscode.window.showErrorMessage(
                `SC2: SC2Switcher_x64.exe not found at "${switcherPath}". ` +
                'Make sure sc2.installDir points to the StarCraft II root folder.',
                'Open Settings',
            ).then(choice => {
                if (choice === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'sc2.installDir');
                }
            });
            return undefined;
        }

        let mapPath = ws.get<string>('mapPath', '').trim();
        if (!mapPath) {
            const folders = vscode.workspace.workspaceFolders ?? [];
            const sc2Folder = folders.find(f => f.uri.fsPath.endsWith('.SC2Map'));
            mapPath = sc2Folder?.uri.fsPath ?? folders[0]?.uri.fsPath ?? '';
        }
        if (!mapPath) {
            vscode.window.showErrorMessage(
                'SC2: Cannot determine the map path. Set sc2.mapPath in Settings.',
            );
            return undefined;
        }

        return { switcherPath, sc2WorkDir: installDir, mapPath };
    }

    private spawnSC2(cfg: SC2Config, opts: LaunchOptions): void {
        const args = ['-run', cfg.mapPath];

        if (opts.preload ?? true) {
            args.push('-preload', '1');
        }
        if (opts.noUserCheats ?? true) {
            args.push('-NoUserCheats');
        }
        args.push('-meleeMod', opts.meleeMod ?? 'Void');
        args.push('-difficulty', String(opts.difficulty ?? 2));
        args.push('-speed', String(opts.speed ?? 2));
        args.push('-displaymode', opts.triggerDebug ? '0' : '1');

        if (opts.triggerDebug) {
            args.push('-TrigDebug');
        }

        const stdio = opts.showErrors ? 'pipe' : 'ignore';
        const proc = cp.spawn(cfg.switcherPath, args, {
            detached: true,
            cwd: cfg.sc2WorkDir,
            stdio: ['ignore', stdio, stdio],
        });

        if (opts.showErrors) {
            if (!this.outputChannel) {
                this.outputChannel = vscode.window.createOutputChannel('SC2');
            }
            this.outputChannel.clear();
            this.outputChannel.show(true);
            proc.stdout?.on('data', (d: { toString(): string }) => this.outputChannel!.append(d.toString()));
            proc.stderr?.on('data', (d: { toString(): string }) => this.outputChannel!.append(d.toString()));
        }

        proc.unref();
    }

    private killSC2(): Promise<void> {
        return new Promise(resolve => {
            cp.exec('taskkill /IM SC2_x64.exe /F', () => setTimeout(resolve, 1_000));
        });
    }

    private isProcessRunning(name: string): Promise<boolean> {
        return new Promise(resolve => {
            cp.exec(
                `tasklist /FI "IMAGENAME eq ${name}" /FO CSV /NH`,
                (_, stdout) => resolve(stdout.toLowerCase().includes(name.toLowerCase())),
            );
        });
    }
}
