import fs from 'fs';
import path from 'path';

/**
 * Build-time Portfolio Catalog Generator
 * Scans public/portfolio/media/ and metadata.csv to produce public/portfolio.json.
 * Supports both unified flat media storage (public/portfolio/media) and legacy category subfolders.
 * Generates universal media items supporting both photos/screenshots (mediaType: 'image')
 * and videos (mediaType: 'video') with optional multi-tier suffixes or simple single files.
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

export async function generatePortfolioJson() {
  console.log('--- Generating Static Portfolio Catalog (portfolio.json) ---');

  const rootDir = process.cwd();
  const portfolioDir = path.resolve(rootDir, 'public', 'portfolio');
  const mediaDir = path.resolve(portfolioDir, 'media');
  const outputFile = path.resolve(rootDir, 'public', 'portfolio.json');
  const siteConfigPath = path.resolve(rootDir, 'site.config.json');

  if (!fs.existsSync(portfolioDir)) {
    console.warn(`[generate-portfolio] Public portfolio directory not found: ${portfolioDir}`);
    fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
    return;
  }

  // Load site config to determine default category if available
  let defaultCategory = 'video';
  if (fs.existsSync(siteConfigPath)) {
    try {
      const siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));
      if (siteConfig.categories && siteConfig.categories.length > 0) {
        defaultCategory = siteConfig.categories[0].id || 'video';
      }
    } catch (e) {
      console.warn('[generate-portfolio] Could not parse site.config.json:', e);
    }
  }

  // 1. Parse metadata.csv if present
  const csvMetadata = new Map();
  const csvPath = path.resolve(portfolioDir, 'metadata.csv');
  if (fs.existsSync(csvPath)) {
    try {
      console.log('[generate-portfolio] Found metadata.csv, parsing entries...');
      const csvText = fs.readFileSync(csvPath, 'utf8');
      const rows = parseCSV(csvText);

      if (rows.length > 1) {
        const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const getIdx = (...names) => {
          for (const name of names) {
            const idx = headers.indexOf(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const colFile = getIdx('filename');
        const colTitle = getIdx('title');
        const colDesc = getIdx('description');
        const colCat = getIdx('category');
        const colTech = getIdx('techstack', 'tech_stack');
        const colRole = getIdx('role');
        const colClient = getIdx('client');
        const colAgency = getIdx('agency');
        const colProduction = getIdx('production');
        const colDirector = getIdx('director');
        const colProducer = getIdx('producer');
        const colTags = getIdx('tags');
        const colLink = getIdx('link');
        const colYouTube = getIdx('youtubeid', 'youtube');
        const colYear = getIdx('year');

        if (colFile !== -1) {
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row[colFile]) continue;

            const slug = aggressiveSlugify(row[colFile]);
            csvMetadata.set(slug, {
              title: colTitle !== -1 ? row[colTitle] : undefined,
              description: colDesc !== -1 ? row[colDesc] : undefined,
              category: colCat !== -1 && row[colCat] ? row[colCat] : undefined,
              techStack: colTech !== -1 && row[colTech] ? row[colTech] : undefined,
              role: colRole !== -1 ? row[colRole] : undefined,
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

  const allItems = [];
  let idCounter = 1;

  // Mode A: Flat public/portfolio/media/ directory
  if (fs.existsSync(mediaDir) && fs.lstatSync(mediaDir).isDirectory()) {
    console.log('[generate-portfolio] Scanning flat media directory: public/portfolio/media/');
    const files = fs.readdirSync(mediaDir);
    const mediaFiles = files.filter(f =>
      f.endsWith('.mp4') || f.endsWith('.webm') ||
      f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg') || f.endsWith('.webp')
    );

    // Group files by base slug
    const groupMap = new Map(); // slug -> { images: [], videos: [], files: [] }

    for (const file of mediaFiles) {
      const ext = path.extname(file).toLowerCase();
      const fileNameNoExt = path.basename(file, ext);

      const isPreview = fileNameNoExt.toLowerCase().endsWith('-preview');
      const isMobileSuffix = fileNameNoExt.toLowerCase().endsWith('-mobile');
      const isDesktopFallback = fileNameNoExt.toLowerCase().endsWith('-desktop-fallback');
      const isDesktopSuffix = fileNameNoExt.toLowerCase().endsWith('-desktop') && !isDesktopFallback;

      let rawBase = fileNameNoExt;
      if (isPreview) rawBase = fileNameNoExt.slice(0, -8);
      else if (isMobileSuffix) rawBase = fileNameNoExt.slice(0, -7);
      else if (isDesktopFallback) rawBase = fileNameNoExt.slice(0, -17);
      else if (isDesktopSuffix) rawBase = fileNameNoExt.slice(0, -8);

      const baseName = aggressiveSlugify(rawBase);
      if (!baseName) continue;

      if (!groupMap.has(baseName)) {
        groupMap.set(baseName, {
          baseName,
          images: [],
          desktopVideo: null,
          desktopFallbackVideo: null,
          mobileVideo: null,
          previewVideo: null,
          genericVideo: null
        });
      }

      const g = groupMap.get(baseName);
      const isImage = ext === '.jpg' || ext === '.png' || ext === '.jpeg' || ext === '.webp';

      if (isImage) {
        g.images.push(file);
      } else if (isPreview) {
        g.previewVideo = file;
      } else if (isMobileSuffix) {
        g.mobileVideo = file;
      } else if (isDesktopFallback) {
        g.desktopFallbackVideo = file;
      } else if (isDesktopSuffix) {
        g.desktopVideo = file;
      } else {
        g.genericVideo = file;
      }
    }

    for (const [baseName, g] of groupMap.entries()) {
      const csvData = csvMetadata.get(baseName) || {};
      const defaultTitle = baseName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const hasAnyVideo = !!(g.desktopVideo || g.genericVideo || g.mobileVideo || g.previewVideo || csvData.youtubeId);
      const mediaType = hasAnyVideo ? 'video' : 'image';
      const assignedCategory = csvData.category || defaultCategory;

      // Select best poster
      let posterSrc = '';
      if (g.images.length > 0) {
        // Prefer exact baseName.[ext] or first image
        const exactImage = g.images.find(img => path.basename(img, path.extname(img)) === baseName);
        posterSrc = encodeURI(`/portfolio/media/${exactImage || g.images[0]}`);
      } else {
        posterSrc = encodeURI(`/portfolio/media/${baseName}.jpg`);
      }

      // Resolve video tiers
      const fullVideoFile = g.desktopVideo || g.genericVideo;
      const fullSrc = fullVideoFile ? encodeURI(`/portfolio/media/${fullVideoFile}`) : (mediaType === 'image' ? posterSrc : '');
      const previewSrc = g.previewVideo ? encodeURI(`/portfolio/media/${g.previewVideo}`) : fullSrc;
      const srcDesktop = fullSrc;
      const srcDesktopFallback = g.desktopFallbackVideo ? encodeURI(`/portfolio/media/${g.desktopFallbackVideo}`) : '';
      const srcMobile = g.mobileVideo ? encodeURI(`/portfolio/media/${g.mobileVideo}`) : fullSrc;

      const item = {
        id: idCounter++,
        title: csvData.title || defaultTitle,
        description: csvData.description || '',
        category: assignedCategory,
        mediaType,
        previewSrc,
        fullSrc,
        srcDesktop,
        srcDesktopFallback,
        srcMobile,
        posterSrc,
        techStack: csvData.techStack || '',
        role: csvData.role || '',
        client: csvData.client || '',
        agency: csvData.agency || '',
        production: csvData.production || '',
        director: csvData.director || '',
        producer: csvData.producer || '',
        tags: csvData.tags || '',
        link: csvData.link || '',
        youtubeId: csvData.youtubeId || '',
        year: csvData.year || ''
      };

      allItems.push(item);
    }
  } else {
    // Mode B: Legacy nested folders fallback
    console.log('[generate-portfolio] Media directory missing, falling back to legacy subdirectories...');
    const legacyCategories = ['video', '3d', 'ai'];

    for (const category of legacyCategories) {
      const categoryPath = path.resolve(portfolioDir, category);
      if (!fs.existsSync(categoryPath) || !fs.lstatSync(categoryPath).isDirectory()) continue;

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
          const csvData = csvMetadata.get(baseName) || {};

          const item = {
            id: idCounter++,
            title: csvData.title || defaultTitle,
            description: csvData.description || '',
            category: csvData.category || category,
            mediaType: 'video',
            previewSrc: encodeURI(`/portfolio/${category}/${baseName}-preview.mp4`),
            fullSrc: encodeURI(`/portfolio/${category}/${baseName}-desktop.mp4`),
            srcDesktop: encodeURI(`/portfolio/${category}/${baseName}-desktop.mp4`),
            srcDesktopFallback: encodeURI(`/portfolio/${category}/${baseName}-desktop-fallback.mp4`),
            srcMobile: encodeURI(`/portfolio/${category}/${baseName}-mobile.mp4`),
            posterSrc: encodeURI(`/portfolio/${category}/${baseName}.jpg`),
            techStack: csvData.techStack || '',
            role: csvData.role || '',
            client: csvData.client || '',
            agency: csvData.agency || '',
            production: csvData.production || '',
            director: csvData.director || '',
            producer: csvData.producer || '',
            tags: csvData.tags || '',
            link: csvData.link || '',
            youtubeId: csvData.youtubeId || '',
            year: csvData.year || ''
          };

          categoryMap.set(baseName, item);
        }

        if (isImage) {
          const existing = categoryMap.get(baseName);
          existing.posterSrc = encodeURI(`/portfolio/${category}/${file}`);
        }
      }

      for (const item of categoryMap.values()) {
        allItems.push(item);
      }
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
