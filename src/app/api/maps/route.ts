import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@netlify/blobs';

// Shared team library: maps stored as JSON blobs in Netlify Blobs, keyed by
// map id. Available automatically when deployed on Netlify; in local dev the
// store is absent and the client falls back to localStorage only.

export const dynamic = 'force-dynamic';

const STORE = 'vsm-maps';
const MAX_MAPS = 300;
const MAX_BYTES = 400_000; // per map

interface StoredStream {
    id: string;
    updatedAt?: number;
    steps?: unknown[];
}

export async function GET() {
    try {
        const store = getStore(STORE);
        const { blobs } = await store.list();
        const streams = (
            await Promise.all(blobs.slice(0, MAX_MAPS).map((b) => store.get(b.key, { type: 'json' })))
        ).filter(Boolean);
        return NextResponse.json({ available: true, streams });
    } catch {
        return NextResponse.json({ available: false, streams: [] });
    }
}

export async function POST(req: NextRequest) {
    let body: { streams?: StoredStream[] };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const incoming = Array.isArray(body.streams) ? body.streams.slice(0, 50) : [];
    if (incoming.length === 0) return NextResponse.json({ error: 'streams required' }, { status: 400 });

    try {
        const store = getStore(STORE);
        let saved = 0;
        for (const stream of incoming) {
            if (!stream || typeof stream.id !== 'string' || !/^[\w-]{1,80}$/.test(stream.id)) continue;
            if (!Array.isArray(stream.steps)) continue;
            if (JSON.stringify(stream).length > MAX_BYTES) continue;
            const existing = (await store.get(stream.id, { type: 'json' })) as StoredStream | null;
            // Last write wins by the map's own updatedAt - keeps devices from
            // overwriting newer edits with stale copies.
            if (!existing || (existing.updatedAt ?? 0) <= (stream.updatedAt ?? 0)) {
                await store.setJSON(stream.id, stream);
                saved++;
            }
        }
        return NextResponse.json({ available: true, saved });
    } catch {
        return NextResponse.json({ available: false, saved: 0 });
    }
}

export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id') ?? '';
    if (!/^[\w-]{1,80}$/.test(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    try {
        const store = getStore(STORE);
        await store.delete(id);
        return NextResponse.json({ available: true, deleted: id });
    } catch {
        return NextResponse.json({ available: false });
    }
}
