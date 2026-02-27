# This script prepares the standalone build and zips it for cPanel upload.
# Optimized for Hostico environment: Excludes media, includes hidden styles, uses relative paths.
$ErrorActionPreference = "Stop"

$deployDir = "hostico-deploy"
$zipFile = "deploy.zip"
$currentDir = Get-Location

Write-Host "--- Starting Bundle Process ---" -ForegroundColor Cyan

# 1. Clean prep
if (Test-Path $deployDir) {
    Write-Host "Cleaning $deployDir..."
    Remove-Item -Path $deployDir -Recurse -Force
}
if (Test-Path $zipFile) {
    Remove-Item -Path $zipFile -Force
}

# 2. Build production app
Write-Host "Executing production build..." -ForegroundColor Yellow
npm run build

# 3. Handle Standalone Output
if (-not (Test-Path ".next/standalone")) {
    Write-Error "Standalone build failed! Check next.config.ts"
    exit 1
}

Write-Host "Hoisting standalone files to $deployDir..."
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
Copy-Item -Path ".next/standalone/*" -Destination $deployDir -Recurse -Force

# 4. Sync static assets for styling
Write-Host "Syncing static assets..."
if (Test-Path ".next/static") {
    New-Item -ItemType Directory -Path "$deployDir/.next/static" -Force | Out-Null
    Copy-Item -Path ".next/static/*" -Destination "$deployDir/.next/static" -Recurse -Force
}

# 5. Sync Public folder (Including all media as requested)
Write-Host "Syncing public assets (including media)..." -ForegroundColor Magenta
if (Test-Path "public") {
    New-Item -ItemType Directory -Path "$deployDir/public" -Force | Out-Null
    Copy-Item -Path "public/*" -Destination "$deployDir/public" -Recurse -Force
}

# 6. Create ZIP Archive (Ensuring .next is included and paths are relative)
Write-Host "Creating $zipFile..." -ForegroundColor Green
Push-Location $deployDir
try {
    # Get all items including hidden ones (.next)
    $itemsToZip = Get-ChildItem -Force | Select-Object -ExpandProperty Name
    Compress-Archive -Path $itemsToZip -DestinationPath "$currentDir\$zipFile" -Force
}
finally {
    Pop-Location
}

Write-Host "--- Bundle Complete: $zipFile ---" -ForegroundColor Green
