/**
 * CSV parsing and serialization utility for portfolio metadata
 * Supports standard fields + arbitrary custom roles and credit columns.
 */

export interface ProjectRecord {
  filename: string;
  title: string;
  description: string;
  category: string;
  techStack: string;
  role: string;
  client: string;
  agency: string;
  production: string;
  director: string;
  producer: string;
  tags: string;
  link: string;
  youtubeId: string;
  year: string;
  customRoles?: Record<string, string>;
  [key: string]: any;
}

export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
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

export function escapeCSVCell(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  const val = String(str);
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function projectsFromCSV(csvText: string): { headers: string[]; projects: ProjectRecord[] } {
  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    return { headers: [], projects: [] };
  }

  const headers = rows[0].map(h => h.trim());
  const headerMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    headerMap[h.toLowerCase().replace(/[^a-z0-9]/g, '')] = idx;
  });

  const getCol = (row: string[], colName: string): string => {
    const idx = headerMap[colName.toLowerCase().replace(/[^a-z0-9]/g, '')];
    return idx !== undefined && row[idx] !== undefined ? row[idx] : '';
  };

  const knownKeys = new Set([
    'filename', 'title', 'description', 'category', 'techstack',
    'role', 'client', 'agency', 'production', 'director', 'producer',
    'tags', 'link', 'youtubeid', 'year'
  ]);

  const projects: ProjectRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 0 || (r.length === 1 && !r[0])) continue;

    // Collect any extra custom columns
    const customRoles: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!knownKeys.has(lower) && r[colIdx]) {
        customRoles[h] = r[colIdx];
      }
    });

    projects.push({
      filename: getCol(r, 'filename'),
      title: getCol(r, 'title'),
      description: getCol(r, 'description'),
      category: getCol(r, 'category') || 'video',
      techStack: getCol(r, 'techstack'),
      role: getCol(r, 'role'),
      client: getCol(r, 'client'),
      agency: getCol(r, 'agency'),
      production: getCol(r, 'production'),
      director: getCol(r, 'director'),
      producer: getCol(r, 'producer'),
      tags: getCol(r, 'tags'),
      link: getCol(r, 'link'),
      youtubeId: getCol(r, 'youtubeid'),
      year: getCol(r, 'year'),
      customRoles,
    });
  }

  return { headers, projects };
}

export function projectsToCSV(projects: ProjectRecord[], originalHeaders?: string[]): string {
  const headerSet = new Set<string>();

  const baseHeaders = originalHeaders && originalHeaders.length > 0 ? originalHeaders : [
    'FileName', 'Title', 'Description', 'Category', 'TechStack',
    'Role', 'Client', 'Agency', 'Production', 'Director', 'Producer',
    'Tags', 'Link', 'youtubeid', 'Year'
  ];

  baseHeaders.forEach(h => headerSet.add(h));

  // Dynamically collect custom role headers added across any project
  for (const p of projects) {
    if (p.customRoles) {
      Object.keys(p.customRoles).forEach(k => {
        if (k && !headerSet.has(k)) {
          headerSet.add(k);
        }
      });
    }
  }

  const finalHeaders = Array.from(headerSet);
  const rows = [finalHeaders];

  for (const p of projects) {
    const row = finalHeaders.map(header => {
      const lower = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      switch (lower) {
        case 'filename': return p.filename || '';
        case 'title': return p.title || '';
        case 'description': return p.description || '';
        case 'category': return p.category || 'video';
        case 'techstack': return p.techStack || '';
        case 'role': return p.role || '';
        case 'client': return p.client || '';
        case 'agency': return p.agency || '';
        case 'production': return p.production || '';
        case 'director': return p.director || '';
        case 'producer': return p.producer || '';
        case 'tags': return p.tags || '';
        case 'link': return p.link || '';
        case 'youtubeid':
        case 'youtube': return p.youtubeId || '';
        case 'year': return p.year || '';
        default:
          return p.customRoles?.[header] || (p as any)[header] || '';
      }
    });
    rows.push(row);
  }

  return rows.map(r => r.map(escapeCSVCell).join(',')).join('\n') + '\n';
}
