$root = $PSScriptRoot
$readmePath = Join-Path $root "README.md"

function b64($name) {
    $bytes = [IO.File]::ReadAllBytes((Join-Path $root "readme-pic\$name.png"))
    "data:image/png;base64," + [Convert]::ToBase64String($bytes)
}

$readme = [IO.File]::ReadAllText($readmePath, [Text.Encoding]::UTF8)

$readme = $readme.Replace("readme-pic/auto-generated-launch.png", (b64 "auto-generated-launch"))
$readme = $readme.Replace("readme-pic/debug-run.png",              (b64 "debug-run"))
$readme = $readme.Replace("readme-pic/launch-settings.png",        (b64 "launch-settings"))
$readme = $readme.Replace("readme-pic/setup.png",                  (b64 "setup"))

[IO.File]::WriteAllText($readmePath, $readme, [Text.Encoding]::UTF8)
Write-Host "Done. README.md is now $(([IO.FileInfo]$readmePath).Length / 1KB) KB"

