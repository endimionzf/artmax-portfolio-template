import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const TARGET_DIRS = [
    path.join(PUBLIC_DIR, 'portfolio', 'video'),
    path.join(PUBLIC_DIR, 'portfolio', '3d'),
];

async function generateThumbnails() {
    console.log('--- Starting Thumbnail Generation ---');

    for (const dir of TARGET_DIRS) {
        if (!fs.existsSync(dir)) {
            console.warn(`Directory not found: ${dir}`);
            continue;
        }

        console.log(`\nProcessing directory: ${path.relative(PUBLIC_DIR, dir)}`);
        const files = fs.readdirSync(dir);

        for (const file of files) {
            if (file.endsWith('.mp4')) {
                const videoPath = path.join(dir, file);
                const thumbnailPath = videoPath.replace('.mp4', '.jpg');

                if (fs.existsSync(thumbnailPath)) {
                    console.log(`  [SKIPPED] ${file} (JPG already exists)`);
                    continue;
                }

                console.log(`  [GENERATING] ${file} -> ${path.basename(thumbnailPath)}`);
                
                try {
                    // Extract frame at 1 second (-ss 00:00:01)
                    // -vframes 1: output 1 frame
                    // -q:v 2: high quality (2-5 is good)
                    const command = `ffmpeg -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 2 "${thumbnailPath}" -y`;
                    execSync(command, { stdio: 'ignore' });
                    console.log(`    [SUCCESS] Created ${path.basename(thumbnailPath)}`);
                } catch (error) {
                    console.error(`    [ERROR] Failed to process ${file}:`, error.message);
                }
            }
        }
    }

    console.log('\n--- Generation Complete ---');
}

generateThumbnails().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
