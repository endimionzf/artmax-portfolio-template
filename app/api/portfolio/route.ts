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
            const ext = path.extname(file);
            const fileName = path.basename(file, ext);
            const isPreview = fileName.toLowerCase().endsWith('-preview');
            const baseName = isPreview ? fileName.slice(0, -8) : fileName;

            if (!categoryResultsMap.has(baseName)) {
                categoryResultsMap.set(baseName, {
                    id: 0,
                    title: baseName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    description: '',
                    category: category,
                    previewSrc: encodeURI(`/portfolio/${category}/${file}`),
                    fullSrc: encodeURI(`/portfolio/${category}/${file}`)
                });
            }
    
            const item = categoryResultsMap.get(baseName);
            if (isPreview) {
                item.previewSrc = encodeURI(`/portfolio/${category}/${file}`);
            } else {
                item.fullSrc = encodeURI(`/portfolio/${category}/${file}`);
                const jsonPath = path.resolve(categoryPath, `${baseName}.json`);
                if (fs.existsSync(jsonPath)) {
                    try {
                        const rawJson = fs.readFileSync(jsonPath, 'utf8');
                        const parsed = JSON.parse(rawJson);
                        item.title = parsed.title || item.title;
                        item.description = parsed.description || item.description;
                    } catch (e) {}
                }
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
