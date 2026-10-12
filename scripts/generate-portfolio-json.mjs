import fs from 'fs';
import path from 'path';

/**
 * Build-time Portfolio Catalog Generator
 * Scans public/portfolio/ directory and metadata.csv to produce public/portfolio.json.
 * Completely replaces the runtime Next.js API route (/api/portfolio) with a static asset.
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
      i++; // Skip escaped quote
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

export async function generatePortfolioJson() {
  console.log('--- Generating Static Portfolio Catalog (portfolio.json) ---');

  const rootDir = process.cwd();
  const publicDir = path.resolve(rootDir, 'public', 'portfolio');
  const outputFile = path.resolve(rootDir, 'public', 'portfolio.json');

  if (!fs.existsSync(publicDir)) {
    console.warn(`[generate-portfolio] Public portfolio directory not found: ${publicDir}`);
    fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
    return;
  }

  // 1. Parse metadata.csv if present
  const csvMetadata = new Map();
  const csvPath = path.resolve(publicDir, 'metadata.csv');
  if (fs.existsSync(csvPath)) {
    try {
      console.log('[generate-portfolio] Found metadata.csv, parsing entries...');
      const csvText = fs.readFileSync(csvPath, 'utf8');
      const rows = parseCSV(csvText);

      if (rows.length > 1) {
        const headers = rows[0].map(h => h.toLowerCase());
        const getIdx = name => headers.indexOf(name);

        const colFile = getIdx('filename');
        const colTitle = getIdx('title');
        const colDesc = getIdx('description');
        const colClient = getIdx('client');
        const colAgency = getIdx('agency');
        const colProduction = getIdx('production');
        const colDirector = getIdx('director');
        const colProducer = getIdx('producer');
        const colTags = getIdx('tags');
        const colLink = getIdx('link');
        const colYouTube = getIdx('youtubeid');
        const colYear = getIdx('year');

        if (colFile !== -1) {
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row[colFile]) continue;

            const slug = aggressiveSlugify(row[colFile]);
            csvMetadata.set(slug, {
              title: colTitle !== -1 ? row[colTitle] : undefined,
              description: colDesc !== -1 ? row[colDesc] : undefined,
              client: colClient !== -1 ? row[colClient] : undefined,
              agency: colAgency !== -1 ? row[colAgency] : undefined,
              production: colProduction !== -1 ? row[colProduction] : undefined,
              director: colDirector !== -1 ? row[colDirector] : undefined,
              producer: colProducer !== -1 ? row[colProducer] : undefined,
              tags: colTags !== -1 ? row[colTags] : undefined,
              link: colLink !== -1 ? row[colLink] : undefined,
              youtubeId: colYouTube !== -1 ? row[colYouTube] : undefined,
              year: colYear !== -1 ? row[colYear] : undefined,
            });
          }
        }
      }
    } catch (e) {
      console.error('[generate-portfolio] Error parsing metadata.csv:', e);
    }
  }

  const categories = ['video', '3d', 'ai'];
  const allItems = [];
  let idCounter = 1;

  for (const category of categories) {
    const categoryPath = path.resolve(publicDir, category);
    if (!fs.existsSync(categoryPath)) continue;

    const stats = fs.lstatSync(categoryPath);
    if (!stats.isDirectory()) continue;

    const files = fs.readdirSync(categoryPath);
    const mediaFiles = files.filter(f =>
      f.endsWith('.mp4') || f.endsWith('.webm') ||
      f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')
    );

    const categoryMap = new Map();

    for (const file of mediaFiles) {
      const ext = path.extname(file).toLowerCase();
      const fileName = path.basename(file, ext);

      const isPreview = fileName.toLowerCase().endsWith('-preview');
      const isMobileSuffix = fileName.toLowerCase().endsWith('-mobile');
      const isDesktopFallback = fileName.toLowerCase().endsWith('-desktop-fallback');
      const isDesktopSuffix = fileName.toLowerCase().endsWith('-desktop') && !isDesktopFallback;
      const isImage = ext === '.jpg' || ext === '.png' || ext === '.jpeg';

      let rawBase = fileName;
      if (isPreview) rawBase = fileName.slice(0, -8);
      else if (isMobileSuffix) rawBase = fileName.slice(0, -7);
      else if (isDesktopFallback) rawBase = fileName.slice(0, -17);
      else if (isDesktopSuffix) rawBase = fileName.slice(0, -8);

      const baseName = aggressiveSlugify(rawBase);
      if (!baseName) continue;

      if (!categoryMap.has(baseName)) {
        const defaultTitle = baseName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const item = {
          id: idCounter++,
          title: defaultTitle,
          description: '',
          category,
          previewSrc: encodeURI(`/portfolio/${category}/${baseName}-preview.mp4`),
          fullSrc: encodeURI(`/portfolio/${category}/${baseName}-desktop.mp4`),
          srcDesktop: encodeURI(`/portfolio/${category}/${baseName}-desktop.mp4`),
          srcDesktopFallback: encodeURI(`/portfolio/${category}/${baseName}-desktop-fallback.mp4`),
          srcMobile: encodeURI(`/portfolio/${category}/${baseName}-mobile.mp4`),
          posterSrc: encodeURI(`/portfolio/${category}/${baseName}.jpg`),
          client: '',
          agency: '',
          production: '',
          director: '',
          producer: '',
          tags: '',
          link: '',
          youtubeId: '',
          year: ''
        };

        if (csvMetadata.has(baseName)) {
          const csvData = csvMetadata.get(baseName);
          if (csvData.title) item.title = csvData.title;
          if (csvData.description) item.description = csvData.description;
          if (csvData.client) item.client = csvData.client;
          if (csvData.agency) item.agency = csvData.agency;
          if (csvData.production) item.production = csvData.production;
          if (csvData.director) item.director = csvData.director;
          if (csvData.producer) item.producer = csvData.producer;
          if (csvData.tags) item.tags = csvData.tags;
          if (csvData.link) item.link = csvData.link;
          if (csvData.youtubeId) item.youtubeId = csvData.youtubeId;
          if (csvData.year) item.year = csvData.year;
        }

        categoryMap.set(baseName, item);
      }

      // If we find an image file matching this baseName, set exact posterSrc
      if (isImage) {
        const existing = categoryMap.get(baseName);
        existing.posterSrc = encodeURI(`/portfolio/${category}/${file}`);
      }
    }

    for (const item of categoryMap.values()) {
      allItems.push(item);
    }
  }

  // Stable sort by id
  allItems.sort((a, b) => a.id - b.id);

  fs.writeFileSync(outputFile, JSON.stringify(allItems, null, 2), 'utf8');
  console.log(`--- Successfully generated ${allItems.length} portfolio items to public/portfolio.json ---`);
}

generatePortfolioJson().catch(err => {
  console.error('[generate-portfolio] Fatal error:', err);
  process.exit(1);
});
