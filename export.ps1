<#
.SYNOPSIS
  Packages the Artmax Studio Journal static export (out/) into a deployment ZIP archive.

.DESCRIPTION
  Builds and compresses the static export into deploy-static.zip or deploy-static-nomedia.zip
  ready for deployment to Hostico / cPanel public_html or any static web host.
  Supports -BasePath (e.g. -BasePath /template) for subfolder deployments and GitHub Pages.

.PARAMETER NoMedia
  Excludes heavy portfolio video files (.mp4/.webm) to create a lightweight deployment archive (~34MB).

.PARAMETER Build
  Forces a fresh static build (npm run build) before packaging.

.PARAMETER BasePath
  Subdirectory or repo path prefix (e.g. /template, /my-repo) if not deploying to domain root.

.EXAMPLE
  .\export.ps1
  Packages full static site for domain root into deploy-static.zip

.EXAMPLE
  .\export.ps1 -NoMedia -BasePath /template
  Packages lightweight static site for https://domain.com/template/
#>

[CmdletBinding()]
param (
    [switch]$NoMedia,
    [switch]$Build,
    [string]$BasePath = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$nodeArgs = @("scripts/package-static.mjs")

if ($NoMedia) {
    $nodeArgs += "--no-media"
}

if ($Build) {
    $nodeArgs += "--build"
}

if ($BasePath) {
    $nodeArgs += @("--base-path", $BasePath)
}

Write-Host "--- Artmax Studio Journal Static Export Packaging ---" -ForegroundColor Cyan
node @nodeArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "Packaging failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
