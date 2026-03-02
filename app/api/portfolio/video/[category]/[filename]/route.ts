import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

/**
 * PRODUCTION-GRADE VIDEO STREAMING PROXY (v4)
 * Explicitly designed for Safari/iPhone compatibility on Hostico.
 */

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ category: string; filename: string }> }
) {
    const { category, filename } = await context.params;
    const rootDir = process.cwd();

    // In standalone build, 'public' is inside the root, but we should check both
    let filePath = path.join(rootDir, 'public', 'portfolio', category, filename);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(rootDir, '.next', 'standalone', 'public', 'portfolio', category, filename);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`[Video Proxy] 404: Not Found at ${filePath}`);
        return new NextResponse('Not Found', { status: 404 });
    }

    const { size } = fs.statSync(filePath);
    const range = request.headers.get('range');

    const headers = new Headers({
        'Accept-Ranges': 'bytes',
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
    });

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

        if (start >= size || end >= size) {
            return new NextResponse(null, {
                status: 416,
                headers: { 'Content-Range': `bytes */${size}` }
            });
        }

        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const stream = Readable.toWeb(file) as ReadableStream;

        headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
        headers.set('Content-Length', chunksize.toString());

        return new NextResponse(stream, {
            status: 206,
            headers,
        });
    } else {
        const file = fs.createReadStream(filePath);
        const stream = Readable.toWeb(file) as ReadableStream;

        headers.set('Content-Length', size.toString());

        return new NextResponse(stream, {
            status: 200,
            headers,
        });
    }
}
