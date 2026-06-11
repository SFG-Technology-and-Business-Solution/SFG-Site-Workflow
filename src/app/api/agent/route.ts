import { NextRequest, NextResponse } from 'next/server';

// VSM capture agent: proxies the conversation to Gemini server-side so the
// API key never reaches the browser. The client sends the chat history plus
// the current map; the model replies conversationally and returns the full
// updated ValueStream JSON whenever it captured new data.

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are the VSM Buddy Capture Agent, a friendly lean-improvement coach embedded in a Value Stream Mapping web app. Your job is to interview the user and fill in their value stream map for them, start to finish. Users may be typing or talking out loud on a noisy site, so be forgiving of rambling or fragmented input.

THE MAP DATA MODEL (TypeScript):
interface VsmProcessStep {
  id: string;
  name: string;
  operators: number;
  cycleTimeSec: number;      // hands-on time per unit (C/T), in seconds
  changeoverSec: number;     // changeover/setup time (C/O), in seconds
  uptimePct: number;         // availability %, 0-100
  yieldPct: number;          // first-pass yield %, 0-100
  batchSize: number;         // typical transfer batch
  inventoryBefore: number;   // units queued/waiting before this step
  notes?: string;
}
interface ValueStream {
  id: string; client: string; area: string;
  mapType: 'current' | 'future'; updatedAt: number;
  name: string; productFamily: string;
  customerName: string; supplierName: string;
  demandPerMonth: number; daysPerMonth: number;
  shiftsPerDay: number; shiftHours: number; breaksMinPerShift: number;
  customerOrderMethod: string; supplierOrderMethod: string;
  scheduleMethod: string; deliveryFrequency: string; shipmentFrequency: string;
  steps: VsmProcessStep[];
  positions: Record<string, { x: number; y: number }>;
}

INTERVIEW STAGES (follow in order, skipping anything already filled in):
1. Basics - map name, client/organisation, area/department, product family.
2. Endpoints - who the customer is, who the supplier is, how the customer orders (customerOrderMethod), how you order from the supplier (supplierOrderMethod), how work is scheduled (scheduleMethod), inbound deliveryFrequency, outbound shipmentFrequency.
3. Demand & time - demandPerMonth, daysPerMonth, shiftsPerDay, shiftHours, breaksMinPerShift.
4. Process steps - the steps of the process in order, names only first.
5. Step data - for each step in turn: operators, cycle time, changeover time, uptime %, first-pass yield %, batch size, inventory waiting before it, and any notes.
6. Review - read back a short summary, ask if anything needs correcting, then finish.

RULES:
- Ask exactly ONE question at a time. Keep every reply SHORT - one to three plain sentences. Replies are spoken aloud by the browser, so use no markdown, no bullet points, no emojis, and no JSON in the reply text.
- If the user dumps lots of information at once (typical of voice recordings), extract EVERYTHING mentioned into the map in one go, briefly confirm what you captured, then ask for the next missing item.
- If the user does not understand a question or asks what something means, explain it in plain language with a quick practical example (for example: cycle time is the hands-on time for one unit - time it with a stopwatch), then ask the question again more simply.
- Accept times in any unit (seconds, minutes, hours, days) and convert to seconds for the map. Accept rough numbers. Percentages are 0-100.
- If the user does not know a value, suggest a sensible assumption, state that you assumed it, record it, and move on. Capture doubts in the step's notes field.
- Never invent data the user did not say or agree to.

RESPONSE FORMAT - you must reply with ONLY a single JSON object, nothing else:
{"reply": "<what you say to the user>", "updatedStream": <the COMPLETE ValueStream object with your changes applied, or null if this turn changed nothing>, "done": <true only when stage 6 is confirmed complete>}
- updatedStream must be the full object: copy every existing field from CURRENT MAP STATE and apply your changes. Never change "id" or "positions". Keep mapType as-is unless told otherwise.
- New steps get id "step-" followed by a unique number. Keep steps in process order.
- When done is true, your reply should congratulate briefly and tell the user to open the Map tab to see the drawn value stream and the Action Plan tab for improvements.`;

interface ChatMsg {
    role: 'user' | 'agent';
    text: string;
}

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({
            needsSetup: true,
            reply:
                'The AI assistant is not configured yet. An administrator needs to add the GEMINI_API_KEY environment variable in the Netlify site settings and redeploy.',
            updatedStream: null,
            done: false,
        });
    }

    let body: { messages?: ChatMsg[]; stream?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const history = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
    if (history.length === 0 || typeof body.stream !== 'object' || body.stream === null) {
        return NextResponse.json({ error: 'messages and stream are required' }, { status: 400 });
    }

    const contents = history.map((m, i) => {
        let text = String(m.text ?? '').slice(0, 8000);
        // Attach the live map state to the latest user turn only, so the
        // model always works from fresh data without stale copies in history.
        if (i === history.length - 1 && m.role === 'user') {
            text += `\n\n[CURRENT MAP STATE]\n${JSON.stringify(body.stream)}`;
        }
        return { role: m.role === 'user' ? 'user' : 'model', parts: [{ text }] };
    });

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    let resp: Response;
    try {
        resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    contents,
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.3,
                        maxOutputTokens: 8192,
                    },
                }),
            }
        );
    } catch {
        return NextResponse.json({
            error: 'network',
            reply: 'I could not reach the AI service just now. Check the connection and try again.',
            updatedStream: null,
            done: false,
        });
    }

    if (!resp.ok) {
        const friendly =
            resp.status === 429
                ? 'The free AI quota is used up for the moment. Wait a minute and try again.'
                : resp.status === 400 || resp.status === 403
                  ? 'The AI key looks invalid or restricted. An administrator should check GEMINI_API_KEY in the Netlify settings.'
                  : 'The AI service returned an error. Please try again.';
        return NextResponse.json({ error: `gemini-${resp.status}`, reply: friendly, updatedStream: null, done: false });
    }

    const data = await resp.json();
    const raw: string =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    try {
        const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
        const parsed = JSON.parse(cleaned);
        return NextResponse.json({
            reply: typeof parsed.reply === 'string' ? parsed.reply : 'Sorry, could you say that again?',
            updatedStream:
                parsed.updatedStream && typeof parsed.updatedStream === 'object' ? parsed.updatedStream : null,
            done: parsed.done === true,
        });
    } catch {
        // Model strayed from JSON - salvage the text as a plain reply.
        return NextResponse.json({
            reply: raw.slice(0, 600) || 'Sorry, I had trouble with that. Could you repeat it?',
            updatedStream: null,
            done: false,
        });
    }
}
