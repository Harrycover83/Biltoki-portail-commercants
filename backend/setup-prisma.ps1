# PowerShell script to setup Prisma database configuration
# This guides you through getting DATABASE_URL from Supabase and running migrations

Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           PRISMA DATABASE SETUP - FOLLOW THESE STEPS            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host ""
Write-Host "STEP 1: Get CONNECTION STRING from Supabase" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────" -ForegroundColor Gray
Write-Host @"
1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project
3. Go to "Project Settings" → Database
4. Look for "Connection Pooler" section
5. Copy the "Session pooler" or "Connection pooler" URI (PostgreSQL)
   It should look like:
   postgresql://postgres.[YOUR-ID]:YOUR_PASSWORD@[YOUR-ID].pooler.supabase.com:6543/postgres

6. IMPORTANT: Replace [YOUR-PASSWORD] if it's not visible
   Look for "Reset database password" link in the same area
"@ -ForegroundColor White

Write-Host ""
Write-Host "STEP 2: Set DATABASE_URL in backend/.env.local" -ForegroundColor Yellow
Write-Host "───────────────────────────────────────────────" -ForegroundColor Gray
Write-Host "Paste your connection string below:" -ForegroundColor White
$dbUrl = Read-Host "DATABASE_URL"

if ($dbUrl -eq "") {
    Write-Host "❌ DATABASE_URL cannot be empty" -ForegroundColor Red
    exit 1
}

# Update .env.local in backend folder
$envPath = ".\backend\.env.local"
if (Test-Path $envPath) {
    $content = Get-Content $envPath -Raw
    $content = $content -replace '^DATABASE_URL=.*$', "DATABASE_URL=$dbUrl"
    Set-Content $envPath -Value $content -Encoding UTF8
    Write-Host "✅ DATABASE_URL saved to backend/.env.local" -ForegroundColor Green
} else {
    Write-Host "❌ File not found: $envPath" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "STEP 3: Run Prisma Migrations" -ForegroundColor Yellow
Write-Host "──────────────────────────────" -ForegroundColor Gray
Write-Host "This will:" -ForegroundColor White
Write-Host "  • Create initial migration from schema.prisma"
Write-Host "  • Apply migration to your database"
Write-Host "  • Generate Prisma Client"
Write-Host "  • Run seed script (auto-creates 10 Biltoki halls)"

Write-Host ""
$confirm = Read-Host "Ready to run migrations? (yes/no)"

if ($confirm -ne "yes" -and $confirm -ne "y") {
    Write-Host "⏸️  Cancelled. You can run this manually later:" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor Gray
    Write-Host "   npm run prisma:migrate" -ForegroundColor Gray
    exit 0
}

Write-Host ""
Write-Host "Running: npm run prisma:migrate" -ForegroundColor Cyan
Set-Location ./backend

$env:DATABASE_URL = $dbUrl
npm run prisma:migrate

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║              ✅ DATABASE SETUP COMPLETE!                         ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "───────────" -ForegroundColor Gray
    Write-Host "1. Get HALLS_TO_SYNC value from seed script output (search for 'HALLS_TO_SYNC=')"
    Write-Host "2. Update Railway environment variables:"
    Write-Host "   • DATABASE_URL: same connection string"
    Write-Host "   • HALLS_TO_SYNC: copy from seed output"
    Write-Host ""
    Write-Host "3. View your database with Prisma Studio:"
    Write-Host "   npm run prisma:studio" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. Deploy to Railway and enjoy! 🚀" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Migration failed. Check error messages above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "• Incorrect DATABASE_URL (typo, wrong password)"
    Write-Host "• Network issue (firewall? VPN?)"
    Write-Host "• Supabase project not ready yet"
    Write-Host ""
    Write-Host "How to fix:" -ForegroundColor Cyan
    Write-Host "1. Verify DATABASE_URL in backend/.env.local"
    Write-Host "2. Test connection: psql '<YOUR_DATABASE_URL>'"
    Write-Host "3. Try again: npm run prisma:migrate"
    exit 1
}
