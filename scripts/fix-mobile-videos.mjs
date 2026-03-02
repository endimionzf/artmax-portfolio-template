import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const portfolioDir = path.join(rootDir, 'public', 'portfolio');

/**
 * fix-mobile-videos.mjs (v7 - ULTRAPATCH THE ULTIMATE)
 * 
 * THE DEFINITIVE IPHONE FIX.
 * 1. Safe Renaming: Handles Windows case-insensitivity flawlessly.
 * 2. Strict Stream Mapping: Strips invisible data/timecode tracks.
 * 3. Dual-Tier Rebuild: Fixes BOTH -mobile (audio) and -preview (silent).
 * 4. Apple Standard: AAC-LC 44.1kHz + Baseline 3.1.
 */

const categories = ['video', '3d', 'ai'];

function aggressiveSlugify(text) {
    return text
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function safeRename(oldPath, newPath) {
    if (oldPath === newPath) return;
    const oldLower = oldPath.toLowerCase().replace(/\\/g, '/');
    const newLower = newPath.toLowerCase().replace(/\\/g, '/');
    if (oldLower === newLower) {
        const tempPath = oldPath + ".tmp_rename";
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        fs.renameSync(oldPath, tempPath);
        fs.renameSync(tempPath, newPath);
    } else {
        if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
        fs.renameSync(oldPath, newPath);
    }
}

console.log("--- Starting iPhone-Safe Mobile Video Sync (ULTRAPATCH 7.0) ---");

categories.forEach(category => {
    const categoryPath = path.join(portfolioDir, category);
    if (!fs.existsSync(categoryPath)) return;

    const files = fs.readdirSync(categoryPath);

    // Pass 1: Rename EVERYTHING to lowercase underscores safely
    files.forEach(file => {
        const filePath = path.join(categoryPath, file);
        const ext = path.extname(file).toLowerCase();
        const nameOnly = path.basename(file, path.extname(file));
        const suffixes = ['-desktop-fallback', '-desktop', '-mobile', '-preview'];

        let foundSuffix = "";
        let rawBase = nameOnly;
        for (const s of suffixes) {
            if (nameOnly.toLowerCase().endsWith(s)) {
                foundSuffix = s;
                rawBase = nameOnly.slice(0, -s.length);
                break;
            }
        }

        const slugBase = aggressiveSlugify(rawBase);
        const finalName = `${slugBase}${foundSuffix}${ext}`;
        const newPath = path.join(categoryPath, finalName);
        if (filePath !== newPath) safeRename(filePath, newPath);
    });
});

// Pass 2: Re-run Encoding for BOTH PREVIEW and MOBILE
console.log("\n--- Starting Stream-Stripping Pass (Mobile & Preview) ---");

categories.forEach(category => {
    const categoryPath = path.join(portfolioDir, category);
    if (!fs.existsSync(categoryPath)) return;

    const files = fs.readdirSync(categoryPath);
    const desktops = files.filter(f => f.endsWith('-desktop.mp4'));

    desktops.forEach(desktopFile => {
        const slugBase = desktopFile.replace(/-desktop\.mp4$/, '');
        const desktopPath = path.join(categoryPath, desktopFile);

        const previewPath = path.join(categoryPath, `${slugBase}-preview.mp4`);
        const mobilePath = path.join(categoryPath, `${slugBase}-mobile.mp4`);

        // --- PREVIEW (Strict Tiny & Silent) ---
        console.log(`\nProcessing Preview: ${slugBase}-preview.mp4`);
        // -an (No Audio) + -dn (No data/timecode)
        const previewCmd = `ffmpeg -i "${desktopPath}" -map 0:v:0 -an -dn -vf "scale=-2:480" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -r 25 -crf 30 -maxrate 200k -bufsize 400k -map_metadata -1 -fflags +bitexact -tune fastdecode -movflags +faststart -y "${previewPath}"`;

        // --- MOBILE (Strict Audio LC 44.1kHz) ---
        console.log(`Processing Mobile: ${slugBase}-mobile.mp4`);
        // -dn (No data/timecode) + Map strict streams
        const mobileCmd = `ffmpeg -i "${desktopPath}" -map 0:v:0 -map 0:a:0? -dn -vf "scale=-2:720" -c:v libx264 -profile:v baseline -level 3.1 -pix_fmt yuv420p -r 25 -crf 23 -c:a aac -b:a 128k -ar 44100 -ac 2 -map_metadata -1 -fflags +bitexact -tune fastdecode -movflags +faststart -y "${mobilePath}"`;

        try {
            console.log(`  Fixing preview...`);
            execSync(previewCmd, { stdio: 'ignore' });
            console.log(`  Fixing mobile...`);
            execSync(mobileCmd, { stdio: 'ignore' });
            console.log(`  Success!`);
        } catch (err) {
            console.error(`  Failed encoding ${slugBase}:`, err.message);
        }
    });
});

console.log("\n--- SYNC COMPLETE ---");
