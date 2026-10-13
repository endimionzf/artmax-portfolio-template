#!/usr/bin/env node

/**
 * package-static.mjs
 * Cross-platform packaging script for Next.js static export (`out/`).
 * Bundles the static site into a deploy-ready ZIP archive for cPanel `public_html` or any static host.
 * Supports --base-path (e.g. /template) for subfolder deployments and GitHub Pages.
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

const basePathIndex = args.indexOf('--base-path') !== -1 ? args.indexOf('--base-path') : args.indexOf('-basepath');
let basePath = basePathIndex !== -1 && args[basePathIndex + 1] ? args[basePathIndex + 1] : (process.env.BASE_PATH || '');

if (basePath && !basePath.startsWith('/')) {
  basePath = '/' + basePath;
}
if (basePath.endsWith('/')) {
  basePath = basePath.slice(0, -1);
}

const defaultName = basePath 
  ? (noMedia ? `deploy-static${basePath.replace(/\//g, '-')}-nomedia.zip` : `deploy-static${basePath.replace(/\//g, '-')}.zip`)
  : (noMedia ? 'deploy-static-nomedia.zip' : 'deploy-static.zip');

const zipFilename = customOutput || defaultName;
const zipFilePath = path.join(rootDir, zipFilename);
const stagingDir = path.join(rootDir, '.deploy-staging');

console.log('\n📦 \x1b[36mArtmax Studio Journal — Static Release Packager\x1b[0m');
console.log(`Mode:      \x1b[33m${noMedia ? 'No-Media (Code & Assets only)' : 'Full (Includes All Media)'}\x1b[0m`);
console.log(`Base Path: \x1b[35m${basePath || '/ (Root Domain)'}\x1b[0m`);
console.log(`Target:    \x1b[32m${zipFilename}\x1b[0m\n`);

const startTime = Date.now();

// 1. Verify or trigger build (always rebuild if basePath is explicitly passed or --build requested)
const needsRebuild = forceBuild || Boolean(basePath) || !fs.existsSync(outDir) || !fs.existsSync(path.join(outDir, 'index.html'));

if (needsRebuild) {
  console.log(`⚡ Building static export with BASE_PATH="${basePath}"...`);
  execSync('npm run build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      BASE_PATH: basePath,
      NEXT_PUBLIC_BASE_PATH: basePath,
    },
  });
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

// 4. Adapt .htaccess for the target path (remove RewriteBase / and point 404 to basePath)
const htaccessPath = path.join(outDir, '.htaccess');
if (fs.existsSync(htaccessPath)) {
  let htContent = fs.readFileSync(htaccessPath, 'utf8');
  // Remove absolute RewriteBase / so it is portable to subdirectories
  htContent = htContent.replace(/RewriteBase\s+\/\s*\n?/g, '');
  if (basePath) {
    htContent = htContent.replace(/ErrorDocument\s+404\s+\/404\.html/g, `ErrorDocument 404 ${basePath}/404.html`);
  }
  fs.writeFileSync(path.join(stagingDir, '.htaccess'), htContent, 'utf8');
}

console.log(`✓ Staged ${fileCount} files${mediaFilesSkipped > 0 ? ` (${mediaFilesSkipped} heavy media files excluded)` : ''}`);

// 5. Create ZIP archive
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

// 6. Clean up staging
fs.rmSync(stagingDir, { recursive: true, force: true });

// 7. Verify zip output and print summary
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
console.log(`Base Path:  ${basePath || '/ (Root Domain)'}`);
console.log(`Size:       ${sizeMB} MB (${stats.size.toLocaleString()} bytes)`);
console.log(`Files:      ${fileCount} packaged`);
console.log(`Duration:   ${elapsed}s`);
console.log(`Location:   ${zipFilePath}`);
console.log(`──────────────────────────────────────────\n`);
