'use client';

// "Describe your process" - the user writes a paragraph, the AI drafts the
// steps for them to correct. Kills the blank-page problem.

import React, { useEffect, useState } from 'react';
import { Sparkles, PenLine } from 'lucide-react';
import { Card, CardHeader, CardBody, Button } from '../ui';
import { ValueStream } from '@/lib/vsm';
import { aiAvailable, draftFromDescription } from '@/lib/vsm-ai';

interface VsmDescribeProps {
    stream: ValueStream;
    onChange: (stream: ValueStream) => void;
}

const PLACEHOLDER =
    'e.g. Work requests come in by email and Sarah logs them in a spreadsheet, which takes a few minutes each. ' +
    'They wait a day or two until Mark assesses them and writes a quote, about half an hour each. ' +
    'Approved jobs get scheduled weekly, then the crew does the work - usually a couple of hours on site. ' +
    'Paperwork is finished back at the office and invoices go out in a monthly batch.';

export function VsmDescribe({ stream, onChange }: VsmDescribeProps) {
    const [hasAi, setHasAi] = useState<boolean | null>(null);
    const [open, setOpen] = useState(stream.steps.length === 0);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        aiAvailable().then(setHasAi);
    }, []);

    const draft = async () => {
        if (text.trim().length < 30) {
            setError('Add a little more detail - a few sentences about what happens, in order, is enough.');
            return;
        }
        if (stream.steps.length > 0 && !confirm('This will replace the steps currently on the map. Continue?')) return;
        setBusy(true);
        setError(null);
        try {
            const result = await draftFromDescription(text);
            onChange({
                ...stream,
                name: stream.name || result.name,
                steps: result.steps,
            });
            setOpen(false);
        } catch {
            setError('The AI could not draft the steps this time - try rewording the description, or add the steps manually below.');
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <button
                className="w-full text-left px-4 py-3 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl text-sm text-primary-800 flex items-center gap-2 transition-colors"
                onClick={() => setOpen(true)}
            >
                <Sparkles size={16} className="text-primary-600 shrink-0" />
                Prefer to start by describing the process in your own words? Click here and the AI will draft the steps for you.
            </button>
        );
    }

    return (
        <Card>
            <CardHeader>
                <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                    <PenLine size={16} className="text-primary-600" /> Describe your process - the AI drafts the map
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                    Write a few sentences about what happens, in order. Rough times help but are not required. Correcting a draft is much easier than starting from nothing.
                </p>
            </CardHeader>
            <CardBody className="space-y-3">
                <textarea
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white min-h-[110px]"
                    placeholder={PLACEHOLDER}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
                {error && <p className="text-sm text-accent-red">{error}</p>}
                {hasAi === false && (
                    <p className="text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
                        AI drafting is not switched on yet - your administrator needs to add a <code className="text-xs">GEMINI_API_KEY</code> to the site settings.
                        You can still add the steps manually below.
                    </p>
                )}
                <div className="flex gap-2">
                    <Button icon={<Sparkles size={16} />} onClick={draft} disabled={busy || hasAi === false}>
                        {busy ? 'Drafting…' : 'Draft my map'}
                    </Button>
                    <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
                </div>
            </CardBody>
        </Card>
    );
}
