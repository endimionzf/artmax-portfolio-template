import http from 'http';
import fs from 'fs';
import path from 'path';
import { generatePortfolioJson } from './generate-portfolio-json.mjs';

/**
 * Artmax Portfolio Local Visual Editor
 * Lightweight zero-dependency dashboard on http://127.0.0.1:3333
 * Allows visual inspection, uncataloged media discovery, and 1-click metadata editing.
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
  return { categories: [{ id: 'video', label: 'Video', color: '#ff003c' }] };
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

  // Find uncataloged media in public/portfolio/media/
  const uncataloged = [];
  const existingSlugs = new Set(projects.map(p => aggressiveSlugify(p.filename)));

  if (fs.existsSync(mediaDir)) {
    const files = fs.readdirSync(mediaDir);
    const mediaFiles = files.filter(f =>
      f.endsWith('.mp4') || f.endsWith('.webm') ||
      f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg') || f.endsWith('.webp')
    );

    const detectedBases = new Set();
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
  <title>Artmax Studio // Project Editor</title>
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
      margin: 0 auto 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
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
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--accent-cyan);
      font-weight: bold;
    }
    .uncataloged-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .uncataloged-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-family: monospace;
    }
    .uncataloged-item button {
      background: var(--accent-cyan);
      border: none;
      color: #000;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
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
      backdrop-filter: blur(16px);
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
    }
    .card:hover {
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-4px);
      box-shadow: 0 16px 32px rgba(0,0,0,0.5);
    }
    .thumbnail {
      width: 100%;
      height: 180px;
      background: #111;
      position: relative;
      overflow: hidden;
    }
    .thumbnail img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumbnail-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: monospace;
      font-size: 11px;
      color: var(--text-muted);
      letter-spacing: 1px;
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

    /* Modal */
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
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    .form-group {
      margin-bottom: 18px;
    }
    .form-label {
      display: block;
      font-family: monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .form-input, .form-select, .form-textarea {
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-size: 14px;
      outline: none;
      transition: border 0.2s ease;
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      border-color: var(--accent-cyan);
    }
    .form-textarea {
      resize: vertical;
      min-height: 80px;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
    }
    .status-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--accent-cyan);
      color: #000;
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      padding: 12px 24px;
      border-radius: 9999px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      display: none;
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
      <button class="btn" onclick="openModal(null)">+ Add Project</button>
      <button class="btn btn-primary" onclick="saveAll()">Sync & Save</button>
    </div>
  </div>

  <div class="container">
    <div id="uncatalogedBanner" class="banner" style="display: none;">
      <div class="banner-title">⚡ Uncataloged Media Discovered in public/portfolio/media/</div>
      <div id="uncatalogedList" class="uncataloged-list"></div>
    </div>

    <div id="projectGrid" class="grid"></div>
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

  // API Save
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
