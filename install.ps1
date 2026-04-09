#!/usr/bin/env pwsh
# install.ps1 - Build and install the SC2 extension into VS Code
# Run this after editing src/ to push updates into VS Code (then reload window).

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$dest = "$env:USERPROFILE\.vscode\extensions\sc2-dev.vsc-sc2-0.1.0"

Write-Host "[install] Compiling TypeScript..."
Push-Location $scriptDir
yarn compile
Pop-Location

Write-Host "[install] Installing to $dest ..."
New-Item -ItemType Directory -Force "$dest\out" | Out-Null
Copy-Item "$scriptDir\package.json" "$dest\package.json" -Force
Copy-Item "$scriptDir\out\*.js" "$dest\out\" -Force

Write-Host "[install] Done. Reload VS Code window (Ctrl+Shift+P → 'Reload Window') to apply."
