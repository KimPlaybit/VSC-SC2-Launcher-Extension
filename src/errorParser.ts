import * as vscode from 'vscode';
import * as path from 'path';

export interface ParsedError {
    /** Absolute path to the galaxy file. */
    file: string;
    diagnostic: vscode.Diagnostic;
}

/**
 * Extract structured compile errors from a ScriptError.txt file.
 *
 * Lines look like:
 *   Script compile error: scripts/foo.galaxy (42), Some message here.
 *
 * Lines without a file/line ("Script load failed: Function not found") are
 * returned with `file` set to an empty string so callers can handle them
 * separately.
 */
export function parseScriptErrors(content: string, mapPath: string): ParsedError[] {
    const results: ParsedError[] = [];

    // Match: Script compile error: <path> (<line>), <message>
    const linePattern = /^Script compile error:\s+(.+?)\s+\((\d+)\),\s+(.+)$/gm;

    let match: RegExpExecArray | null;
    while ((match = linePattern.exec(content)) !== null) {
        const [, relFile, lineStr, message] = match;
        const lineNum = Math.max(0, parseInt(lineStr, 10) - 1); // convert to 0-based

        const absFile = path.isAbsolute(relFile)
            ? relFile
            : path.join(mapPath, relFile);

        const range = new vscode.Range(
            new vscode.Position(lineNum, 0),
            new vscode.Position(lineNum, Number.MAX_SAFE_INTEGER),
        );

        results.push({
            file: absFile,
            diagnostic: new vscode.Diagnostic(
                range,
                message.trim(),
                vscode.DiagnosticSeverity.Error,
            ),
        });
    }

    return results;
}
