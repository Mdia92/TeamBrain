# TeamBrain — reset local dev (Windows PowerShell native).
# Usage: .\scripts\dev-clean.ps1

$ErrorActionPreference = "SilentlyContinue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Stop-Port {
    param([int]$Port)
    for ($i = 0; $i -lt 5; $i++) {
        Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Milliseconds 400
    }
}

Write-Host "==> Killing dev servers on ports 3010 and 8010..."
Stop-Port 3010
Stop-Port 8010
Start-Sleep -Seconds 1

Write-Host "==> Removing frontend .next cache..."
Remove-Item -Recurse -Force "$Root\frontend\.next" -ErrorAction SilentlyContinue

Write-Host "==> Removing backend build artifacts..."
Remove-Item -Recurse -Force "$Root\backend\dist", "$Root\backend\build", "$Root\backend\.pytest_cache" -ErrorAction SilentlyContinue

Write-Host "==> Cleaning npm cache..."
Push-Location "$Root\frontend"
npm cache clean --force
Pop-Location

if (-not (Test-Path "$Root\frontend\.env.local")) {
    Write-Host "==> Creating frontend/.env.local from .env.example..."
    Copy-Item "$Root\frontend\.env.example" "$Root\frontend\.env.local"
}

Write-Host "==> Starting backend on http://127.0.0.1:8010 ..."
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$Root\backend'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 127.0.0.1 --port 8010"
) -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "==> Starting frontend on http://localhost:3010 ..."
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$Root\frontend'; npm run dev"
) -WindowStyle Normal

Write-Host ""
Write-Host "App:  http://localhost:3010"
Write-Host "API:  http://127.0.0.1:8010"
Write-Host "Paste scripts/dev-browser-clean.js into DevTools Console, then retry uploads."
