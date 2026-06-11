'use client';

// AI capture agent: guided interview that fills the value stream map.
// Chat by typing, or tap the mic once to talk and tap again to stop -
// the recognised speech is then sent as your answer. Replies can be
// spoken aloud with the browser's built-in voice.

import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Sparkles, Volume2, VolumeX, X, Check } from 'lucide-react';
import { ValueStream, VsmProcessStep, emptyStep } from '@/lib/vsm';

interface Msg {
    role: 'user' | 'agent';
    text: string;
    hidden?: boolean;
    applied?: boolean;
    isError?: boolean;
}

interface Props {
    stream: ValueStream;
    onChange: (next: ValueStream) => void;
}

const num = (v: unknown, fallback: number): number => {
    const n = typeof v === 'string' ? parseFloat(v) : (v as number);
    return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

/** Merge the agent's returned stream into the real one, defensively. */
function applyAgentStream(current: ValueStream, incoming: Record<string, unknown>): ValueStream {
    const steps: VsmProcessStep[] = Array.isArray(incoming.steps)
        ? (incoming.steps as Record<string, unknown>[]).map((raw, i) => {
              const base = emptyStep();
              return {
                  ...base,
                  id: typeof raw.id === 'string' && raw.id ? raw.id : `step-agent-${Date.now()}-${i}`,
                  name: str(raw.name, base.name),
                  operators: num(raw.operators, base.operators),
                  cycleTimeSec: num(raw.cycleTimeSec, base.cycleTimeSec),
                  changeoverSec: num(raw.changeoverSec, base.changeoverSec),
                  uptimePct: num(raw.uptimePct, base.uptimePct),
                  yieldPct: num(raw.yieldPct, base.yieldPct),
                  batchSize: num(raw.batchSize, base.batchSize),
                  inventoryBefore: num(raw.inventoryBefore, base.inventoryBefore),
                  notes: typeof raw.notes === 'string' && raw.notes ? raw.notes : undefined,
              };
          })
        : current.steps;

    return {
        ...current,
        client: str(incoming.client, current.client),
        area: str(incoming.area, current.area),
        mapType: incoming.mapType === 'future' ? 'future' : current.mapType,
        name: str(incoming.name, current.name),
        productFamily: str(incoming.productFamily, current.productFamily),
        customerName: str(incoming.customerName, current.customerName),
        supplierName: str(incoming.supplierName, current.supplierName),
        demandPerMonth: num(incoming.demandPerMonth, current.demandPerMonth),
        daysPerMonth: num(incoming.daysPerMonth, current.daysPerMonth),
        shiftsPerDay: num(incoming.shiftsPerDay, current.shiftsPerDay),
        shiftHours: num(incoming.shiftHours, current.shiftHours),
        breaksMinPerShift: num(incoming.breaksMinPerShift, current.breaksMinPerShift),
        customerOrderMethod: str(incoming.customerOrderMethod, current.customerOrderMethod),
        supplierOrderMethod: str(incoming.supplierOrderMethod, current.supplierOrderMethod),
        scheduleMethod: str(incoming.scheduleMethod, current.scheduleMethod),
        deliveryFrequency: str(incoming.deliveryFrequency, current.deliveryFrequency),
        shipmentFrequency: str(incoming.shipmentFrequency, current.shipmentFrequency),
        steps,
        updatedAt: Date.now(),
    };
}

export function VsmCaptureAgent({ stream, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [listening, setListening] = useState(false);
    const [voiceOn, setVoiceOn] = useState(true);
    const [micSupported, setMicSupported] = useState(true);

    const streamRef = useRef(stream);
    streamRef.current = stream;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const messagesRef = useRef<Msg[]>([]);
    const voiceOnRef = useRef(voiceOn);
    voiceOnRef.current = voiceOn;
    const busyRef = useRef(false);
    const recRef = useRef<{ stop: () => void } | null>(null);
    const finalTranscriptRef = useRef('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const w = window as unknown as Record<string, unknown>;
        setMicSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    }, []);

    // Auto-scroll chat to the latest message
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, busy, open]);

    // Stop talking/listening when the panel closes or unmounts
    useEffect(() => {
        if (!open) {
            recRef.current?.stop();
            window.speechSynthesis?.cancel();
        }
        return () => {
            recRef.current?.stop();
            window.speechSynthesis?.cancel();
        };
    }, [open]);

    const speak = (text: string) => {
        try {
            const synth = window.speechSynthesis;
            if (!synth) return;
            synth.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = navigator.language || 'en-AU';
            u.rate = 1.02;
            synth.speak(u);
        } catch {
            // voice output is best-effort
        }
    };

    const push = (msg: Msg) => {
        messagesRef.current = [...messagesRef.current, msg];
        setMessages(messagesRef.current);
    };

    const send = async (text: string, opts?: { hidden?: boolean }) => {
        const trimmed = text.trim();
        if (!trimmed || busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        window.speechSynthesis?.cancel();
        push({ role: 'user', text: trimmed, hidden: opts?.hidden });
        try {
            const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    messages: messagesRef.current.map(({ role, text }) => ({ role, text })),
                    stream: streamRef.current,
                }),
            });
            const data = await res.json();
            let applied = false;
            if (data.updatedStream && typeof data.updatedStream === 'object') {
                onChangeRef.current(applyAgentStream(streamRef.current, data.updatedStream));
                applied = true;
            }
            const reply: string =
                typeof data.reply === 'string' && data.reply
                    ? data.reply
                    : 'Sorry, I had trouble with that one. Could you say it again?';
            push({ role: 'agent', text: reply, applied, isError: Boolean(data.needsSetup || data.error) });
            if (voiceOnRef.current && !data.needsSetup) speak(reply);
        } catch {
            push({
                role: 'agent',
                text: 'I lost the connection there. Check the network and try again.',
                isError: true,
            });
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    };

    // Kick off the interview the first time the panel opens
    useEffect(() => {
        if (open && messagesRef.current.length === 0) {
            void send('Hi, please guide me through capturing this value stream from the beginning.', {
                hidden: true,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Tap once to talk, tap again to stop; the recognised speech is sent.
    const toggleMic = () => {
        if (listening) {
            recRef.current?.stop();
            return;
        }
        const w = window as unknown as Record<string, unknown>;
        const SR = (w.SpeechRecognition || w.webkitSpeechRecognition) as
            | (new () => {
                  lang: string;
                  continuous: boolean;
                  interimResults: boolean;
                  onresult: ((e: unknown) => void) | null;
                  onend: (() => void) | null;
                  onerror: (() => void) | null;
                  start: () => void;
                  stop: () => void;
              })
            | undefined;
        if (!SR) return;
        window.speechSynthesis?.cancel(); // don't transcribe the agent's own voice
        const rec = new SR();
        rec.lang = navigator.language || 'en-AU';
        rec.continuous = true;
        rec.interimResults = true;
        finalTranscriptRef.current = '';
        rec.onresult = (e: unknown) => {
            const ev = e as { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
            let final = '';
            let interim = '';
            for (let i = 0; i < ev.results.length; i++) {
                const r = ev.results[i];
                if (r.isFinal) final += r[0].transcript;
                else interim += r[0].transcript;
            }
            finalTranscriptRef.current = final;
            setInput(`${final} ${interim}`.trim());
        };
        rec.onend = () => {
            setListening(false);
            recRef.current = null;
            const text = finalTranscriptRef.current.trim();
            setInput('');
            if (text) void send(text);
        };
        rec.onerror = () => {
            setListening(false);
            recRef.current = null;
        };
        recRef.current = rec;
        setListening(true);
        rec.start();
    };

    const submitTyped = () => {
        const text = input;
        setInput('');
        void send(text);
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-700 hover:shadow-xl"
            >
                <Sparkles size={18} />
                Capture with AI
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex h-[640px] max-h-[calc(100vh-5rem)] w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 bg-primary-600 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                    <Sparkles size={18} />
                    <div>
                        <div className="text-sm font-semibold leading-tight">Capture Agent</div>
                        <div className="text-[11px] leading-tight text-primary-100">
                            Talk or type - I will fill the map in for you
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setVoiceOn((v) => !v)}
                        title={voiceOn ? 'Turn spoken replies off' : 'Turn spoken replies on'}
                        className="rounded-lg p-2 hover:bg-primary-700"
                    >
                        {voiceOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
                    </button>
                    <button onClick={() => setOpen(false)} title="Close" className="rounded-lg p-2 hover:bg-primary-700">
                        <X size={17} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-4">
                {messages
                    .filter((m) => !m.hidden)
                    .map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                    m.role === 'user'
                                        ? 'rounded-br-sm bg-primary-600 text-white'
                                        : m.isError
                                          ? 'rounded-bl-sm border border-warning bg-warning-light text-neutral-800'
                                          : 'rounded-bl-sm border border-neutral-200 bg-white text-neutral-800'
                                }`}
                            >
                                {m.text}
                                {m.applied && (
                                    <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-success">
                                        <Check size={12} /> Map updated
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                {busy && (
                    <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-4 py-3">
                            <span className="inline-flex gap-1">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:150ms]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:300ms]" />
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Composer */}
            <div className="border-t border-neutral-200 bg-white p-3">
                <div className="flex items-center gap-2">
                    {micSupported && (
                        <button
                            onClick={toggleMic}
                            title={listening ? 'Tap to stop and send' : 'Tap to talk'}
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                listening
                                    ? 'animate-pulse border-accent-red bg-accent-red-light text-accent-red'
                                    : 'border-neutral-300 bg-white text-neutral-600 hover:border-primary-400 hover:text-primary-600'
                            }`}
                        >
                            <Mic size={19} />
                        </button>
                    )}
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !busy && !listening) submitTyped();
                        }}
                        placeholder={listening ? 'Listening... tap the mic to stop' : 'Type your answer...'}
                        disabled={listening}
                        className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3.5 text-sm outline-none transition-colors focus:border-primary-500 disabled:bg-neutral-50"
                    />
                    <button
                        onClick={submitTyped}
                        disabled={busy || listening || !input.trim()}
                        title="Send"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
                    >
                        <Send size={17} />
                    </button>
                </div>
                <p className="mt-2 text-center text-[10px] text-neutral-400">
                    {micSupported
                        ? 'Tap the mic once to talk, tap again to stop. Voice uses your browser’s speech engine.'
                        : 'Voice input is not supported in this browser - Chrome, Edge or Safari recommended.'}
                </p>
            </div>
        </div>
    );
}
