'use client';

// Map library: every value stream the consultant has mapped, grouped by
// organisation - the "full mapping of the organisation" view.

import React, { useRef } from 'react';
import {
    Plus,
    Upload,
    Sparkles,
    Copy,
    GitFork,
    Download,
    Trash2,
    ArrowRight,
    GitBranch,
    Building2,
} from 'lucide-react';
import { Card, Button } from '../ui';
import {
    ValueStream,
    calcMetrics,
    fmtDays,
    streamToJson,
    downloadFile,
} from '@/lib/vsm';

interface VsmLibraryProps {
    streams: ValueStream[];
    onOpen: (id: string) => void;
    onNew: () => void;
    onLoadSample: () => void;
    onDuplicate: (id: string, asFutureState: boolean) => void;
    onDelete: (id: string) => void;
    onImport: (file: File) => void;
}

export function VsmLibrary({ streams, onOpen, onNew, onLoadSample, onDuplicate, onDelete, onImport }: VsmLibraryProps) {
    const fileRef = useRef<HTMLInputElement>(null);

    const byClient = streams.reduce<Record<string, ValueStream[]>>((acc, s) => {
        const key = s.client || 'Unassigned';
        (acc[key] = acc[key] || []).push(s);
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
                <Button icon={<Plus size={16} />} onClick={onNew}>New map</Button>
                <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
                    Import map (.json)
                </Button>
                <Button variant="secondary" icon={<Sparkles size={16} />} onClick={onLoadSample}>
                    Load worked example
                </Button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onImport(f);
                        e.target.value = '';
                    }}
                />
            </div>

            {streams.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-dashed border-neutral-300">
                    <GitBranch size={40} className="text-neutral-300 mb-4" />
                    <h3 className="font-semibold text-neutral-900 mb-1">No maps yet</h3>
                    <p className="text-sm text-neutral-500 max-w-md mb-6">
                        Map an organisation one value stream at a time. Start with the process that hurts the
                        most, or load the worked example to see a finished map first.
                    </p>
                    <div className="flex gap-2">
                        <Button icon={<Plus size={16} />} onClick={onNew}>Create your first map</Button>
                        <Button variant="secondary" icon={<Sparkles size={16} />} onClick={onLoadSample}>
                            Load worked example
                        </Button>
                    </div>
                </div>
            )}

            {Object.entries(byClient).map(([client, clientStreams]) => (
                <div key={client}>
                    <div className="flex items-center gap-2 mb-3">
                        <Building2 size={16} className="text-neutral-400" />
                        <h2 className="text-sm font-bold text-neutral-700 uppercase tracking-wide">{client}</h2>
                        <span className="text-xs text-neutral-400">
                            {clientStreams.length} map{clientStreams.length === 1 ? '' : 's'}
                        </span>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {clientStreams
                            .sort((a, b) => b.updatedAt - a.updatedAt)
                            .map((s) => {
                                const m = calcMetrics(s);
                                const bottleneck = m.stepMetrics.find((sm) => sm.isBottleneck);
                                return (
                                    <Card key={s.id} className="flex flex-col hover:shadow-md transition-shadow">
                                        <button className="p-5 text-left flex-1" onClick={() => onOpen(s.id)}>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h3 className="font-semibold text-neutral-900 leading-snug">
                                                    {s.name || 'Untitled map'}
                                                </h3>
                                                <span
                                                    className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase
                                                        ${s.mapType === 'future' ? 'bg-violet-100 text-violet-700' : 'bg-primary-100 text-primary-700'}`}
                                                >
                                                    {s.mapType === 'future' ? 'Future' : 'Current'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-neutral-500 mb-4">
                                                {[s.area, s.productFamily].filter(Boolean).join(' · ') || 'No area set'}
                                            </p>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="bg-neutral-50 rounded-lg py-2">
                                                    <div className="text-sm font-bold text-neutral-900">{s.steps.length}</div>
                                                    <div className="text-[10px] text-neutral-400 uppercase">Steps</div>
                                                </div>
                                                <div className="bg-neutral-50 rounded-lg py-2">
                                                    <div className="text-sm font-bold text-neutral-900">{s.steps.length ? fmtDays(m.leadTimeDays) : '—'}</div>
                                                    <div className="text-[10px] text-neutral-400 uppercase">Lead time</div>
                                                </div>
                                                <div className="bg-neutral-50 rounded-lg py-2">
                                                    <div className="text-sm font-bold text-neutral-900">{s.steps.length ? `${m.pcePct.toFixed(1)}%` : '—'}</div>
                                                    <div className="text-[10px] text-neutral-400 uppercase">PCE</div>
                                                </div>
                                            </div>
                                            {bottleneck && (
                                                <p className="text-[11px] text-red-600 mt-3">
                                                    Bottleneck: <span className="font-semibold">{bottleneck.step.name}</span>
                                                </p>
                                            )}
                                        </button>
                                        <div className="px-3 py-2 border-t border-neutral-100 flex items-center gap-1">
                                            <button
                                                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 rounded-md"
                                                onClick={() => onOpen(s.id)}
                                            >
                                                Open <ArrowRight size={12} />
                                            </button>
                                            <span className="flex-1" />
                                            <button
                                                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md"
                                                title="Duplicate"
                                                onClick={() => onDuplicate(s.id, false)}
                                            >
                                                <Copy size={14} />
                                            </button>
                                            <button
                                                className="p-1.5 text-neutral-400 hover:text-violet-700 hover:bg-violet-50 rounded-md"
                                                title="Duplicate as future state"
                                                onClick={() => onDuplicate(s.id, true)}
                                            >
                                                <GitFork size={14} />
                                            </button>
                                            <button
                                                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md"
                                                title="Export map file (.json)"
                                                onClick={() =>
                                                    downloadFile(`${s.name || 'vsm-map'}.json`, streamToJson(s), 'application/json')
                                                }
                                            >
                                                <Download size={14} />
                                            </button>
                                            <button
                                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                title="Delete map"
                                                onClick={() => onDelete(s.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </Card>
                                );
                            })}
                    </div>
                </div>
            ))}
        </div>
    );
}
