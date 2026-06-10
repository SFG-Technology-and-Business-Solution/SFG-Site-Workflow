'use client';

// VSM Buddy: map library + per-map workspace (Learn -> Collect Data -> Map -> Action Plan)

import { useEffect, useMemo, useState } from 'react';
import {
    BookOpen,
    ClipboardList,
    GitBranch,
    ListChecks,
    ChevronLeft,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { VsmGuide } from '@/components/vsm/vsm-guide';
import { VsmDataForm } from '@/components/vsm/vsm-data-form';
import { VsmCanvas } from '@/components/vsm/vsm-canvas';
import { VsmActionPlan } from '@/components/vsm/vsm-action-plan';
import { VsmLibrary } from '@/components/vsm/vsm-library';
import { VsmBuddyLogo } from '@/components/vsm/vsm-buddy-logo';
import {
    ValueStream,
    calcMetrics,
    emptyStream,
    duplicateStream,
    streamFromJson,
    loadLibrary,
    saveLibrary,
    SAMPLE_STREAM,
    newId,
} from '@/lib/vsm';

type Tab = 'learn' | 'data' | 'map' | 'plan';

const TABS: { id: Tab; label: string; icon: typeof BookOpen; hint: string }[] = [
    { id: 'learn', label: '1 · Learn', icon: BookOpen, hint: 'What to collect & how' },
    { id: 'data', label: '2 · Collect Data', icon: ClipboardList, hint: 'Enter what you measured' },
    { id: 'map', label: '3 · Map', icon: GitBranch, hint: 'The drawn value stream' },
    { id: 'plan', label: '4 · Action Plan', icon: ListChecks, hint: 'Step-by-step improvements' },
];

export default function ValueStreamPage() {
    const [streams, setStreams] = useState<ValueStream[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('learn');
    const [loaded, setLoaded] = useState(false);
    const [saved, setSaved] = useState(false);

    // Load library once on mount, deferred so hydration completes first
    useEffect(() => {
        const t = setTimeout(() => {
            setStreams(loadLibrary());
            setLoaded(true);
        }, 0);
        return () => clearTimeout(t);
    }, []);

    // Brand the browser tab while on this page
    useEffect(() => {
        const prev = document.title;
        document.title = 'VSM Buddy - Value Stream Mapping';
        return () => {
            document.title = prev;
        };
    }, []);

    // Autosave the whole library (debounced)
    useEffect(() => {
        if (!loaded) return;
        const t = setTimeout(() => {
            saveLibrary(streams);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        }, 600);
        return () => clearTimeout(t);
    }, [streams, loaded]);

    const active = streams.find((s) => s.id === activeId) ?? null;
    const metrics = useMemo(() => (active ? calcMetrics(active) : null), [active]);
    const hasSteps = (active?.steps.length ?? 0) > 0;

    const updateActive = (next: ValueStream) =>
        setStreams((prev) => prev.map((s) => (s.id === next.id ? { ...next, updatedAt: Date.now() } : s)));

    const openMap = (id: string) => {
        setActiveId(id);
        const s = streams.find((x) => x.id === id);
        setTab(s && s.steps.length > 0 ? 'map' : 'data');
    };

    const newMap = () => {
        const s = emptyStream();
        setStreams((prev) => [...prev, s]);
        setActiveId(s.id);
        setTab(streams.length === 0 ? 'learn' : 'data');
    };

    const loadSample = () => {
        const s = { ...structuredClone(SAMPLE_STREAM), id: newId(), updatedAt: Date.now() };
        setStreams((prev) => [...prev, s]);
        setActiveId(s.id);
        setTab('data');
    };

    const duplicate = (id: string, asFutureState: boolean) => {
        const src = streams.find((s) => s.id === id);
        if (!src) return;
        const copy = duplicateStream(src, asFutureState);
        setStreams((prev) => [...prev, copy]);
        setActiveId(copy.id);
        setTab('data');
    };

    const deleteMap = (id: string) => {
        const s = streams.find((x) => x.id === id);
        if (!confirm(`Delete "${s?.name || 'this map'}"? This cannot be undone.`)) return;
        setStreams((prev) => prev.filter((x) => x.id !== id));
        if (activeId === id) setActiveId(null);
    };

    const importMap = async (file: File) => {
        try {
            const stream = streamFromJson(await file.text());
            setStreams((prev) => [...prev, stream]);
            setActiveId(stream.id);
            setTab('map');
        } catch {
            alert('That file is not a VSM Buddy map export (.json).');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <VsmBuddyLogo size={52} />
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900">
                            VSM Buddy
                            <span className="ml-2 text-sm font-medium text-neutral-400 align-middle">by AI² Solutions</span>
                        </h1>
                        <p className="text-sm text-neutral-500 mt-1">
                            {active
                                ? `${active.name || 'Untitled map'}${active.client ? ` · ${active.client}` : ''}`
                                : 'Map an organisation one value stream at a time - learn, measure, map, improve.'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {saved && (
                        <span className="flex items-center gap-1 text-xs text-success font-medium">
                            <Check size={14} /> Saved
                        </span>
                    )}
                    {active && (
                        <Button variant="secondary" size="sm" icon={<ChevronLeft size={14} />} onClick={() => setActiveId(null)}>
                            All maps
                        </Button>
                    )}
                </div>
            </div>

            {/* Library view */}
            {!active && loaded && (
                <VsmLibrary
                    streams={streams}
                    onOpen={openMap}
                    onNew={newMap}
                    onLoadSample={loadSample}
                    onDuplicate={duplicate}
                    onDelete={deleteMap}
                    onImport={importMap}
                />
            )}

            {/* Workspace view */}
            {active && metrics && (
                <>
                    <div className="bg-white rounded-xl border border-neutral-200 p-1.5 flex flex-col sm:flex-row gap-1">
                        {TABS.map((t) => {
                            const isActive = tab === t.id;
                            const needsData = (t.id === 'map' || t.id === 'plan') && !hasSteps;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setTab(t.id)}
                                    className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors
                                        ${isActive ? 'bg-primary-600 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'}`}
                                >
                                    <t.icon size={18} className={isActive ? 'text-white' : 'text-neutral-400'} />
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold leading-tight">{t.label}</span>
                                        <span className={`block text-[11px] leading-tight truncate ${isActive ? 'text-primary-100' : 'text-neutral-400'}`}>
                                            {needsData ? 'Add data first' : t.hint}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

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
                            <VsmDataForm stream={active} metrics={metrics} onChange={updateActive} />
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
                                    stream={active}
                                    metrics={metrics}
                                    onPositionsChange={(positions) => updateActive({ ...active, positions })}
                                />
                                <div className="flex justify-end">
                                    <Button onClick={() => setTab('plan')}>Build the action plan →</Button>
                                </div>
                            </div>
                        ) : (
                            <EmptyPrompt onData={() => setTab('data')} />
                        ))}

                    {tab === 'plan' &&
                        (hasSteps ? (
                            <VsmActionPlan stream={active} metrics={metrics} />
                        ) : (
                            <EmptyPrompt onData={() => setTab('data')} />
                        ))}
                </>
            )}
        </div>
    );
}

function EmptyPrompt({ onData }: { onData: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-dashed border-neutral-300">
            <GitBranch size={36} className="text-neutral-300 mb-3" />
            <h3 className="font-semibold text-neutral-900 mb-1">No process steps yet</h3>
            <p className="text-sm text-neutral-500 mb-5 max-w-sm">
                Add the steps of your process in the Collect Data tab and the map will draw itself.
            </p>
            <Button onClick={onData}>Collect data</Button>
        </div>
    );
}
