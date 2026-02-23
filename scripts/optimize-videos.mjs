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

async function optimizeVideos() {
    console.log('--- Starting Video Optimization (Previews -> 540p) ---');

    for (const dir of TARGET_DIRS) {
        if (!fs.existsSync(dir)) {
            console.warn(`Directory not found: ${dir}`);
            continue;
        }

        console.log(`\nProcessing directory: ${path.relative(PUBLIC_DIR, dir)}`);
        const files = fs.readdirSync(dir);

        for (const file of files) {
            // Target only preview files to avoid touching high-res originals
            if (file.endsWith('-preview.mp4')) {
                const videoPath = path.join(dir, file);
                const tempPath = path.join(dir, `temp-${file}`);
                
                const stats = fs.statSync(videoPath);
                const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                console.log(`  [OPTIMIZING] ${file} (${sizeMB} MB)`);
                
                try {
                    // ffmpeg parameters:
                    // -vf "scale=-2:540": Downscale to 540p height, maintain aspect ratio (divisible by 2)
                    // -c:v libx264: H.264 codec
                    // -crf 26: Constant Rate Factor (23 is default, 26-28 is good for web balance)
                    // -preset faster: encoding speed vs compression ratio
                    // -profile:v high -level 4.1: compat and features
                    // -pix_fmt yuv420p: standard pixel format for web compatibility
                    // -an: Remove audio from previews (save space, since we use spatial audio logic anyway?) 
                    // Wait, let's KEEP audio but compress it heavily if needed, 
                    // actually removing audio from *previews* is a huge win since they are usually background.
                    // But if the user expects sound on hover, we need it. Let's keep a low-bitrate audio.
                    
                    const command = `ffmpeg -i "${videoPath}" -vf "scale=-2:540" -c:v libx264 -crf 28 -preset faster -profile:v high -level 4.1 -pix_fmt yuv420p -c:a aac -b:a 64k "${tempPath}" -y`;
                    
                    execSync(command, { stdio: 'ignore' });
                    
                    // Replace original with temp
                    fs.unlinkSync(videoPath);
                    fs.renameSync(tempPath, videoPath);
                    
                    const newStats = fs.statSync(videoPath);
                    const newSizeMB = (newStats.size / (1024 * 1024)).toFixed(2);
                    const reduction = (((stats.size - newStats.size) / stats.size) * 100).toFixed(1);
                    
                    console.log(`    [SUCCESS] ${newSizeMB} MB (${reduction}% reduction)`);
                } catch (error) {
                    console.error(`    [ERROR] Failed to process ${file}:`, error.message);
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                }
            }
        }
    }

    console.log('\n--- Optimization Complete ---');
}

optimizeVideos().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
