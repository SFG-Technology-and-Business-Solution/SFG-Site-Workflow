'use client';

// Value Stream Mapping workspace: Learn -> Collect Data -> Map -> Action Plan

import { useEffect, useMemo, useState } from 'react';
import {
    BookOpen,
    ClipboardList,
    GitBranch,
    ListChecks,
    Sparkles,
    Trash2,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { VsmGuide } from '@/components/vsm/vsm-guide';
import { VsmDataForm } from '@/components/vsm/vsm-data-form';
import { VsmCanvas } from '@/components/vsm/vsm-canvas';
import { VsmActionPlan } from '@/components/vsm/vsm-action-plan';
import { ValueStream, calcMetrics, emptyStream, SAMPLE_STREAM } from '@/lib/vsm';

type Tab = 'learn' | 'data' | 'map' | 'plan';

const STORAGE_KEY = 'sfg-vsm-stream-v1';

const TABS: { id: Tab; label: string; icon: typeof BookOpen; hint: string }[] = [
    { id: 'learn', label: '1 · Learn', icon: BookOpen, hint: 'What to collect & how' },
    { id: 'data', label: '2 · Collect Data', icon: ClipboardList, hint: 'Enter what you measured' },
    { id: 'map', label: '3 · Map', icon: GitBranch, hint: 'The drawn value stream' },
    { id: 'plan', label: '4 · Action Plan', icon: ListChecks, hint: 'Step-by-step improvements' },
];

export default function ValueStreamPage() {
    const [tab, setTab] = useState<Tab>('learn');
    const [stream, setStream] = useState<ValueStream>(emptyStream());
    const [loaded, setLoaded] = useState(false);
    const [saved, setSaved] = useState(false);

    // Load once on mount, deferred so hydration completes before swapping in the saved stream
    useEffect(() => {
        const t = setTimeout(() => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    setStream({ ...emptyStream(), ...JSON.parse(raw) });
                    setTab('data');
                }
            } catch {
                // corrupted save - start fresh
            }
            setLoaded(true);
        }, 0);
        return () => clearTimeout(t);
    }, []);

    // Autosave (debounced)
    useEffect(() => {
        if (!loaded) return;
        const t = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stream));
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        }, 600);
        return () => clearTimeout(t);
    }, [stream, loaded]);

    const metrics = useMemo(() => calcMetrics(stream), [stream]);
    const hasSteps = stream.steps.length > 0;

    const loadSample = () => {
        setStream(structuredClone(SAMPLE_STREAM));
        setTab('data');
    };

    const clearAll = () => {
        if (!confirm('Clear the current value stream? This cannot be undone.')) return;
        setStream(emptyStream());
        localStorage.removeItem(STORAGE_KEY);
        setTab('data');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Value Stream Mapping</h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Learn the method, collect the data, draw the map, and get a step-by-step improvement plan.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {saved && (
                        <span className="flex items-center gap-1 text-xs text-success font-medium">
                            <Check size={14} /> Saved
                        </span>
                    )}
                    <Button variant="secondary" size="sm" icon={<Sparkles size={14} />} onClick={loadSample}>
                        Load sample
                    </Button>
                    {hasSteps && (
                        <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={clearAll}>
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            {/* Tab bar */}
            <div className="bg-white rounded-xl border border-neutral-200 p-1.5 flex flex-col sm:flex-row gap-1">
                {TABS.map((t) => {
                    const active = tab === t.id;
                    const needsData = (t.id === 'map' || t.id === 'plan') && !hasSteps;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors
                                ${active ? 'bg-primary-600 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'}`}
                        >
                            <t.icon size={18} className={active ? 'text-white' : 'text-neutral-400'} />
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold leading-tight">{t.label}</span>
                                <span className={`block text-[11px] leading-tight truncate ${active ? 'text-primary-100' : 'text-neutral-400'}`}>
                                    {needsData ? 'Add data first' : t.hint}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            {tab === 'learn' && (
                <div className="space-y-4">
                    <VsmGuide />
                    <div className="flex justify-end">
                        <Button onClick={() => setTab('data')}>Start collecting data →</Button>
                    </div>
                </div>
            )}

            {tab === 'data' && (
                <div className="space-y-4">
                    <VsmDataForm stream={stream} metrics={metrics} onChange={setStream} />
                    {hasSteps && (
                        <div className="flex justify-end">
                            <Button onClick={() => setTab('map')}>Draw the map →</Button>
                        </div>
                    )}
                </div>
            )}

            {tab === 'map' &&
                (hasSteps ? (
                    <div className="space-y-4">
                        <VsmCanvas
                            stream={stream}
                            metrics={metrics}
                            onPositionsChange={(positions) => setStream({ ...stream, positions })}
                        />
                        <div className="flex justify-end">
                            <Button onClick={() => setTab('plan')}>Build the action plan →</Button>
                        </div>
                    </div>
                ) : (
                    <EmptyPrompt onLoad={loadSample} onData={() => setTab('data')} />
                ))}

            {tab === 'plan' &&
                (hasSteps ? (
                    <VsmActionPlan stream={stream} metrics={metrics} />
                ) : (
                    <EmptyPrompt onLoad={loadSample} onData={() => setTab('data')} />
                ))}
        </div>
    );
}

function EmptyPrompt({ onLoad, onData }: { onLoad: () => void; onData: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-dashed border-neutral-300">
            <GitBranch size={36} className="text-neutral-300 mb-3" />
            <h3 className="font-semibold text-neutral-900 mb-1">No process steps yet</h3>
            <p className="text-sm text-neutral-500 mb-5 max-w-sm">
                Add the steps of your process in the Collect Data tab, or load the worked example to see how it all fits together.
            </p>
            <div className="flex gap-2">
                <Button onClick={onData}>Collect data</Button>
                <Button variant="secondary" icon={<Sparkles size={14} />} onClick={onLoad}>
                    Load sample
                </Button>
            </div>
        </div>
    );
}
