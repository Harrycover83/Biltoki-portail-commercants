# ASCII-only script for Prisma setup on Windows PowerShell.
# Safe with code pages that do not handle Unicode bullets/arrows.

$ErrorActionPreference = "Stop"

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "        PRISMA DATABASE SETUP - BILTOKI BACKEND" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: Get DATABASE_URL from Supabase" -ForegroundColor Yellow
Write-Host "1) Open: https://app.supabase.com" -ForegroundColor White
Write-Host "2) Project Settings -> Database" -ForegroundColor White
Write-Host "3) Copy Connection Pooler URI (PostgreSQL)" -ForegroundColor White
Write-Host "4) Ensure password is present in URL" -ForegroundColor White
Write-Host ""

$dbUrl = Read-Host "Paste DATABASE_URL"
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    Write-Host "ERROR: DATABASE_URL is empty." -ForegroundColor Red
    exit 1
}

# Resolve backend directory from this script location.
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $backendDir ".env.local"

if (Test-Path $envPath) {
    $content = Get-Content $envPath -Raw
    if ($content -match "(?m)^DATABASE_URL=") {
        $content = [regex]::Replace($content, "(?m)^DATABASE_URL=.*$", "DATABASE_URL=$dbUrl")
    } else {
        $content = "DATABASE_URL=$dbUrl`r`n" + $content
    }
} else {
    $content = "DATABASE_URL=$dbUrl`r`n"
}

Set-Content -Path $envPath -Value $content -Encoding UTF8
Write-Host "OK: Updated $envPath" -ForegroundColor Green
Write-Host ""

$confirm = Read-Host "Run Prisma migration now? (yes/no)"
if ($confirm -ne "yes" -and $confirm -ne "y") {
    Write-Host "Cancelled. Run manually:" -ForegroundColor Yellow
    Write-Host "cd backend" -ForegroundColor Gray
    Write-Host "npm run prisma:migrate" -ForegroundColor Gray
    exit 0
}

Push-Location $backendDir
try {
    $env:DATABASE_URL = $dbUrl
    Write-Host "Running: npm run prisma:migrate" -ForegroundColor Cyan
    npm run prisma:migrate

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: prisma migrate failed." -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "OK: Prisma migration completed." -ForegroundColor Green
    Write-Host "Next: run 'npm run prisma:seed' if not already triggered." -ForegroundColor White
    Write-Host "Then copy HALLS_TO_SYNC from seed output to Railway env." -ForegroundColor White
}
finally {
    Pop-Location
}
