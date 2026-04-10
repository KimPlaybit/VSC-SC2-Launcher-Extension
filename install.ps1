#!/usr/bin/env pwsh
# install.ps1 - Build and install the SC2 extension into VS Code
# Run this after editing src/ to push updates into VS Code (then reload window).

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
$dest = "$env:USERPROFILE\.vscode\extensions\Playbitstudios.vsc-sc2-map-launcher-0.5.0"

Write-Host "[install] Compiling TypeScript..."
Push-Location $scriptDir
yarn compile
Pop-Location

Write-Host "[install] Installing to $dest ..."
New-Item -ItemType Directory -Force "$dest\out" | Out-Null
New-Item -ItemType Directory -Force "$dest\readme-pic" | Out-Null
Copy-Item "$scriptDir\package.json" "$dest\package.json" -Force
Copy-Item "$scriptDir\README.md" "$dest\README.md" -Force
Copy-Item "$scriptDir\out\*.js" "$dest\out\" -Force
Copy-Item "$scriptDir\readme-pic\*" "$dest\readme-pic\" -Force

Write-Host "[install] Done. Reload VS Code window (Ctrl+Shift+P → 'Reload Window') to apply."
