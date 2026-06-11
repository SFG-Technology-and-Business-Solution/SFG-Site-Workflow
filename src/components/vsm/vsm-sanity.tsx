'use client';

// Data sanity checker - rule-based checks always run; an optional AI review
// digs deeper when a key is configured. Maps are only useful if believable.

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '../ui';
import { ValueStream, VsmMetrics } from '@/lib/vsm';
import { aiAvailable, aiSanity, ruleBasedSanity } from '@/lib/vsm-ai';

interface VsmSanityProps {
    stream: ValueStream;
    metrics: VsmMetrics;
}

export function VsmSanity({ stream, metrics }: VsmSanityProps) {
    const [hasAi, setHasAi] = useState(false);
    const [aiText, setAiText] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        aiAvailable().then(setHasAi);
    }, []);

    if (stream.steps.length === 0) return null;

    const issues = ruleBasedSanity(stream, metrics);

    const runAi = async () => {
        setBusy(true);
        try {
            setAiText(await aiSanity(stream, metrics));
        } catch {
            setAiText('The AI review is unavailable right now - the checks above still apply.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                    <ShieldCheck size={16} className={issues.some((i) => i.severity === 'warn') ? 'text-warning' : 'text-success'} />
                    Does the data look believable?
                </h4>
                {hasAi && (
                    <Button variant="secondary" size="sm" icon={<Sparkles size={14} />} onClick={runAi} disabled={busy}>
                        {busy ? 'Checking…' : 'AI deep check'}
                    </Button>
                )}
            </div>

            {issues.length === 0 ? (
                <p className="text-sm text-neutral-600">No obvious problems found - the numbers hang together.</p>
            ) : (
                <ul className="space-y-1.5">
                    {issues.map((issue, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                            {issue.severity === 'warn'
                                ? <AlertTriangle size={15} className="text-warning mt-0.5 shrink-0" />
                                : <Info size={15} className="text-info mt-0.5 shrink-0" />}
                            <span>{issue.message}</span>
                        </li>
                    ))}
                </ul>
            )}

            {aiText && (
                <div className="text-sm text-neutral-700 whitespace-pre-wrap border-t border-neutral-200 pt-3">
                    <span className="font-semibold text-primary-700 flex items-center gap-1 mb-1"><Sparkles size={13} /> AI review</span>
                    {aiText}
                </div>
            )}
        </div>
    );
}
