# This script prepares the standalone build and zips it for cPanel upload.
# Optimized for Hostico environment: Excludes media (mp4, jpg) to drastically reduce upload size.
$ErrorActionPreference = "Stop"

$deployDir = "hostico-deploy-nomedia"
$zipFile = "deploy-no-media.zip"
$currentDir = Get-Location

Write-Host "--- Starting Bundle Process (No Media) ---" -ForegroundColor Cyan

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
$env:NODE_OPTIONS = "--max-old-space-size=4096"
npm run build

# 3. Handle Standalone Output
if (-not (Test-Path ".next/standalone")) {
    Write-Error "Standalone build failed! Check next.config.ts"
    exit 1
}

Write-Host "Hoisting standalone files to $deployDir..."
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
Copy-Item -Path ".next/standalone/*" -Destination $deployDir -Recurse -Force

# Remove node_modules from root of deployDir because CloudLinux NodeJS 
# selector uses a symlink there and will crash if a real folder overwrites it.
if (Test-Path "$deployDir/node_modules") {
    Write-Host "Removing standalone node_modules to preserve CloudLinux symlink..."
    Remove-Item -Path "$deployDir/node_modules" -Recurse -Force
}

# 4. Sync static assets for styling
Write-Host "Syncing static assets..."
if (Test-Path ".next/static") {
    New-Item -ItemType Directory -Path "$deployDir/.next/static" -Force | Out-Null
    Copy-Item -Path ".next/static/*" -Destination "$deployDir/.next/static" -Recurse -Force
}

# 5. Sync Public folder (EXCLUDING .mp4 and .jpg)
Write-Host "Syncing public assets (Excluding .mp4 and .jpg)..." -ForegroundColor Magenta
if (Test-Path "public") {
    New-Item -ItemType Directory -Path "$deployDir/public" -Force | Out-Null
    Copy-Item -Path "public\*" -Destination "$deployDir\public" -Recurse -Force
    # PowerShell Copy-Item -Exclude is notoriously buggy for subfolders. 
    # It is much safer to copy everything and then cleanly remove the excluded formats.
    Get-ChildItem -Path "$deployDir\public" -Include *.mp4, *.jpg -Recurse | Remove-Item -Force
}

# 6. Create ZIP Archive (Ensuring .next is included and paths are relative)
Write-Host "Creating $zipFile..." -ForegroundColor Green
Push-Location $deployDir
try {
    # Windows 11 natively includes tar which is significantly more reliable than Compress-Archive for large Node.js folders
    Write-Host "Compressing using native tar..."
    tar.exe -a -c -f "$currentDir\$zipFile" *
}
finally {
    Pop-Location
}

Write-Host "--- Bundle Complete: $zipFile ---" -ForegroundColor Green
