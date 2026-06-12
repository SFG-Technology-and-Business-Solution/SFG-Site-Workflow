'use client';

// Guided interview - collects the map one question at a time, chat style.
// Works fully offline with rule-based parsing of plain-English answers
// ("about 20 minutes", "half an hour", "a dozen"); no AI key required.
// Also runs as a "gap chaser" to fill in missing numbers on existing steps.

import React, { useEffect, useRef, useState } from 'react';
import { MessagesSquare, Send, X } from 'lucide-react';
import { Card, CardHeader, CardBody, Button } from '../ui';
import { ValueStream, VsmProcessStep, emptyStep, fmtSeconds } from '@/lib/vsm';

interface VsmInterviewProps {
    stream: ValueStream;
    onChange: (stream: ValueStream) => void;
}

// ============================================
// PLAIN-ENGLISH PARSERS
// ============================================

const WORD_NUMBERS: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, dozen: 12, couple: 2, few: 3, several: 4, none: 0, no: 0, zero: 0,
};

/** "about 20 min", "half an hour", "2 hours", "90", "a day" -> seconds (bare numbers = minutes). */
export function parseDurationSec(raw: string): number | null {
    const t = raw.toLowerCase().trim();
    if (!t) return null;
    if (/half\s+(an\s+)?hour/.test(t)) return 1800;
    if (/quarter\s+(of\s+an\s+)?hour/.test(t)) return 900;
    if (/^(a|one)\s+minute/.test(t)) return 60;
    if (/^(a|one)\s+(full\s+)?day/.test(t) || /all\s+day/.test(t)) return 8 * 3600;
    const m = t.match(/(\d+(?:[.,]\d+)?)\s*(seconds?|secs?|s\b|minutes?|mins?|m\b|hours?|hrs?|h\b|days?|d\b)?/);
    if (!m) {
        for (const [word, n] of Object.entries(WORD_NUMBERS)) {
            if (new RegExp(`\\b${word}\\b`).test(t)) return n * 60;
        }
        return null;
    }
    const value = parseFloat(m[1].replace(',', '.'));
    const unit = m[2] || 'minutes';
    if (/^s/.test(unit) && !/^sev/.test(unit)) return Math.round(value);
    if (/^h/.test(unit)) return Math.round(value * 3600);
    if (/^d/.test(unit)) return Math.round(value * 8 * 3600); // a working day
    return Math.round(value * 60);
}

/** "about 15", "a dozen", "none", "30 or so" -> count. */
export function parseCount(raw: string): number | null {
    const t = raw.toLowerCase().trim();
    if (!t) return null;
    const m = t.match(/\d+(?:[.,]\d+)?/);
    if (m) return Math.round(parseFloat(m[0].replace(',', '.')));
    for (const [word, n] of Object.entries(WORD_NUMBERS)) {
        if (new RegExp(`\\b${word}\\b`).test(t)) return n;
    }
    if (/nothing|empty|rarely|never/.test(t)) return 0;
    return null;
}

// ============================================
// INTERVIEW ENGINE
// ============================================

type Q = 'name' | 'work' | 'queue' | 'gap-work' | 'gap-queue';

interface Msg {
    from: 'buddy' | 'you';
    text: string;
}

interface GapItem {
    stepId: string;
    stepName: string;
    q: Extract<Q, 'gap-work' | 'gap-queue'>;
}

function findGaps(stream: ValueStream): GapItem[] {
    const gaps: GapItem[] = [];
    stream.steps.forEach((s, i) => {
        const label = s.name || `Step ${i + 1}`;
        if (s.cycleTimeSec === 0) gaps.push({ stepId: s.id, stepName: label, q: 'gap-work' });
    });
    return gaps;
}

export function VsmInterview({ stream, onChange }: VsmInterviewProps) {
    const [open, setOpen] = useState(false);
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const [input, setInput] = useState('');
    const [q, setQ] = useState<Q>('name');
    const [pendingStep, setPendingStep] = useState<VsmProcessStep | null>(null);
    const [gapQueue, setGapQueue] = useState<GapItem[]>([]);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const gaps = findGaps(stream);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [msgs]);

    const say = (text: string) => setMsgs((m) => [...m, { from: 'buddy', text }]);

    const start = () => {
        setOpen(true);
        setMsgs([]);
        setPendingStep(null);
        setGapQueue([]);
        setQ('name');
        const intro = stream.steps.length === 0
            ? 'Let’s map your process together - one quick question at a time. What happens FIRST when work arrives? (Just describe the step, e.g. "Sarah logs the request in a spreadsheet".)'
            : `Your map has ${stream.steps.length} steps so far. What happens NEXT after "${stream.steps[stream.steps.length - 1].name}"? (Or type "done" if that’s the end.)`;
        setMsgs([{ from: 'buddy', text: intro }]);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const startGaps = () => {
        setOpen(true);
        setMsgs([]);
        setPendingStep(null);
        const queue = findGaps(stream);
        setGapQueue(queue);
        if (queue.length === 0) return;
        setQ(queue[0].q);
        setMsgs([
            { from: 'buddy', text: `I found ${queue.length} missing number${queue.length === 1 ? '' : 's'} on your map. Let’s fill ${queue.length === 1 ? 'it' : 'them'} in.` },
            { from: 'buddy', text: gapQuestion(queue[0]) },
        ]);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const gapQuestion = (g: GapItem) =>
        g.q === 'gap-work'
            ? `How long does the actual work take for "${g.stepName}"? (e.g. "10 minutes", "half an hour")`
            : `Roughly how many items are waiting in front of "${g.stepName}" right now?`;

    const finishStep = (step: VsmProcessStep) => {
        onChange({ ...stream, steps: [...stream.steps, step] });
    };

    const handle = () => {
        const answer = input.trim();
        if (!answer) return;
        setMsgs((m) => [...m, { from: 'you', text: answer }]);
        setInput('');

        // ----- gap chaser mode -----
        if (q === 'gap-work' || q === 'gap-queue') {
            const g = gapQueue[0];
            const rest = gapQueue.slice(1);
            if (g) {
                if (q === 'gap-work') {
                    const sec = parseDurationSec(answer);
                    if (sec === null) {
                        say('Sorry, I couldn’t read a time in that - try something like "15 minutes" or "2 hours".');
                        return;
                    }
                    onChange({ ...stream, steps: stream.steps.map((s) => (s.id === g.stepId ? { ...s, cycleTimeSec: sec } : s)) });
                    say(`Got it - ${fmtSeconds(sec)} of work for "${g.stepName}".`);
                }
                setGapQueue(rest);
                if (rest.length > 0) {
                    setQ(rest[0].q);
                    say(gapQuestion(rest[0]));
                } else {
                    say('That’s all the gaps filled. Check the map tab - it should look much healthier now. 🎉');
                }
            }
            return;
        }

        // ----- new-step interview mode -----
        if (q === 'name') {
            if (/^(done|finished|that'?s it|no more|end)\.?$/i.test(answer)) {
                say(`Great - ${stream.steps.length} steps mapped. Open the Map tab to see it drawn, or the Scope of Works tab for the automation proposal.`);
                setOpen(false);
                return;
            }
            const step = { ...emptyStep(), name: answer.replace(/^then\s+/i, '').slice(0, 80) };
            setPendingStep(step);
            setQ('work');
            say(`"${step.name}" - how long does the actual hands-on work take per item? (e.g. "5 minutes", "an hour". Rough is fine.)`);
            return;
        }

        if (q === 'work' && pendingStep) {
            const sec = parseDurationSec(answer);
            if (sec === null) {
                say('I couldn’t read a time in that - try "10 minutes", "half an hour" or just a number of minutes.');
                return;
            }
            setPendingStep({ ...pendingStep, cycleTimeSec: sec });
            setQ('queue');
            say('And does work pile up WAITING before this step? Roughly how many items are usually in the queue? (A number, or "none".)');
            return;
        }

        if (q === 'queue' && pendingStep) {
            const count = parseCount(answer);
            if (count === null) {
                say('Just a rough number is fine - or "none" if work flows straight in.');
                return;
            }
            const done = { ...pendingStep, inventoryBefore: count };
            finishStep(done);
            setPendingStep(null);
            setQ('name');
            say(`Added "${done.name}" (${fmtSeconds(done.cycleTimeSec)} work, ${count} waiting). What happens NEXT? (Or "done" if that’s the end.)`);
            return;
        }
    };

    if (!open) {
        return (
            <div className="flex flex-col sm:flex-row gap-2">
                <button
                    className="flex-1 text-left px-4 py-3 bg-info-light hover:bg-info-light/70 border border-info/30 rounded-xl text-sm text-neutral-700 flex items-center gap-2 transition-colors"
                    onClick={start}
                >
                    <MessagesSquare size={16} className="text-info shrink-0" />
                    Prefer question-by-question? Start the guided interview - it asks, you answer, the map builds itself.
                </button>
                {gaps.length > 0 && (
                    <button
                        className="text-left px-4 py-3 bg-warning-light hover:bg-warning-light/70 border border-warning/30 rounded-xl text-sm text-neutral-700 flex items-center gap-2 transition-colors"
                        onClick={startGaps}
                    >
                        <MessagesSquare size={16} className="text-warning shrink-0" />
                        Fill {gaps.length} missing number{gaps.length === 1 ? '' : 's'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <Card>
            <CardHeader action={
                <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => setOpen(false)}>Close</Button>
            }>
                <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                    <MessagesSquare size={16} className="text-info" /> Guided interview
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">Answer in plain English - rough numbers are fine, you can tidy them in the form later.</p>
            </CardHeader>
            <CardBody className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {msgs.map((m, i) => (
                        <div key={i} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-snug ${
                                m.from === 'you'
                                    ? 'bg-primary-600 text-white rounded-br-sm'
                                    : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
                            }`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>
                <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handle();
                    }}
                >
                    <input
                        ref={inputRef}
                        className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                        placeholder="Type your answer…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                    <Button type="submit" icon={<Send size={15} />}>Send</Button>
                </form>
            </CardBody>
        </Card>
    );
}
