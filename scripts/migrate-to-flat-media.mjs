import fs from 'fs';
import path from 'path';

/**
 * Migration Script: Consolidates legacy category directories (video/, 3d/, ai/)
 * into a single flat directory: public/portfolio/media/
 * 
 * Also updates public/portfolio/metadata.csv:
 * - Backs up original to metadata.csv.bak
 * - Adds 'category', 'tech_stack', 'role' columns if not already present
 * - Associates each file with its legacy category
 * - Adds any uncataloged media files as default rows
 */

function aggressiveSlugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentCell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++;
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentRow.length > 0 || currentCell) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

function escapeCSVCell(str) {
  if (str === undefined || str === null) return '';
  const val = String(str);
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function migrateMedia() {
  console.log('=== Portfolio Media Migration: Flat Storage & Metadata Sync ===');

  const rootDir = process.cwd();
  const portfolioDir = path.resolve(rootDir, 'public', 'portfolio');
  const mediaDir = path.resolve(portfolioDir, 'media');
  const csvPath = path.resolve(portfolioDir, 'metadata.csv');
  const csvBakPath = path.resolve(portfolioDir, 'metadata.csv.bak');

  if (!fs.existsSync(portfolioDir)) {
    console.error(`[migrate] Portfolio directory not found at: ${portfolioDir}`);
    process.exit(1);
  }

  // Ensure public/portfolio/media directory exists
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
    console.log(`[migrate] Created flat media directory: ${mediaDir}`);
  }

  // Also copy .htaccess to media/ if present
  const htaccessSrc = path.resolve(portfolioDir, '.htaccess');
  const htaccessDest = path.resolve(mediaDir, '.htaccess');
  if (fs.existsSync(htaccessSrc) && !fs.existsSync(htaccessDest)) {
    fs.copyFileSync(htaccessSrc, htaccessDest);
    console.log('[migrate] Copied .htaccess to public/portfolio/media/.htaccess');
  }

  const legacyCategories = ['video', '3d', 'ai'];
  const fileCategoryMap = new Map(); // slug -> category
  let totalFilesCopied = 0;

  for (const cat of legacyCategories) {
    const catDir = path.resolve(portfolioDir, cat);
    if (!fs.existsSync(catDir) || !fs.lstatSync(catDir).isDirectory()) continue;

    const files = fs.readdirSync(catDir);
    console.log(`[migrate] Scanning legacy folder: ${cat} (${files.length} files found)`);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!['.mp4', '.webm', '.jpg', '.png', '.jpeg', '.webp'].includes(ext)) continue;

      const srcFile = path.resolve(catDir, file);
      const destFile = path.resolve(mediaDir, file);

      // Copy file if not exists or if size differs
      if (!fs.existsSync(destFile) || fs.statSync(destFile).size !== fs.statSync(srcFile).size) {
        fs.copyFileSync(srcFile, destFile);
        totalFilesCopied++;
      }

      // Compute base slug
      const fileNameNoExt = path.basename(file, ext);
      let rawBase = fileNameNoExt;
      if (rawBase.endsWith('-preview')) rawBase = rawBase.slice(0, -8);
      else if (rawBase.endsWith('-mobile')) rawBase = rawBase.slice(0, -7);
      else if (rawBase.endsWith('-desktop-fallback')) rawBase = rawBase.slice(0, -17);
      else if (rawBase.endsWith('-desktop')) rawBase = rawBase.slice(0, -8);

      const slug = aggressiveSlugify(rawBase);
      if (slug && !fileCategoryMap.has(slug)) {
        fileCategoryMap.set(slug, cat);
      }
    }
  }

  console.log(`[migrate] Successfully copied/verified ${totalFilesCopied} files in public/portfolio/media/`);

  // Read and migrate metadata.csv
  let rows = [];
  if (fs.existsSync(csvPath)) {
    // Backup original
    fs.copyFileSync(csvPath, csvBakPath);
    console.log(`[migrate] Backed up original metadata.csv to: ${csvBakPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    rows = parseCSV(csvContent);
  }

  let headers = [];
  if (rows.length > 0) {
    headers = [...rows[0]];
  } else {
    headers = ['FileName', 'Title', 'Description', 'Category', 'TechStack', 'Role', 'Client', 'Agency', 'Production', 'Director', 'Producer', 'Tags', 'Link', 'youtubeid', 'Year'];
    rows.push(headers);
  }

  // Ensure Category, TechStack, and Role columns exist
  const getHeaderIdx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  let catIdx = getHeaderIdx('category');
  if (catIdx === -1) {
    headers.push('Category');
    catIdx = headers.length - 1;
  }

  let techIdx = getHeaderIdx('techstack') !== -1 ? getHeaderIdx('techstack') : getHeaderIdx('tech_stack');
  if (techIdx === -1) {
    headers.push('TechStack');
    techIdx = headers.length - 1;
  }

  let roleIdx = getHeaderIdx('role');
  if (roleIdx === -1) {
    headers.push('Role');
    roleIdx = headers.length - 1;
  }

  rows[0] = headers;

  const fileIdx = getHeaderIdx('filename');
  const existingSlugs = new Set();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    // Pad row if necessary
    while (row.length < headers.length) {
      row.push('');
    }

    const rawFile = row[fileIdx] || '';
    const slug = aggressiveSlugify(rawFile);
    if (slug) {
      existingSlugs.add(slug);
      // If category is empty or needs setting
      if (!row[catIdx] && fileCategoryMap.has(slug)) {
        row[catIdx] = fileCategoryMap.get(slug);
      } else if (!row[catIdx]) {
        row[catIdx] = 'video'; // default
      }
    }
  }

  // Check for any media files not in metadata.csv and append them
  let addedRows = 0;
  for (const [slug, cat] of fileCategoryMap.entries()) {
    if (!existingSlugs.has(slug)) {
      const defaultTitle = slug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const newRow = new Array(headers.length).fill('');
      newRow[fileIdx] = slug;
      const titleIdx = getHeaderIdx('title');
      if (titleIdx !== -1) newRow[titleIdx] = defaultTitle;
      newRow[catIdx] = cat;
      rows.push(newRow);
      addedRows++;
    }
  }

  if (addedRows > 0) {
    console.log(`[migrate] Added ${addedRows} previously uncataloged items to metadata.csv`);
  }

  // Write updated CSV
  const csvOutput = rows.map(r => r.map(escapeCSVCell).join(',')).join('\n');
  fs.writeFileSync(csvPath, csvOutput, 'utf8');
  console.log(`[migrate] Updated metadata.csv with ${rows.length - 1} project entries.`);
  console.log('=== Media Migration Completed Successfully ===');
}

migrateMedia().catch(err => {
  console.error('[migrate] Fatal error:', err);
  process.exit(1);
});
