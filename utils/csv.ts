/**
 * CSV parsing and serialization utility for portfolio metadata
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
    headerMap[h.toLowerCase()] = idx;
  });

  const getCol = (row: string[], colName: string): string => {
    const idx = headerMap[colName.toLowerCase()];
    return idx !== undefined && row[idx] !== undefined ? row[idx] : '';
  };

  const projects: ProjectRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 0 || (r.length === 1 && !r[0])) continue;

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
    });
  }

  return { headers, projects };
}

export function projectsToCSV(projects: ProjectRecord[], originalHeaders?: string[]): string {
  const standardHeaders = [
    'FileName', 'Title', 'Description', 'Category', 'TechStack',
    'Role', 'Client', 'Agency', 'Production', 'Director', 'Producer',
    'Tags', 'Link', 'youtubeid', 'Year'
  ];

  const headers = originalHeaders && originalHeaders.length >= standardHeaders.length ? originalHeaders : standardHeaders;
  const rows = [headers];

  for (const p of projects) {
    rows.push([
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
    ]);
  }

  return rows.map(r => r.map(escapeCSVCell).join(',')).join('\n') + '\n';
}
