import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to the script location (inside Next.js project /scripts folder)
const NEXT_APP_ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.resolve(NEXT_APP_ROOT, '_RawPortfolioVideos');
const OUTPUT_DIR = path.resolve(NEXT_APP_ROOT, '_ProcessedPortfolio');
const CSV_PATH = path.resolve(NEXT_APP_ROOT, 'public/portfolio/metadata.csv');

/**
 * Universal Video Optimizer (v9.0)
 * 
 * 1. Ultra-Safe iPhone Codecs: libx264 Baseline 3.1 + AAC 44.1kHz.
 * 2. Silent/Sound Previews: Previews now HAVE sound and start at 0s.
 * 3. Metadata Stripping: Removes timecodes/data tracks that crash Safari.
 * 4. Slugification: Flawless Windows case-sensitive renaming & CSV stubs.
 */

function aggressiveSlugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

async function processVideos() {
    console.log('=== Starting Universal Video Optimizer ===');

    if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR, { recursive: true });
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const files = fs.readdirSync(INPUT_DIR);
    const rawVideos = files.filter(f => f.toLowerCase().endsWith('.mp4') || f.toLowerCase().endsWith('.mov'));

    if (rawVideos.length === 0) {
        console.log('[INFO] No raw videos found in _RawPortfolioVideos.');
        return;
    }

    console.log(`[INFO] Found ${rawVideos.length} raw videos.\n`);
    const newEntriesForCSV = [];

    for (const file of rawVideos) {
        const videoPath = path.join(INPUT_DIR, file);
        const rawBasename = file.substring(0, file.lastIndexOf('.'));
        const slugBase = aggressiveSlugify(rawBasename);
        const outBase = path.join(OUTPUT_DIR, slugBase);

        console.log(`--- Processing: ${file} (Slug: ${slugBase}) ---`);

        // Dynamically get video duration to find the midpoint for the preview
        let duration = 0;
        try {
            const ffprobeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
            const durationStr = execSync(ffprobeCmd).toString().trim();
            duration = parseFloat(durationStr);
        } catch (e) {
            console.warn(`  [WARNING] Failed to probe duration for ${file}, defaulting to start.`);
        }

        // Calculate the 5-second slice midpoint
        const sliceStr = duration > 5 ? `-ss ${Math.max(0, (duration / 2) - 2.5)} -t 5` : `-t 5`;

        // Tiers Configuration
        const tiers = [
            {
                suffix: '-preview',
                ext: '.mp4',
                desc: '480p Sound Preview (Midpoint, x264 Baseline 3.1, AAC 44.1k)',
                // ${sliceStr}: 5s slice from middle. 
                // -map_metadata -1 -dn: Strips all data tracks for Safari reliability.
                cmd: `ffmpeg ${sliceStr} -i "${videoPath}" -map 0:v:0 -map 0:a:0? -vf "scale=-2:480" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -r 25 -crf 28 -c:a aac -b:a 128k -ar 44100 -ac 2 -map_metadata -1 -dn -map_chapters -1 -fflags +bitexact -tune fastdecode -movflags +faststart -y`
            },
            {
                suffix: '-mobile',
                ext: '.mp4',
                desc: '720p Mobile (Full, x264 Baseline 3.1, AAC 44.1k)',
                cmd: `ffmpeg -i "${videoPath}" -map 0:v:0 -map 0:a:0? -vf "scale=-2:720" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -r 25 -crf 23 -c:a aac -b:a 128k -ar 44100 -ac 2 -map_metadata -1 -dn -map_chapters -1 -fflags +bitexact -tune fastdecode -movflags +faststart -y`
            },
            {
                suffix: '-desktop-fallback',
                ext: '.mp4',
                desc: '1080p Fallback (Full, x264 Baseline 3.1, AAC 44.1k)',
                cmd: `ffmpeg -i "${videoPath}" -map 0:v:0 -map 0:a:0? -vf "scale=-2:1080" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -r 25 -crf 21 -c:a aac -b:a 128k -ar 44100 -ac 2 -map_metadata -1 -dn -map_chapters -1 -fflags +bitexact -tune fastdecode -movflags +faststart -y`
            },
            {
                suffix: '-desktop',
                ext: '.mp4',
                desc: '1080p High Quality (Full, AV1/NVENC, Opus Audio)',
                cmd: `ffmpeg -hwaccel cuda -i "${videoPath}" -map 0:v:0 -map 0:a:0? -vf "scale=-2:1080" -c:v av1_nvenc -preset p6 -rc vbr -cq 30 -b:v 0 -c:a libopus -b:a 128k -y`
            }
        ];

        for (const tier of tiers) {
            const outPath = `${outBase}${tier.suffix}${tier.ext}`;
            if (fs.existsSync(outPath)) {
                console.log(`  [SKIP] ${tier.suffix} (already exists)`);
                continue;
            }
            console.log(`  [ENCODE] ${tier.suffix} (${tier.desc})`);
            try {
                execSync(`${tier.cmd} "${outPath}"`, { stdio: 'inherit' });
            } catch (e) {
                console.error(`  [ERROR] Failed to encode ${tier.suffix}`);
            }
        }

        // Thumbnail Extraction
        const thumbPath = `${outBase}.jpg`;
        if (fs.existsSync(thumbPath)) {
            console.log(`  [SKIP] Thumbnail (already exists)`);
        } else {
            console.log(`  [EXTRACT] 0.5s Thumbnail (.jpg)`);
            try {
                const thumbCmd = `ffmpeg -i "${videoPath}" -ss 0.5 -vframes 1 -q:v 2 -y`;
                execSync(`${thumbCmd} "${thumbPath}"`, { stdio: 'inherit' });
            } catch (e) {
                console.error(`  [ERROR] Failed to extract thumbnail`);
            }
        }

        newEntriesForCSV.push(slugBase);
        console.log('');
    }

    // 3. Update CSV Metadata
    console.log('--- Checking metadata.csv ---');
    if (fs.existsSync(CSV_PATH) && newEntriesForCSV.length > 0) {
        let csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
        let linesAppended = 0;

        for (const basename of newEntriesForCSV) {
            const pattern = new RegExp(`^${basename},`, 'm');
            if (!pattern.test(csvContent)) {
                const humanTitle = basename.replace(/[-_]/g, ' ');
                const newRow = `\n${basename},"${humanTitle}","","","","","","","","",""`;
                fs.appendFileSync(CSV_PATH, newRow);
                csvContent += newRow;
                console.log(`  [CSV APPEND] Added stub for: ${basename}`);
                linesAppended++;
            }
        }
        console.log(`  [CSV] Updated with ${linesAppended} new stubs.`);
    }

    console.log('\n=== Universal Optimization Complete! ===');
    console.log(`Location: ${OUTPUT_DIR}`);
}

processVideos().catch(err => {
    console.error('[FATAL ERROR]', err);
    process.exit(1);
});
