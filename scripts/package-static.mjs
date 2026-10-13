#!/usr/bin/env node

/**
 * package-static.mjs
 * Cross-platform packaging script for Next.js static export (`out/`).
 * Bundles the static site into a deploy-ready ZIP archive for cPanel `public_html` or any static host.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'out');

// Parse CLI flags
const args = process.argv.slice(2);
const noMedia = args.includes('--no-media') || args.includes('-nomedia');
const forceBuild = args.includes('--build');
const outputIndex = args.indexOf('--output');
const customOutput = outputIndex !== -1 && args[outputIndex + 1] ? args[outputIndex + 1] : null;

const zipFilename = customOutput || (noMedia ? 'deploy-static-nomedia.zip' : 'deploy-static.zip');
const zipFilePath = path.join(rootDir, zipFilename);
const stagingDir = path.join(rootDir, '.deploy-staging');

console.log('\n📦 \x1b[36mArtmax Studio Journal — Static Release Packager\x1b[0m');
console.log(`Mode: \x1b[33m${noMedia ? 'No-Media (Code & Assets only)' : 'Full (Includes All Media)'}\x1b[0m`);
console.log(`Target: \x1b[32m${zipFilename}\x1b[0m\n`);

const startTime = Date.now();

// 1. Verify or trigger build
if (forceBuild || !fs.existsSync(outDir) || !fs.existsSync(path.join(outDir, 'index.html'))) {
  console.log('⚡ Static export not found or rebuild requested. Running `npm run build`...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
}

if (!fs.existsSync(outDir) || !fs.existsSync(path.join(outDir, 'index.html'))) {
  console.error('\x1b[31mError: Static export directory `out/` is missing or incomplete.\x1b[0m');
  process.exit(1);
}

// 2. Prepare staging directory
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// 3. Copy files to staging with media filter
let fileCount = 0;
let mediaFilesSkipped = 0;
const mediaExtensions = new Set(['.mp4', '.webm', '.mov', '.ogg']);

function copyFiltered(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyFiltered(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    const ext = path.extname(src).toLowerCase();
    // If noMedia is enabled, skip video media inside the portfolio folder
    if (noMedia && mediaExtensions.has(ext) && src.includes('portfolio')) {
      mediaFilesSkipped++;
      return;
    }
    fs.copyFileSync(src, dest);
    fileCount++;
  }
}

console.log('📂 Staging files for packaging...');
copyFiltered(outDir, stagingDir);

// Ensure .htaccess was staged if present in out/
const htaccessPath = path.join(outDir, '.htaccess');
if (fs.existsSync(htaccessPath)) {
  fs.copyFileSync(htaccessPath, path.join(stagingDir, '.htaccess'));
}

console.log(`✓ Staged ${fileCount} files${mediaFilesSkipped > 0 ? ` (${mediaFilesSkipped} heavy media files excluded)` : ''}`);

// 4. Create ZIP archive
if (fs.existsSync(zipFilePath)) {
  fs.rmSync(zipFilePath, { force: true });
}

console.log(`🗜️  Compressing into ${zipFilename}...`);

try {
  if (process.platform === 'win32') {
    // Try native tar first (available in Windows 10/11 build 17063+), fallback to PowerShell
    try {
      execSync(`tar.exe -a -c -f "${zipFilePath}" *`, { cwd: stagingDir, stdio: 'pipe' });
    } catch {
      // Fallback: PowerShell Compress-Archive
      const psCommand = `Get-ChildItem -Path "${stagingDir}" -Force | Compress-Archive -DestinationPath "${zipFilePath}" -Force`;
      execSync(`powershell -NoProfile -Command "${psCommand}"`, { stdio: 'pipe' });
    }
  } else {
    // Linux / macOS: use zip utility
    try {
      execSync(`zip -r "${zipFilePath}" .`, { cwd: stagingDir, stdio: 'pipe' });
    } catch {
      // Fallback: tar if zip isn't installed
      execSync(`tar -a -c -f "${zipFilePath}" *`, { cwd: stagingDir, stdio: 'pipe' });
    }
  }
} catch (err) {
  console.error('\x1b[31mFailed to create zip archive:\x1b[0m', err.message);
  // Clean staging
  fs.rmSync(stagingDir, { recursive: true, force: true });
  process.exit(1);
}

// 5. Clean up staging
fs.rmSync(stagingDir, { recursive: true, force: true });

// 6. Verify zip output and print summary
if (!fs.existsSync(zipFilePath)) {
  console.error('\x1b[31mError: Expected output archive was not created.\x1b[0m');
  process.exit(1);
}

const stats = fs.statSync(zipFilePath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('\n\x1b[32m✨ Release archive created successfully!\x1b[0m');
console.log(`──────────────────────────────────────────`);
console.log(`Archive:    ${zipFilename}`);
console.log(`Size:       ${sizeMB} MB (${stats.size.toLocaleString()} bytes)`);
console.log(`Files:      ${fileCount} packaged`);
console.log(`Duration:   ${elapsed}s`);
console.log(`Location:   ${zipFilePath}`);
console.log(`──────────────────────────────────────────\n`);
