import http from 'http';
import fs from 'fs';
import path from 'path';
import { generatePortfolioJson } from './generate-portfolio-json.mjs';

/**
 * Artmax Portfolio Local Visual Editor
 * Lightweight zero-dependency dashboard on http://127.0.0.1:3333
 * Allows visual inspection, uncataloged media discovery, 1-click metadata editing,
 * and comprehensive customization of text, branding/logos, navigation, and messages.
 */

const PORT = 3333;
const rootDir = process.cwd();
const portfolioDir = path.resolve(rootDir, 'public', 'portfolio');
const mediaDir = path.resolve(portfolioDir, 'media');
const csvPath = path.resolve(portfolioDir, 'metadata.csv');
const siteConfigPath = path.resolve(rootDir, 'site.config.json');

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

function loadConfig() {
  if (fs.existsSync(siteConfigPath)) {
    try {
      return JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));
    } catch (e) {
      console.error('[Editor] Could not parse site.config.json', e);
    }
  }
  return {
    deployment: { basePath: '' },
    site: { title: 'Studio', description: 'Portfolio' },
    categories: [{ id: 'video', label: 'Video', color: '#ff003c' }]
  };
}

function loadData() {
  const config = loadConfig();
  let headers = ['FileName', 'Title', 'Description', 'Category', 'TechStack', 'Role', 'Client', 'Agency', 'Production', 'Director', 'Producer', 'Tags', 'Link', 'youtubeid', 'Year'];
  const projects = [];

  if (fs.existsSync(csvPath)) {
    const csvText = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(csvText);
    if (rows.length > 0) {
      headers = rows[0];
      const getIdx = (name) => headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, ''));

      const colFile = getIdx('filename');
      const colTitle = getIdx('title');
      const colDesc = getIdx('description');
      const colCat = getIdx('category');
      const colTech = getIdx('techstack') !== -1 ? getIdx('techstack') : getIdx('tech_stack');
      const colRole = getIdx('role');
      const colClient = getIdx('client');
      const colAgency = getIdx('agency');
      const colProduction = getIdx('production');
      const colDirector = getIdx('director');
      const colProducer = getIdx('producer');
      const colTags = getIdx('tags');
      const colLink = getIdx('link');
      const colYouTube = getIdx('youtubeid');
      const colYear = getIdx('year');

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row[colFile]) continue;
        projects.push({
          filename: row[colFile] || '',
          title: colTitle !== -1 ? (row[colTitle] || '') : '',
          description: colDesc !== -1 ? (row[colDesc] || '') : '',
          category: colCat !== -1 ? (row[colCat] || 'video') : 'video',
          techStack: colTech !== -1 ? (row[colTech] || '') : '',
          role: colRole !== -1 ? (row[colRole] || '') : '',
          client: colClient !== -1 ? (row[colClient] || '') : '',
          agency: colAgency !== -1 ? (row[colAgency] || '') : '',
          production: colProduction !== -1 ? (row[colProduction] || '') : '',
          director: colDirector !== -1 ? (row[colDirector] || '') : '',
          producer: colProducer !== -1 ? (row[colProducer] || '') : '',
          tags: colTags !== -1 ? (row[colTags] || '') : '',
          link: colLink !== -1 ? (row[colLink] || '') : '',
          youtubeId: colYouTube !== -1 ? (row[colYouTube] || '') : '',
          year: colYear !== -1 ? (row[colYear] || '') : ''
        });
      }
    }
  }

  // Detect uncataloged media
  const existingSlugs = new Set(projects.map(p => aggressiveSlugify(p.filename)));
  const uncataloged = [];
  const detectedBases = new Set();

  if (fs.existsSync(mediaDir)) {
    const mediaFiles = fs.readdirSync(mediaDir);
    for (const file of mediaFiles) {
      const ext = path.extname(file).toLowerCase();
      let base = path.basename(file, ext);
      if (base.endsWith('-preview')) base = base.slice(0, -8);
      else if (base.endsWith('-mobile')) base = base.slice(0, -7);
      else if (base.endsWith('-desktop-fallback')) base = base.slice(0, -17);
      else if (base.endsWith('-desktop')) base = base.slice(0, -8);

      const slug = aggressiveSlugify(base);
      if (slug && !existingSlugs.has(slug) && !detectedBases.has(slug)) {
        detectedBases.add(slug);
        uncataloged.push({
          filename: base,
          slug,
          sampleFile: file,
          isImage: ['.jpg', '.png', '.jpeg', '.webp'].includes(ext)
        });
      }
    }
  }

  return { config, projects, uncataloged, headers };
}

function saveProjects(projects, headers) {
  // Backup
  if (fs.existsSync(csvPath)) {
    fs.copyFileSync(csvPath, `${csvPath}.bak`);
  }

  const standardHeaders = ['FileName', 'Title', 'Description', 'Category', 'TechStack', 'Role', 'Client', 'Agency', 'Production', 'Director', 'Producer', 'Tags', 'Link', 'youtubeid', 'Year'];
  const finalHeaders = headers && headers.length >= standardHeaders.length ? headers : standardHeaders;

  const rows = [finalHeaders];
  for (const p of projects) {
    const row = [
      p.filename || '',
      p.title || '',
      p.description || '',
      p.category || 'video',
      p.techStack || '',
      p.role || '',
      p.client || '',
      p.agency || '',
      p.production || '',
      p.director || '',
      p.producer || '',
      p.tags || '',
      p.link || '',
      p.youtubeId || '',
      p.year || ''
    ];
    rows.push(row);
  }

  const csvContent = rows.map(r => r.map(escapeCSVCell).join(',')).join('\n');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
}

const HTML_DASHBOARD = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Portfolio & Project Editor</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: #0a0a0c;
      --card-bg: rgba(22, 22, 28, 0.85);
      --border: rgba(255, 255, 255, 0.1);
      --text: #f0f0f5;
      --text-muted: #888899;
      --accent-cyan: #00f3ff;
      --accent-red: #ff003c;
      --accent-green: #00ff41;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      padding: 32px 24px;
    }
    .header {
      max-width: 1400px;
      margin: 0 auto 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-family: monospace;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--accent-cyan);
    }
    .nav-tabs {
      max-width: 1400px;
      margin: 0 auto 28px;
      display: flex;
      gap: 8px;
    }
    .tab-btn {
      padding: 10px 24px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .tab-btn.active {
      background: rgba(0, 243, 255, 0.15);
      border-color: var(--accent-cyan);
      color: #fff;
      box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
    }
    .actions {
      display: flex;
      gap: 12px;
    }
    .btn {
      padding: 10px 20px;
      border-radius: 9999px;
      font-size: 12px;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      transition: all 0.2s ease;
    }
    .btn:hover { background: rgba(255, 255, 255, 0.15); transform: translateY(-1px); }
    .btn-primary {
      background: var(--accent-cyan);
      color: #000;
      border-color: var(--accent-cyan);
      box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);
    }
    .btn-primary:hover { background: #55f7ff; }
    .container { max-width: 1400px; margin: 0 auto; }

    /* Uncataloged banner */
    .banner {
      background: rgba(0, 243, 255, 0.06);
      border: 1px solid rgba(0, 243, 255, 0.3);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 32px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .banner-title {
      font-family: monospace;
      font-size: 13px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--accent-cyan);
      font-weight: 700;
    }
    .uncataloged-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .uncataloged-item {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px dashed rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 6px 12px;
      font-family: monospace;
      font-size: 12px;
    }
    .uncataloged-item button {
      background: none;
      border: none;
      color: var(--accent-cyan);
      cursor: pointer;
      font-weight: bold;
    }

    /* Grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    }
    .card:hover {
      border-color: rgba(255, 255, 255, 0.25);
      transform: translateY(-3px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
    }
    .thumbnail {
      width: 100%;
      height: 180px;
      background: #000;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumbnail-placeholder {
      font-family: monospace;
      font-size: 11px;
      color: var(--text-muted);
    }
    .card-body {
      padding: 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }
    .card-title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.3;
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 10px;
      font-family: monospace;
      text-transform: uppercase;
      font-weight: bold;
      letter-spacing: 1px;
      border: 1px solid currentColor;
    }
    .card-meta {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tech-pill {
      display: inline-block;
      background: rgba(0, 243, 255, 0.1);
      border: 1px solid rgba(0, 243, 255, 0.3);
      color: var(--accent-cyan);
      font-family: monospace;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-right: 4px;
      margin-top: 4px;
    }
    .card-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      margin-top: auto;
    }

    /* Settings View */
    .settings-panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
      backdrop-filter: blur(10px);
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    .settings-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 24px;
    }
    .settings-section:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--accent-cyan);
      font-family: monospace;
    }

    /* Modal & Form Controls */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 24px;
    }
    .modal-backdrop.open { display: flex; }
    .modal {
      background: #141418;
      border: 1px solid var(--border);
      border-radius: 20px;
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 32px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.8);
    }
    .modal-title {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 24px;
    }
    .form-group {
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .form-label {
      font-size: 11px;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
    }
    .form-input, .form-select, .form-textarea {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: all 0.2s;
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      border-color: var(--accent-cyan);
      box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
    }
    .form-textarea { min-height: 80px; resize: vertical; }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
    }

    /* Toast */
    .status-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--accent-cyan);
      color: #000;
      padding: 12px 24px;
      border-radius: 9999px;
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      display: none;
      box-shadow: 0 10px 30px rgba(0, 243, 255, 0.4);
      z-index: 2000;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div>
        <div class="title" id="siteTitle">Artmax Studio</div>
        <div class="tagline">// Local_Visual_Project_Editor (v4.0)</div>
      </div>
    </div>
    <div class="actions">
      <div id="projectsActions" style="display: flex; gap: 12px;">
        <button class="btn" onclick="openModal(null)">+ Add Project</button>
        <button class="btn btn-primary" onclick="saveAll()">Sync & Save</button>
      </div>
      <div id="settingsActions" style="display: none; gap: 12px;">
        <button class="btn btn-primary" onclick="saveSettings()">Save Configuration</button>
      </div>
    </div>
  </div>

  <div class="nav-tabs">
    <button class="tab-btn active" id="tabProjectsBtn" onclick="switchTab('projects')">Projects & Media</button>
    <button class="tab-btn" id="tabSettingsBtn" onclick="switchTab('settings')">Site & Branding Config</button>
  </div>

  <div class="container">
    <!-- Projects View -->
    <div id="projectsView">
      <div id="uncatalogedBanner" class="banner" style="display: none;">
        <div class="banner-title">⚡ Uncataloged Media Discovered in public/portfolio/media/</div>
        <div id="uncatalogedList" class="uncataloged-list"></div>
      </div>

      <div id="projectGrid" class="grid"></div>
    </div>

    <!-- Settings View -->
    <div id="settingsView" style="display: none;">
      <div class="settings-panel">
        <!-- Site & SEO -->
        <div class="settings-section">
          <div class="section-title">// 1. Site Metadata & SEO</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Site Title</label>
              <input type="text" id="cfgSiteTitle" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Author / Creator</label>
              <input type="text" id="cfgSiteAuthor" class="form-input">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Description (Meta tag)</label>
            <input type="text" id="cfgSiteDesc" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">Production URL</label>
            <input type="text" id="cfgSiteUrl" class="form-input" placeholder="https://yourdomain.com">
          </div>
        </div>

        <!-- Branding & Logo -->
        <div class="settings-section">
          <div class="section-title">// 2. Branding & Logo</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Logo Type</label>
              <select id="cfgLogoType" class="form-select">
                <option value="image">Image (PNG / SVG / WebP)</option>
                <option value="text">Text Typography</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Logo Image Path (in public/)</label>
              <input type="text" id="cfgLogoImage" class="form-input" placeholder="/artmax_logo.png">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Logo Text (Fallback)</label>
              <input type="text" id="cfgLogoText" class="form-input" placeholder="Artmax Studio">
            </div>
            <div class="form-group">
              <label class="form-label">Logo Alt Text</label>
              <input type="text" id="cfgLogoAlt" class="form-input" placeholder="Studio Logo">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Contact Button Tooltip Title</label>
            <input type="text" id="cfgContactTitle" class="form-input" placeholder="Contact Studio">
          </div>
        </div>

        <!-- Navigation -->
        <div class="settings-section">
          <div class="section-title">// 3. Header Navigation & Journal</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Journal Link Text</label>
              <input type="text" id="cfgNavJournalText" class="form-input" placeholder="// Journey_Log">
            </div>
            <div class="form-group">
              <label class="form-label">Journal Link Target URL</label>
              <input type="text" id="cfgNavJournalUrl" class="form-input" placeholder="/blog">
            </div>
          </div>
        </div>

        <!-- Start Overlay -->
        <div class="settings-section">
          <div class="section-title">// 4. Intro Splash Screen (StartOverlay)</div>
          <div class="form-group">
            <label class="form-label">Intro Main Title</label>
            <input type="text" id="cfgStartTitle" class="form-input" placeholder="Artmax Studio">
          </div>
          <div class="form-group">
            <label class="form-label">Intro Quote / Philosophical Statement</label>
            <textarea id="cfgStartQuote" class="form-textarea" placeholder="In the vastness of light..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Explore Button Title</label>
              <input type="text" id="cfgExploreTitle" class="form-input" placeholder="Explore">
            </div>
            <div class="form-group">
              <label class="form-label">Index Button Title</label>
              <input type="text" id="cfgIndexTitle" class="form-input" placeholder="Index">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Explore Subtitle</label>
              <input type="text" id="cfgExploreSubtitle" class="form-input" placeholder="3D exploration">
            </div>
            <div class="form-group">
              <label class="form-label">Index Subtitle</label>
              <input type="text" id="cfgIndexSubtitle" class="form-input" placeholder="Classical internet experience">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Explore Device Hint</label>
              <input type="text" id="cfgExploreHint" class="form-input" placeholder="Keyboard and Mouse Required">
            </div>
            <div class="form-group">
              <label class="form-label">Sound Hint</label>
              <input type="text" id="cfgSoundHint" class="form-input" placeholder="Sound Required">
            </div>
          </div>
        </div>

        <!-- Contact Overlay -->
        <div class="settings-section">
          <div class="section-title">// 5. Contact Overlay Modal</div>
          <div class="form-group">
            <label class="form-label">Contact Heading</label>
            <input type="text" id="cfgContactHeading" class="form-input" placeholder="Let's collaborate...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="cfgContactEmail" class="form-input" placeholder="hello@example.com">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="text" id="cfgContactPhone" class="form-input" placeholder="+123456789">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Close Button Label</label>
            <input type="text" id="cfgContactButtonText" class="form-input" placeholder="Return to Experience">
          </div>
        </div>

        <!-- UI Messages -->
        <div class="settings-section">
          <div class="section-title">// 6. UI Action Labels & Messages</div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Info Button</label>
              <input type="text" id="cfgMsgInfo" class="form-input" placeholder="INFO">
            </div>
            <div class="form-group">
              <label class="form-label">Back Button</label>
              <input type="text" id="cfgMsgBack" class="form-input" placeholder="BACK">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tech Stack Header</label>
            <input type="text" id="cfgMsgTechStack" class="form-input" placeholder="// Tech_Stack">
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" onclick="saveSettings()">Save Configuration</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Edit Modal -->
  <div id="editModal" class="modal-backdrop">
    <div class="modal">
      <div class="modal-title" id="modalTitle">Edit Project</div>
      <form id="projectForm" onsubmit="handleFormSubmit(event)">
        <input type="hidden" id="editIndex" value="-1">
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Base FileName (in media/)</label>
            <input type="text" id="formFileName" class="form-input" required placeholder="project_slug">
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="formCategory" class="form-select"></select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Title</label>
          <input type="text" id="formTitle" class="form-input" required placeholder="Project Name">
        </div>

        <div class="form-group">
          <label class="form-label">Tech Stack (comma-separated)</label>
          <input type="text" id="formTechStack" class="form-input" placeholder="Next.js, Three.js, TypeScript, Tailwind">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Role</label>
            <input type="text" id="formRole" class="form-input" placeholder="Lead Developer / 3D Artist">
          </div>
          <div class="form-group">
            <label class="form-label">Client</label>
            <input type="text" id="formClient" class="form-input" placeholder="Client or Organization">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Year</label>
            <input type="text" id="formYear" class="form-input" placeholder="2026">
          </div>
          <div class="form-group">
            <label class="form-label">YouTube ID (optional)</label>
            <input type="text" id="formYouTube" class="form-input" placeholder="Video ID if hosted on YouTube">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Smart Link (/blog/slug, github.com/..., or demo URL)</label>
          <input type="text" id="formLink" class="form-input" placeholder="/blog/my-article or https://github.com/...">
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="formDescription" class="form-textarea" placeholder="Brief project summary..."></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn" onclick="closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Apply</button>
        </div>
      </form>
    </div>
  </div>

  <div id="toast" class="status-toast">Saved Successfully!</div>

  <script>
    let state = { config: {}, projects: [], uncataloged: [], headers: [] };

    async function load() {
      const res = await fetch('/api/data');
      state = await res.json();
      render();
      populateSettings();
    }

    function switchTab(tab) {
      const isProjects = tab === 'projects';
      document.getElementById('tabProjectsBtn').classList.toggle('active', isProjects);
      document.getElementById('tabSettingsBtn').classList.toggle('active', !isProjects);
      document.getElementById('projectsView').style.display = isProjects ? 'block' : 'none';
      document.getElementById('settingsView').style.display = !isProjects ? 'block' : 'none';
      document.getElementById('projectsActions').style.display = isProjects ? 'flex' : 'none';
      document.getElementById('settingsActions').style.display = !isProjects ? 'flex' : 'none';
    }

    function populateSettings() {
      const c = state.config || {};
      const site = c.site || {};
      const branding = c.branding || {};
      const nav = c.navigation || {};
      const start = c.startOverlay || {};
      const contact = c.contact || {};
      const msg = c.messages || {};

      document.getElementById('cfgSiteTitle').value = site.title || '';
      document.getElementById('cfgSiteAuthor').value = site.author || '';
      document.getElementById('cfgSiteDesc').value = site.description || '';
      document.getElementById('cfgSiteUrl').value = site.siteUrl || '';

      document.getElementById('cfgLogoType').value = branding.logoType || 'image';
      document.getElementById('cfgLogoImage').value = branding.logoImage || '';
      document.getElementById('cfgLogoText').value = branding.logoText || '';
      document.getElementById('cfgLogoAlt').value = branding.logoAlt || '';
      document.getElementById('cfgContactTitle').value = branding.contactButtonTitle || '';

      document.getElementById('cfgNavJournalText').value = nav.journalLinkText || '';
      document.getElementById('cfgNavJournalUrl').value = nav.journalLinkUrl || '';

      document.getElementById('cfgStartTitle').value = start.title || '';
      document.getElementById('cfgStartQuote').value = start.quote || '';
      document.getElementById('cfgExploreTitle').value = start.exploreButton?.title || '';
      document.getElementById('cfgExploreSubtitle').value = start.exploreButton?.subtitle || '';
      document.getElementById('cfgExploreHint').value = start.exploreButton?.hint || '';
      document.getElementById('cfgIndexTitle').value = start.indexButton?.title || '';
      document.getElementById('cfgIndexSubtitle').value = start.indexButton?.subtitle || '';
      document.getElementById('cfgSoundHint').value = start.soundHint || '';

      document.getElementById('cfgContactHeading').value = contact.title || '';
      document.getElementById('cfgContactEmail').value = contact.email || '';
      document.getElementById('cfgContactPhone').value = contact.phone || '';
      document.getElementById('cfgContactButtonText').value = contact.buttonText || '';

      document.getElementById('cfgMsgInfo').value = msg.infoButton || '';
      document.getElementById('cfgMsgBack').value = msg.backButton || '';
      document.getElementById('cfgMsgTechStack').value = msg.techStackHeader || '';
    }

    async function saveSettings() {
      const c = state.config || {};
      c.site = c.site || {};
      c.site.title = document.getElementById('cfgSiteTitle').value.trim();
      c.site.author = document.getElementById('cfgSiteAuthor').value.trim();
      c.site.description = document.getElementById('cfgSiteDesc').value.trim();
      c.site.siteUrl = document.getElementById('cfgSiteUrl').value.trim();

      c.branding = c.branding || {};
      c.branding.logoType = document.getElementById('cfgLogoType').value;
      c.branding.logoImage = document.getElementById('cfgLogoImage').value.trim();
      c.branding.logoText = document.getElementById('cfgLogoText').value.trim();
      c.branding.logoAlt = document.getElementById('cfgLogoAlt').value.trim();
      c.branding.contactButtonTitle = document.getElementById('cfgContactTitle').value.trim();

      c.navigation = c.navigation || {};
      c.navigation.journalLinkText = document.getElementById('cfgNavJournalText').value.trim();
      c.navigation.journalLinkUrl = document.getElementById('cfgNavJournalUrl').value.trim();

      c.startOverlay = c.startOverlay || {};
      c.startOverlay.title = document.getElementById('cfgStartTitle').value.trim();
      c.startOverlay.quote = document.getElementById('cfgStartQuote').value.trim();
      c.startOverlay.exploreButton = {
        title: document.getElementById('cfgExploreTitle').value.trim(),
        subtitle: document.getElementById('cfgExploreSubtitle').value.trim(),
        hint: document.getElementById('cfgExploreHint').value.trim()
      };
      c.startOverlay.indexButton = {
        title: document.getElementById('cfgIndexTitle').value.trim(),
        subtitle: document.getElementById('cfgIndexSubtitle').value.trim()
      };
      c.startOverlay.soundHint = document.getElementById('cfgSoundHint').value.trim();

      c.contact = c.contact || {};
      c.contact.title = document.getElementById('cfgContactHeading').value.trim();
      c.contact.email = document.getElementById('cfgContactEmail').value.trim();
      c.contact.phone = document.getElementById('cfgContactPhone').value.trim();
      c.contact.buttonText = document.getElementById('cfgContactButtonText').value.trim();

      c.messages = c.messages || {};
      c.messages.infoButton = document.getElementById('cfgMsgInfo').value.trim();
      c.messages.backButton = document.getElementById('cfgMsgBack').value.trim();
      c.messages.techStackHeader = document.getElementById('cfgMsgTechStack').value.trim();

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Site configuration saved to site.config.json!');
        state.config = c;
        if (c.site && c.site.title) {
          document.getElementById('siteTitle').innerText = c.site.title;
        }
      } else {
        alert('Error saving configuration: ' + (data.error || 'Unknown'));
      }
    }

    function render() {
      if (state.config.site && state.config.site.title) {
        document.getElementById('siteTitle').innerText = state.config.site.title;
      }

      // Render Categories in modal select
      const catSelect = document.getElementById('formCategory');
      catSelect.innerHTML = '';
      (state.config.categories || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.label + ' (' + c.id + ')';
        catSelect.appendChild(opt);
      });

      // Render Uncataloged
      const banner = document.getElementById('uncatalogedBanner');
      const list = document.getElementById('uncatalogedList');
      if (state.uncataloged && state.uncataloged.length > 0) {
        banner.style.display = 'flex';
        list.innerHTML = '';
        state.uncataloged.forEach(item => {
          const el = document.createElement('div');
          el.className = 'uncataloged-item';
          el.innerHTML = '<span>' + item.filename + '</span><button onclick="addUncataloged(\\'' + item.filename + '\\')">+ Add</button>';
          list.appendChild(el);
        });
      } else {
        banner.style.display = 'none';
      }

      // Render Projects
      const grid = document.getElementById('projectGrid');
      grid.innerHTML = '';

      state.projects.forEach((p, idx) => {
        const cat = (state.config.categories || []).find(c => c.id === p.category) || { color: '#00f3ff', label: p.category };
        const card = document.createElement('div');
        card.className = 'card';

        const thumbUrl = '/portfolio/media/' + encodeURIComponent(p.filename) + '.jpg';
        const thumbPng = '/portfolio/media/' + encodeURIComponent(p.filename) + '.png';

        const techPills = p.techStack ? p.techStack.split(',').map(t => '<span class="tech-pill">' + t.trim() + '</span>').join('') : '';

        card.innerHTML = \`
          <div class="thumbnail">
            <img src="\${thumbUrl}" onerror="this.onerror=null; this.src='\${thumbPng}'; this.parentElement.querySelector('.thumbnail-placeholder')?.remove();" alt="\${p.title}">
            <div class="thumbnail-placeholder">\${p.filename}</div>
          </div>
          <div class="card-body">
            <div class="card-header-row">
              <div class="card-title">\${p.title || p.filename}</div>
              <span class="badge" style="color: \${cat.color}">\${cat.label || p.category}</span>
            </div>
            <div class="card-meta">
              \${p.role ? '<div><strong>Role:</strong> ' + p.role + '</div>' : ''}
              \${p.client ? '<div><strong>Client:</strong> ' + p.client + '</div>' : ''}
              \${p.year ? '<div><strong>Year:</strong> ' + p.year + '</div>' : ''}
              \${p.link ? '<div><strong>Link:</strong> ' + p.link + '</div>' : ''}
            </div>
            \${techPills ? '<div>' + techPills + '</div>' : ''}
            <div class="card-footer">
              <button class="btn" style="padding: 6px 14px; font-size: 10px;" onclick="openModal(\${idx})">Edit</button>
              <button class="btn" style="padding: 6px 14px; font-size: 10px; color: var(--accent-red);" onclick="deleteProject(\${idx})">Delete</button>
            </div>
          </div>
        \`;
        grid.appendChild(card);
      });
    }

    function openModal(idx) {
      document.getElementById('editIndex').value = idx !== null ? idx : -1;
      const modal = document.getElementById('editModal');
      modal.classList.add('open');

      if (idx !== null && state.projects[idx]) {
        const p = state.projects[idx];
        document.getElementById('modalTitle').innerText = 'Edit: ' + (p.title || p.filename);
        document.getElementById('formFileName').value = p.filename || '';
        document.getElementById('formCategory').value = p.category || (state.config.categories[0]?.id || 'video');
        document.getElementById('formTitle').value = p.title || '';
        document.getElementById('formTechStack').value = p.techStack || '';
        document.getElementById('formRole').value = p.role || '';
        document.getElementById('formClient').value = p.client || '';
        document.getElementById('formYear').value = p.year || '';
        document.getElementById('formYouTube').value = p.youtubeId || '';
        document.getElementById('formLink').value = p.link || '';
        document.getElementById('formDescription').value = p.description || '';
      } else {
        document.getElementById('modalTitle').innerText = 'Add New Project';
        document.getElementById('projectForm').reset();
      }
    }

    function closeModal() {
      document.getElementById('editModal').classList.remove('open');
    }

    function addUncataloged(filename) {
      openModal(null);
      document.getElementById('formFileName').value = filename;
      document.getElementById('formTitle').value = filename.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
    }

    function handleFormSubmit(e) {
      e.preventDefault();
      const idx = parseInt(document.getElementById('editIndex').value, 10);
      const project = {
        filename: document.getElementById('formFileName').value.trim(),
        category: document.getElementById('formCategory').value,
        title: document.getElementById('formTitle').value.trim(),
        techStack: document.getElementById('formTechStack').value.trim(),
        role: document.getElementById('formRole').value.trim(),
        client: document.getElementById('formClient').value.trim(),
        year: document.getElementById('formYear').value.trim(),
        youtubeId: document.getElementById('formYouTube').value.trim(),
        link: document.getElementById('formLink').value.trim(),
        description: document.getElementById('formDescription').value.trim()
      };

      if (idx >= 0 && idx < state.projects.length) {
        state.projects[idx] = { ...state.projects[idx], ...project };
      } else {
        state.projects.unshift(project);
      }

      closeModal();
      render();
      showToast('Applied locally! Click "Sync & Save" to write to disk.');
    }

    function deleteProject(idx) {
      if (confirm('Are you sure you want to remove this project from metadata.csv?')) {
        state.projects.splice(idx, 1);
        render();
        showToast('Deleted from queue. Click "Sync & Save" to apply.');
      }
    }

    async function saveAll() {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: state.projects, headers: state.headers })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Synced to metadata.csv and portfolio.json!');
        await load();
      } else {
        alert('Error saving: ' + (data.error || 'Unknown'));
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.innerText = msg;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    load();
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Static Media Serving from public/portfolio/media/
  if (url.pathname.startsWith('/portfolio/media/')) {
    const relFile = decodeURIComponent(url.pathname.slice('/portfolio/media/'.length));
    const filePath = path.resolve(mediaDir, relFile);

    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // API Data
  if (url.pathname === '/api/data') {
    const data = loadData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // API Config GET
  if (url.pathname === '/api/config' && req.method === 'GET') {
    const config = loadConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config));
    return;
  }

  // API Config POST
  if (url.pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        if (fs.existsSync(siteConfigPath)) {
          fs.copyFileSync(siteConfigPath, `${siteConfigPath}.bak`);
        }
        fs.writeFileSync(siteConfigPath, JSON.stringify(payload, null, 2), 'utf8');
        console.log('[Editor] Updated site.config.json successfully.');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('[Editor] Error updating site.config.json:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Save Projects
  if (url.pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        saveProjects(payload.projects, payload.headers);
        console.log(`[Editor] Saved ${payload.projects.length} projects to metadata.csv.`);
        
        // Regenerate portfolio.json immediately
        await generatePortfolioJson();
        console.log('[Editor] Regenerated portfolio.json successfully.');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: payload.projects.length }));
      } catch (err) {
        console.error('[Editor] Error during save:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Serve Dashboard HTML
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(HTML_DASHBOARD);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`⚡ Artmax Project Visual Editor Running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}`);
  console.log(`======================================================\n`);
});
