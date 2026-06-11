// Server-side AI endpoint for VSM Buddy.
// Keeps the Gemini API key on the server (GEMINI_API_KEY) so it is never
// shipped to the browser. Falls back to NEXT_PUBLIC_GEMINI_API_KEY only so
// existing dev setups keep working.

import { NextRequest, NextResponse } from 'next/server';

const MODEL = 'gemini-2.0-flash';

function apiKey(): string | undefined {
    return process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
}

async function gemini(prompt: string): Promise<string> {
    const key = apiKey();
    if (!key) throw new Error('not-configured');
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
        }
    );
    if (!res.ok) throw new Error(`gemini-${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('empty-response');
    return text;
}

export async function GET() {
    return NextResponse.json({ configured: !!apiKey() });
}

const PROMPTS: Record<string, (payload: string) => string> = {
    draft: (description) => `You are a lean consultant helping someone draft a value stream map.
From the process description below, extract the sequence of process steps.
Reply with ONLY a JSON object, no markdown fences, in this exact shape:
{"name":"short process name","steps":[{"name":"step name","cycleTimeSec":120,"inventoryBefore":0,"operators":1,"notes":"optional observation"}]}
Rules: cycleTimeSec is the hands-on work time per unit in seconds (estimate sensibly from the text; default 300 if unknown). inventoryBefore is how many items typically queue before the step (default 0 if not mentioned). Keep step names under 5 words. 3-10 steps.

Process description:
${description}`,

    sanity: (json) => `You are reviewing data collected for a value stream map. Identify up to 4 values that look suspicious or inconsistent (e.g. implausible times, queues out of proportion to demand, yields that contradict the notes). Be specific and reference step names. If everything looks plausible, say so in one sentence. Reply as short plain-text bullet points, no markdown headers.

Map data (times in seconds, queues in units):
${json}`,

    narrate: (json) => `Write a plain-English summary of this value stream map for a busy director: exactly 3 short paragraphs. 1) What happens today and how long a unit of work takes end to end versus actual work time. 2) Where the time is going (queues, bottleneck). 3) What to fix first and the expected effect. No jargon, no bullet points, no headers.

Map data:
${json}`,

    sow: (json) => `Improve the wording of this draft Scope of Works for automating a business process with Microsoft 365 tools. Keep ALL the structure, facts, numbers and tool recommendations exactly as given - only make the prose clearer, more confident and more professional. Reply with the improved text only, same section order, plain text with the same section titles.

Draft:
${json}`,
};

export async function POST(req: NextRequest) {
    let body: { mode?: string; payload?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 });
    }
    const make = body.mode ? PROMPTS[body.mode] : undefined;
    if (!make || typeof body.payload !== 'string' || body.payload.length > 20000) {
        return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 });
    }
    if (!apiKey()) {
        return NextResponse.json({ ok: false, error: 'not-configured' }, { status: 503 });
    }
    try {
        const text = await gemini(make(body.payload));
        return NextResponse.json({ ok: true, text });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'error';
        return NextResponse.json({ ok: false, error: msg }, { status: 502 });
    }
}
