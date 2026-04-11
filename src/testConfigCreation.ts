import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface AttributeEntry {
    attNamespace: number;
    id: number;
    player: number;
    value: string;
}

export interface TestConfigData {
    attributes: AttributeEntry[];
}

function parseAttributesXml(xml: string): TestConfigData | null {
    // Collect all <Variant>…</Variant> blocks
    const variantBlocks: string[] = [];
    const variantRe = /<Variant>([\s\S]*?)<\/Variant>/g;
    let m: RegExpExecArray | null;
    while ((m = variantRe.exec(xml)) !== null) {
        variantBlocks.push(m[1]);
    }
    if (variantBlocks.length === 0) { return null; }

    // Pick variant: single → use it; multiple → prefer <IsDefault/>, else first
    let variant: string;
    if (variantBlocks.length === 1) {
        variant = variantBlocks[0];
    } else {
        variant = variantBlocks.find(v => /<IsDefault\s*\/>/.test(v)) ?? variantBlocks[0];
    }

    // Extract each <Attribute Namespace="…" Id="…">…</Attribute>
    const entries: AttributeEntry[] = [];
    const attrRe = /<Attribute\s+Namespace="(\d+)"\s+Id="(\d+)"[^>]*>([\s\S]*?)<\/Attribute>/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRe.exec(variant)) !== null) {
        const namespace = parseInt(attrMatch[1], 10);
        const attrId    = parseInt(attrMatch[2], 10);
        const body      = attrMatch[3];

        // Each <Default>…</Default> becomes one TestConfig entry
        const defaultRe = /<Default>([\s\S]*?)<\/Default>/g;
        let defMatch: RegExpExecArray | null;
        while ((defMatch = defaultRe.exec(body)) !== null) {
            const def = defMatch[1];

            const slotMatch = /<Slot\s+Id="([^"]+)"\s*\/>/.exec(def);
            const slotId    = slotMatch ? slotMatch[1] : 'Global';
            const player    = slotId === 'Global' ? 16 : parseInt(slotId, 10);

            const valueTag = /<Value\s[^/]*\/>/.exec(def);
            const valueIdAttr = valueTag ? /\bId="(\d+)"/.exec(valueTag[0]) : null;
            const value = valueIdAttr ? valueIdAttr[1] : '0';

            entries.push({
                attNamespace: namespace,
                id: attrId,
                player,
                value,
            });
        }
    }

    return entries.length > 0 ? { attributes: entries } : null;
}

export function generateTestConfigXml(data: TestConfigData): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="utf-8"?>');
    lines.push('<TestConfig>');

    for (const attr of data.attributes) {
        lines.push(
            `    <Attribute AttNamespace="${attr.attNamespace}" Id="${attr.id}" Player="${attr.player}" Value="${attr.value}"/>`,
        );
    }

    lines.push('</TestConfig>');
    return lines.join('\n');
}

export async function createTestConfig(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('SC2: No workspace folder open.');
        return;
    }

    const attributesPath = path.join(workspaceRoot, 'Attributes');
    if (!fs.existsSync(attributesPath)) {
        return; // No Attributes file — nothing to generate
    }

    const data = parseAttributesXml(fs.readFileSync(attributesPath, 'utf-8'));
    if (!data) {
        return; // File exists but yielded no entries
    }

    const fileName = await vscode.window.showInputBox({
        prompt: 'Name for the .SC2TestConfig file (without extension)',
        placeHolder: 'e.g. MyTest',
        validateInput: v => (v.trim() ? undefined : 'Name cannot be empty'),
    });
    if (!fileName) {
        return;
    }

    const outputPath = path.join(workspaceRoot, `${fileName.trim()}.SC2TestConfig`);

    if (fs.existsSync(outputPath)) {
        const overwrite = await vscode.window.showWarningMessage(
            `"${path.basename(outputPath)}" already exists. Overwrite?`,
            { modal: true },
            'Overwrite',
        );
        if (overwrite !== 'Overwrite') {
            return;
        }
    }

    fs.writeFileSync(outputPath, generateTestConfigXml(data), 'utf-8');

    const doc = await vscode.workspace.openTextDocument(outputPath);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(`SC2: Created "${path.basename(outputPath)}".`);
}
