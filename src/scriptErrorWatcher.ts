import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseScriptErrors } from './errorParser';

const DEFAULT_GAMELOGS_PATH = path.join(
    os.homedir(), 'Documents', 'StarCraft II', 'GameLogs',
);

function getGameLogsPath(): string {
    const configured = vscode.workspace.getConfiguration('sc2').get<string>('gameLogsPath', '').trim();
    return configured || DEFAULT_GAMELOGS_PATH;
}

const SCRIPT_ERROR_RE = /ScriptError\.txt$/i;
const ALERTS_RE       = /Alerts\.txt$/i;

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Stop watching after 90 s. */
const WATCH_TIMEOUT_MS = 90_000;

/**
 * Watches the SC2 GameLogs folder for new ScriptError*.txt and *Alerts.txt
 * files that did NOT exist when `start()` was called (i.e. created by this
 * particular launch).
 *
 * - ScriptError*.txt  → Galaxy compile errors  → surfaced as Error diagnostics,
 *                       jumps to error location if the file is open.
 * - *Alerts.txt       → Runtime UI/asset errors → surfaced as Warning diagnostics
 *                       against the map path.
 */
export class ScriptErrorWatcher {

    private watcher: fs.FSWatcher | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;

    /** Files that existed in GameLogs BEFORE this launch — never process these. */
    private readonly preExisting = new Set<string>();

    /** Guard against processing the same new file twice. */
    private readonly processed = new Set<string>();

    /** Once a ScriptError is found we stop watching (compile failed). */
    private compileErrorFound = false;

    constructor(
        private readonly mapPath: string,
        private readonly diagnostics: vscode.DiagnosticCollection,
        private readonly output: vscode.OutputChannel,
    ) {}

    start(): void {
        const GAMELOGS_PATH = getGameLogsPath();
        // Snapshot every matching file that already exists
        if (fs.existsSync(GAMELOGS_PATH)) {
            try {
                for (const name of fs.readdirSync(GAMELOGS_PATH)) {
                    if (SCRIPT_ERROR_RE.test(name) || ALERTS_RE.test(name)) {
                        this.preExisting.add(name);
                    }
                }
            } catch { /* ignore read errors */ }
        } else {
            return; // No GameLogs folder — nothing to watch
        }

        this.output.appendLine(
            `[SC2 Watcher] Watching: ${GAMELOGS_PATH}` +
            ` (${this.preExisting.size} pre-existing file${this.preExisting.size !== 1 ? 's' : ''} ignored)`,
        );

        // Capture resolved path for use in callbacks (closures)
        const gameLogsPath = GAMELOGS_PATH;

        try {
            this.watcher = fs.watch(gameLogsPath, (_event, filename) => {
                if (!filename) return;
                if (this.preExisting.has(filename)) return;    // pre-launch file
                if (this.processed.has(filename)) return;      // already handled
                if (this.compileErrorFound) return;            // compile failed — stop

                if (SCRIPT_ERROR_RE.test(filename)) {
                    this.output.appendLine(`[SC2 Watcher] New file detected: ${filename}`);
                    // Give SC2 a moment to finish writing
                    setTimeout(() => this.handleScriptError(filename, gameLogsPath), 300);
                } else if (ALERTS_RE.test(filename)) {
                    this.output.appendLine(`[SC2 Watcher] New file detected: ${filename}`);
                    setTimeout(() => this.handleAlerts(filename, gameLogsPath), 300);
                }
            });
        } catch {
            return; // Watch failed (e.g. permissions)
        }

        this.timer = setTimeout(() => {
            this.output.appendLine('[SC2 Watcher] Timeout — no new error files detected.');
            this.dispose();
        }, WATCH_TIMEOUT_MS);
    }

    // -------------------------------------------------------------------------

    private handleScriptError(filename: string, gameLogsPath: string): void {
        if (this.compileErrorFound || this.processed.has(filename)) return;
        if (this.preExisting.has(filename)) return;

        const filePath = path.join(gameLogsPath, filename);
        if (!fs.existsSync(filePath)) return;

        this.processed.add(filename);
        this.compileErrorFound = true;
        this.dispose(); // Stop watching — compile failed, no point continuing

        this.output.appendLine(`[SC2 Watcher] Processing ScriptError: ${filename}`);

        let content: string;
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch {
            return;
        }

        this.diagnostics.clear();

        const errors = parseScriptErrors(content, this.mapPath);

        if (errors.length > 0) {
            this.output.appendLine(`[SC2 Watcher] Found ${errors.length} script error${errors.length !== 1 ? 's' : ''}.`);
            const byFile = new Map<string, vscode.Diagnostic[]>();
            for (const { file, diagnostic } of errors) {
                const key = file || '\0';
                if (!byFile.has(key)) byFile.set(key, []);
                byFile.get(key)!.push(diagnostic);
            }

            const entries: Array<[vscode.Uri, vscode.Diagnostic[]]> = [];
            let firstUri: vscode.Uri | undefined;
            let firstDiag: vscode.Diagnostic | undefined;

            for (const [file, diags] of byFile) {
                const uri = file !== '\0'
                    ? vscode.Uri.file(file)
                    : vscode.Uri.file(this.mapPath);
                entries.push([uri, diags]);
                if (!firstUri && file !== '\0') {
                    firstUri = uri;
                    firstDiag = diags[0];
                }
            }

            this.diagnostics.set(entries);

            if (firstUri && firstDiag) {
                vscode.workspace.openTextDocument(firstUri).then(doc =>
                    vscode.window.showTextDocument(doc, {
                        selection: firstDiag!.range,
                        preserveFocus: false,
                    }),
                );
            }

            vscode.commands.executeCommand('workbench.actions.view.problems');
            vscode.window.showErrorMessage(
                `SC2: ${errors.length} script error${errors.length !== 1 ? 's' : ''} found. See Problems panel.`,
            );
        } else {
            // No structured compile errors — try "Script load failed:" lines
            const loadFailed = content.match(/^Script load failed:.+$/gm) ?? [];
            const message = loadFailed.length > 0
                ? loadFailed.join('\n')
                : 'Unknown SC2 script error — check ScriptError.txt in GameLogs.';

            this.output.appendLine(`[SC2 Watcher] No structured errors parsed — surfacing raw message.`);

            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                message,
                vscode.DiagnosticSeverity.Error,
            );
            this.diagnostics.set([[vscode.Uri.file(this.mapPath), [diag]]]);
            vscode.commands.executeCommand('workbench.actions.view.problems');
            vscode.window.showErrorMessage('SC2: Script error detected. See Problems panel.');
        }
    }

    private handleAlerts(filename: string, gameLogsPath: string): void {
        if (this.processed.has(filename)) return;
        if (this.preExisting.has(filename)) return;

        const filePath = path.join(gameLogsPath, filename);
        if (!fs.existsSync(filePath)) return;

        this.processed.add(filename);

        this.output.appendLine(`[SC2 Watcher] Processing Alerts: ${filename}`);

        let content: string;
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch {
            return;
        }

        // All lines are prefixed with "USER  0  0.000  0.063 <message>".
        // The file starts with a header block enclosed by two ==== separators.
        // Strip everything up to and including the last separator so we only
        // process the actual error messages below it.
        const sepIdx = content.lastIndexOf('====');
        const body = sepIdx >= 0 ? content.slice(sepIdx) : content;

        const lineRe = /^USER\s+\d+\s+[\d.]+\s+[\d.]+\s+(.+)$/gm;
        const messages: string[] = [];

        let match: RegExpExecArray | null;
        while ((match = lineRe.exec(body)) !== null) {
            const message = match[1].trim();
            if (!message || message.startsWith('=')) continue;
            messages.push(message);
        }

        if (messages.length === 0) {
            this.output.appendLine('[SC2 Watcher] Alerts file was empty or unparseable.');
            return;
        }

        this.output.appendLine(`[SC2 Watcher] Found ${messages.length} alert${messages.length !== 1 ? 's' : ''} — resolving locations...`);

        // Async: search workspace files for entity names, then post diagnostics
        this.resolveAndPostAlerts(messages).catch(() => {
            // Fallback: post all against the map path
            const mapUri = vscode.Uri.file(this.mapPath);
            const diags = messages.map(msg => new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                msg,
                vscode.DiagnosticSeverity.Warning,
            ));
            const existing = this.diagnostics.get(mapUri) ?? [];
            this.diagnostics.set([[mapUri, [...existing, ...diags]]]);
            vscode.commands.executeCommand('workbench.actions.view.problems');
        });
    }

    /**
     * For each alert message, extract the entity name in single-quotes and
     * search workspace files for it. Groups diagnostics by the file where the
     * entity was found (falls back to mapPath when not found).
     */
    private async resolveAndPostAlerts(messages: string[]): Promise<void> {
        const entityRe = /'(\w+)'/;

        // Collect unique entity names
        const entityNames = new Set<string>();
        for (const msg of messages) {
            const m = entityRe.exec(msg);
            if (m) entityNames.add(m[1]);
        }

        // Scan workspace files once, building entityName → {uri, line} index.
        // Search order: XML first (authoritative data), then other types.
        // Use exact word-boundary matching so "Cyclone" doesn't hit "CycloneWeapon".
        const entityLocations = new Map<string, { uri: vscode.Uri; line: number }>();
        if (entityNames.size > 0) {
            const xmlFiles   = await vscode.workspace.findFiles(
                '**/*.xml',
                '{**/node_modules/**,**/GameLogs/**}',
            );
            const otherFiles = await vscode.workspace.findFiles(
                '**/*.{galaxy,SC2Interface,txt}',
                '{**/node_modules/**,**/GameLogs/**}',
            );
            // XML searched first so it can override lower-priority matches
            const allFiles = [...xmlFiles, ...otherFiles];

            this.output.appendLine(`[SC2 Watcher] Searching ${allFiles.length} workspace files for ${entityNames.size} entity name${entityNames.size !== 1 ? 's' : ''}...`);

            for (const fileUri of allFiles) {
                if (entityLocations.size === entityNames.size) break; // found all

                let fileContent: string;
                try {
                    fileContent = fs.readFileSync(fileUri.fsPath, 'utf8');
                } catch {
                    continue;
                }

                const lines = fileContent.split('\n');
                for (const name of entityNames) {
                    // Only promote to XML match if not already found in XML
                    const existing = entityLocations.get(name);
                    const isXml = fileUri.fsPath.toLowerCase().endsWith('.xml');
                    if (existing && (isXml || !xmlFiles.some(f => f.toString() === existing.uri.toString()))) {
                        if (!isXml) continue; // already have an XML hit, skip non-XML
                    }

                    // Exact word-boundary match: name must not be preceded/followed by \w
                    const exactRe = new RegExp(`(?<![\\w])${escapeRegex(name)}(?![\\w])`);
                    const lineIdx = lines.findIndex(l => exactRe.test(l));
                    if (lineIdx >= 0) {
                        if (!existing || isXml) {
                            entityLocations.set(name, { uri: fileUri, line: lineIdx });
                        }
                    }
                }
            }

            this.output.appendLine(`[SC2 Watcher] Located ${entityLocations.size}/${entityNames.size} entities in workspace files.`);
        }

        // Build diagnostics grouped by target file URI
        const mapUri = vscode.Uri.file(this.mapPath);
        const byUri = new Map<string, { uri: vscode.Uri; diags: vscode.Diagnostic[] }>();

        const addDiag = (uri: vscode.Uri, diag: vscode.Diagnostic) => {
            const key = uri.toString();
            if (!byUri.has(key)) byUri.set(key, { uri, diags: [] });
            byUri.get(key)!.diags.push(diag);
        };

        for (const msg of messages) {
            const m = entityRe.exec(msg);
            const loc = m ? entityLocations.get(m[1]) : undefined;
            const uri  = loc ? loc.uri  : mapUri;
            const line = loc ? loc.line : 0;
            addDiag(uri, new vscode.Diagnostic(
                new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
                msg,
                vscode.DiagnosticSeverity.Warning,
            ));
        }

        // Merge with existing diagnostics (e.g. ScriptErrors on the map URI)
        const existingOnMap = [...(this.diagnostics.get(mapUri) ?? [])];
        const entries: Array<[vscode.Uri, vscode.Diagnostic[]]> = [];
        for (const { uri, diags } of byUri.values()) {
            if (uri.toString() === mapUri.toString()) {
                entries.push([uri, [...existingOnMap, ...diags]]);
            } else {
                entries.push([uri, diags]);
            }
        }
        // Keep any existing map diagnostics even if no alerts landed there
        if (!byUri.has(mapUri.toString()) && existingOnMap.length > 0) {
            entries.push([mapUri, existingOnMap]);
        }

        this.diagnostics.set(entries);
        vscode.commands.executeCommand('workbench.actions.view.problems');
        vscode.window.showWarningMessage(
            `SC2: ${messages.length} runtime warning${messages.length !== 1 ? 's' : ''} found. See Problems panel.`,
        );
    }

    dispose(): void {
        this.watcher?.close();
        this.watcher = undefined;
        if (this.timer !== undefined) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }
}
