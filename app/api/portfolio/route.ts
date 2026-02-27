import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Force dynamic execution to prevent build-time filesystem scanning
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PRODUCTION-SAFE PORTFOLIO SCANNER
 * This route is designed to be hyper-defensive for Linux/Hostico environments.
 * It will never return a plain-text 500 error; it always returns valid JSON.
 */
export async function GET() {
  const results: any[] = [];
  let idCounter = 1;

  try {
    // 1. Identify Root - Hostico maps this to /home/msvdlfot/public_html/artmax-app
    const rootDir = process.cwd();
    const publicDir = path.resolve(rootDir, 'public', 'portfolio');
    
    // Diagnostic logging - visible in cPanel Node.js error log
    console.log(`[Portfolio API] Scanning folder: ${publicDir}`);

    // Early Check: Root exists?
    if (!fs.existsSync(publicDir)) {
      console.warn(`[Portfolio API] Root directory not found: ${publicDir}`);
      return NextResponse.json([{ 
          id: 1, 
          title: "Public folder not found", 
          description: `Checked: ${publicDir}`,
          category: "video",
          previewSrc: "",
          fullSrc: ""
      }]);
    }

    // 2. Parse CSV Metadata
    const csvMetadata = new Map<string, any>();
    const csvPath = path.resolve(publicDir, 'metadata.csv');
    if (fs.existsSync(csvPath)) {
        try {
            console.log(`[Portfolio API] Found metadata.csv, parsing...`);
            const csvText = fs.readFileSync(csvPath, 'utf8');
            
            // Simple but robust CSV parser for quoted multi-line fields
            const rows: string[][] = [];
            let currentRow: string[] = [];
            let currentCell = '';
            let inQuotes = false;
            
            for (let i = 0; i < csvText.length; i++) {
                const char = csvText[i];
                const nextChar = csvText[i + 1];
                
                if (char === '"' && inQuotes && nextChar === '"') {
                    // Escaped quote
                    currentCell += '"';
                    i++; // skip next char
                } else if (char === '"') {
                    // Toggle quotes
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    // End of cell
                    currentRow.push(currentCell.trim());
                    currentCell = '';
                } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
                    // End of row
                    if (char === '\r') i++; // skip \n
                    currentRow.push(currentCell.trim());
                    rows.push(currentRow);
                    currentRow = [];
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            // Push final row if trailing newline was missing
            if (currentRow.length > 0 || currentCell) {
                currentRow.push(currentCell.trim());
                rows.push(currentRow);
            }

            if (rows.length > 1) {
                // Determine column indices dynamically
                const headers = rows[0].map(h => h.toLowerCase());
                const getIdx = (name: string) => headers.indexOf(name);
                
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

                if (colFile !== -1) {
                    for (let r = 1; r < rows.length; r++) {
                        const row = rows[r];
                        if (!row[colFile]) continue;
                        
                        csvMetadata.set(row[colFile], {
                            title: colTitle !== -1 ? row[colTitle] : undefined,
                            description: colDesc !== -1 ? row[colDesc] : undefined,
                            client: colClient !== -1 ? row[colClient] : undefined,
                            agency: colAgency !== -1 ? row[colAgency] : undefined,
                            production: colProduction !== -1 ? row[colProduction] : undefined,
                            director: colDirector !== -1 ? row[colDirector] : undefined,
                            producer: colProducer !== -1 ? row[colProducer] : undefined,
                            tags: colTags !== -1 ? row[colTags] : undefined,
                            link: colLink !== -1 ? row[colLink] : undefined,
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`[Portfolio API] Failed to parse metadata.csv`, e);
        }
    }

    const categories = ['video', '3d', 'ai'];
    
    // 3. Scan Categories
    for (const category of categories) {
      const categoryPath = path.resolve(publicDir, category);
      
      if (fs.existsSync(categoryPath)) {
        try {
          // Check if it's a directory
          const stats = fs.lstatSync(categoryPath);
          if (!stats.isDirectory()) continue;

          const files = fs.readdirSync(categoryPath);
          const categoryResultsMap = new Map<string, any>();
          
          const mediaFiles = files.filter(f => 
            f.endsWith('.mp4') || f.endsWith('.webm') || 
            f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')
          );
    
          for (const file of mediaFiles) {
            const ext = path.extname(file).toLowerCase();
            const fileName = path.basename(file, path.extname(file));
            
            // Tier patterns
            const isPreview = fileName.toLowerCase().endsWith('-preview');
            const isMobileSuffix = fileName.toLowerCase().endsWith('-mobile');
            const isDesktopSuffix = fileName.toLowerCase().endsWith('-desktop');
            const isImage = ext === '.jpg' || ext === '.png' || ext === '.jpeg';

            // Find the canonical base name (strip any tier suffixes)
            let baseName = fileName;
            if (isPreview) baseName = fileName.slice(0, -8);
            else if (isMobileSuffix) baseName = fileName.slice(0, -7);
            else if (isDesktopSuffix) baseName = fileName.slice(0, -8);

            if (!categoryResultsMap.has(baseName)) {
                // Start with defaults
                const defaultTitle = baseName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let meta = {
                    id: 0,
                    title: defaultTitle,
                    description: '',
                    category: category,
                    previewSrc: encodeURI(`/portfolio/${category}/${baseName}-preview.mp4`),
                    fullSrc: encodeURI(`/portfolio/${category}/${baseName}.mp4`),
                    posterSrc: encodeURI(`/portfolio/${category}/${baseName}.jpg`), // Default guess
                    client: '',
                    agency: '',
                    production: '',
                    director: '',
                    producer: '',
                    tags: '',
                    link: ''
                };

                // Merge CSV Data if present
                if (csvMetadata.has(baseName)) {
                    const csvData = csvMetadata.get(baseName);
                    if (csvData.title) meta.title = csvData.title;
                    if (csvData.description) meta.description = csvData.description;
                    if (csvData.client) meta.client = csvData.client;
                    if (csvData.agency) meta.agency = csvData.agency;
                    if (csvData.production) meta.production = csvData.production;
                    if (csvData.director) meta.director = csvData.director;
                    if (csvData.producer) meta.producer = csvData.producer;
                    if (csvData.tags) meta.tags = csvData.tags;
                    if (csvData.link) meta.link = csvData.link;
                }

                categoryResultsMap.set(baseName, meta);
            }
    
            const item = categoryResultsMap.get(baseName);
            
            // If this file is an image, use it as the definitive poster
            if (isImage) {
                item.posterSrc = encodeURI(`/portfolio/${category}/${file}`);
            }
            
            // If we found a JSON, merge metadata.
            if (ext === '.json') {
                const jsonPath = path.resolve(categoryPath, file);
                try {
                    const rawJson = fs.readFileSync(jsonPath, 'utf8');
                    const parsed = JSON.parse(rawJson);
                    item.title = parsed.title || item.title;
                    item.description = parsed.description || item.description;
                } catch (e) {}
            }
          }

          categoryResultsMap.forEach((item) => {
              item.id = idCounter++;
              results.push(item);
          });
        } catch (innerError) {
          console.error(`[Portfolio API] Error scanning category ${category}:`, innerError);
        }
      }
    }

    // 4. Interleave and Finish
    const videoFiles = results.filter(r => r.category === 'video');
    const d3Files = results.filter(r => r.category === '3d');
    const aiFiles = results.filter(r => r.category === 'ai');
    const maxLength = Math.max(videoFiles.length, d3Files.length, aiFiles.length);
    const interleaved = [];
    for (let i = 0; i < maxLength; i++) {
        if (i < videoFiles.length) interleaved.push(videoFiles[i]);
        if (i < d3Files.length) interleaved.push(d3Files[i]);
        if (i < aiFiles.length) interleaved.push(aiFiles[i]);
    }
    const finalResults = interleaved.map((item, idx) => ({ ...item, id: idx + 1 }));
    return NextResponse.json(finalResults);

  } catch (globalError: any) {
    console.error("[Portfolio API] Global Failure:", globalError);
    return NextResponse.json([{
        id: 1,
        title: "API Error",
        description: globalError.message || "Unknown error occurred",
        category: "video",
        previewSrc: "",
        fullSrc: ""
    }]);
  }
}
