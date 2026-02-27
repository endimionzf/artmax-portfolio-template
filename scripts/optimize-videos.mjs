import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to the script location (inside Next.js project /scripts folder)
const NEXT_APP_ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.resolve(NEXT_APP_ROOT, '../_RawPortfolioVideos');
const OUTPUT_DIR = path.resolve(NEXT_APP_ROOT, '../_ProcessedPortfolio');
const CSV_PATH = path.resolve(NEXT_APP_ROOT, 'public/portfolio/metadata.csv');

/**
 * Automates the portfolio video ingestion pipeline.
 * Extracts 3 web-tiers, 1 thumbnail, and updates the metadata CSV.
 */
async function processVideos() {
    console.log('=== Starting Video Ingestion Pipeline ===');

    // 1. Ensure absolute directories exist
    if (!fs.existsSync(INPUT_DIR)) {
        console.log(`[INIT] Creating Input Directory: ${INPUT_DIR}`);
        fs.mkdirSync(INPUT_DIR, { recursive: true });
    }
    if (!fs.existsSync(OUTPUT_DIR)) {
        console.log(`[INIT] Creating Output Directory: ${OUTPUT_DIR}`);
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const files = fs.readdirSync(INPUT_DIR);
    const rawVideos = files.filter(f => f.toLowerCase().endsWith('.mp4') || f.toLowerCase().endsWith('.mov'));

    if (rawVideos.length === 0) {
        console.log('[INFO] No raw videos found. Drop some .mp4 or .mov files into:');
        console.log(`       ${INPUT_DIR}`);
        return;
    }

    console.log(`[INFO] Found ${rawVideos.length} raw videos to process.\n`);

    const newEntriesForCSV = [];

    for (const file of rawVideos) {
        const videoPath = path.join(INPUT_DIR, file);
        const basename = file.substring(0, file.lastIndexOf('.'));
        const outBase = path.join(OUTPUT_DIR, basename);
        
        console.log(`--- Processing: ${file} ---`);

        // Encode Tiers
        const tiers = [
            { 
                suffix: '-preview', 
                ext: '.mp4',
                desc: '540p YUV420p (Broadest Compatibility, No Audio)',
                cmd: `ffmpeg -hwaccel cuda -i "${videoPath}" -vf "scale=-2:540" -c:v h264_nvenc -profile:v main -pix_fmt yuv420p -preset p4 -rc vbr -cq 32 -an -movflags +faststart -y` 
            },
            { 
                suffix: '-mobile', 
                ext: '.mp4',
                desc: '720p YUV420p (Mobile Compatible, AAC Audio)',
                cmd: `ffmpeg -hwaccel cuda -i "${videoPath}" -vf "scale=-2:720" -c:v h264_nvenc -profile:v main -pix_fmt yuv420p -preset p5 -rc vbr -cq 28 -c:a aac -b:a 96k -movflags +faststart -y` 
            },
            { 
                suffix: '-desktop', 
                ext: '.mp4', 
                desc: '1080p AV1 (Desktop Hardware, Opus Audio)',
                cmd: `ffmpeg -hwaccel cuda -hwaccel_output_format cuda -i "${videoPath}" -vf "scale_cuda=-2:1080" -c:v av1_nvenc -preset p6 -rc vbr -cq 30 -b:v 0 -c:a libopus -b:a 128k -y` 
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
            console.log(`  [EXTRACT] First-frame thumbnail (.jpg)`);
            try {
                // Extracts the very first frame at high quality (q:v 2)
                const thumbCmd = `ffmpeg -hwaccel cuda -i "${videoPath}" -vframes 1 -q:v 2 -y`;
                execSync(`${thumbCmd} "${thumbPath}"`, { stdio: 'inherit' });
            } catch (e) {
                console.error(`  [ERROR] Failed to extract thumbnail`);
            }
        }
        
        // Mark for CSV update check
        newEntriesForCSV.push(basename);
        console.log(''); // newline spacing
    }

    // 3. Update CSV Metadata
    console.log('--- Checking metadata.csv ---');
    if (fs.existsSync(CSV_PATH) && newEntriesForCSV.length > 0) {
        let csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
        let linesAppended = 0;

        for (const basename of newEntriesForCSV) {
            // Very naive check to see if the base filename exists ANYWHERE in the CSV to avoid duplicates
            // We pad it with quote/comma bounds conceptually, but a simple string includes is usually safe enough for unique names
            if (!csvContent.includes(`${basename}`)) {
                // Schema: FileName,Title,Description,Client,Agency,Production,Director,Producer,Tags,Link
                // Title humanized: replacing dashes/underscores with spaces
                const humanTitle = basename.replace(/[-_]/g, ' ');
                const newRow = `\n${basename},"${humanTitle}","","","","","","","",""`;
                
                fs.appendFileSync(CSV_PATH, newRow);
                csvContent += newRow; // keep in memory for subsequent checks
                console.log(`  [CSV APPEND] Added stub for: ${basename}`);
                linesAppended++;
            }
        }
        
        if (linesAppended === 0) {
            console.log('  [CSV] All videos already present in metadata.csv. No new rows added.');
        } else {
            console.log(`  [CSV] Successfully updated metadata.csv with ${linesAppended} new stubs.`);
        }
    } else if (!fs.existsSync(CSV_PATH)) {
        console.error(`  [CSV WARNING] metadata.csv not found at ${CSV_PATH}. Make sure the app is initialized.`);
    }

    console.log('\n=== Pipeline Complete! ===');
    console.log(`All files are located in: ${OUTPUT_DIR}`);
    console.log('You can now manually copy them into the Next.js /public/portfolio folders.');
}

processVideos().catch(err => {
    console.error('[FATAL ERROR]', err);
    process.exit(1);
});