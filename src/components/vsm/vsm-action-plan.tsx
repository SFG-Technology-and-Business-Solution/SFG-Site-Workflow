'use client';

// Analysis of the current-state map + generated step-by-step improvement plan.

import React from 'react';
import { Download, AlertTriangle, Clock, Gauge, Timer, Printer } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, StatCard } from '../ui';
import {
    ValueStream,
    VsmMetrics,
    PlanAction,
    generateActionPlan,
    fmtSeconds,
    fmtDays,
    planToCsv,
    downloadFile,
} from '@/lib/vsm';

interface VsmActionPlanProps {
    stream: ValueStream;
    metrics: VsmMetrics;
}

const PRIORITY_STYLES: Record<PlanAction['priority'], string> = {
    High: 'bg-red-100 text-red-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-neutral-100 text-neutral-600',
};

export function VsmActionPlan({ stream, metrics }: VsmActionPlanProps) {
    const actions = generateActionPlan(stream, metrics);
    const phases = [...new Set(actions.map((a) => a.phase))];
    const bottleneck = metrics.stepMetrics.find((m) => m.isBottleneck);

    const exportCsv = () =>
        downloadFile(
            `${stream.name || 'vsm'}-action-plan.csv`,
            planToCsv(actions),
            'text/csv'
        );

    return (
        <div className="space-y-6">
            {/* Headline metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<Clock size={20} />} value={fmtDays(metrics.leadTimeDays)} label="Total lead time" colorClass="blue" />
                <StatCard icon={<Timer size={20} />} value={fmtSeconds(metrics.totalProcessTimeSec)} label="Actual processing time" colorClass="green" />
                <StatCard icon={<Gauge size={20} />} value={`${metrics.pcePct.toFixed(1)}%`} label="Process cycle efficiency" colorClass="amber" />
                <StatCard icon={<AlertTriangle size={20} />} value={bottleneck?.step.name || '—'} label="Bottleneck step" colorClass="red" />
            </div>

            {/* What the map says */}
            <Card>
                <CardHeader>
                    <h3 className="font-semibold text-neutral-900">What the map is telling you</h3>
                </CardHeader>
                <CardBody>
                    <ul className="space-y-2 text-sm text-neutral-700">
                        <li>
                            • A unit of work takes <strong>{fmtDays(metrics.leadTimeDays)}</strong> end-to-end but is only
                            being worked on for <strong>{fmtSeconds(metrics.totalProcessTimeSec)}</strong> — the rest
                            ({fmtDays(metrics.totalWaitDays)}) is queue time.
                        </li>
                        {bottleneck && (
                            <li>
                                • <strong>{bottleneck.step.name}</strong> is the bottleneck: effective cycle time{' '}
                                {fmtSeconds(bottleneck.effectiveCycleSec)}
                                {bottleneck.overTakt
                                    ? ` — slower than takt (${fmtSeconds(metrics.taktSec)}), so it cannot keep up with demand.`
                                    : ` against a takt of ${fmtSeconds(metrics.taktSec)}.`}
                            </li>
                        )}
                        <li>
                            • Process cycle efficiency is <strong>{metrics.pcePct.toFixed(1)}%</strong>
                            {metrics.pcePct < 5
                                ? ' — typical for an unimproved stream. The biggest wins are in shrinking queues, not speeding up steps.'
                                : '.'}
                        </li>
                    </ul>
                </CardBody>
            </Card>

            {/* The plan */}
            <Card>
                <CardHeader
                    action={
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportCsv}>
                                Export CSV (Excel / Planner)
                            </Button>
                            <Button variant="ghost" size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>
                                Print
                            </Button>
                        </div>
                    }
                >
                    <h3 className="font-semibold text-neutral-900">Step-by-step improvement plan</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        Generated from your data. Export to CSV and paste into Microsoft Planner buckets, or open in Excel.
                    </p>
                </CardHeader>
                <CardBody className="space-y-6">
                    {phases.map((phase) => (
                        <div key={phase}>
                            <h4 className="text-sm font-bold text-neutral-900 mb-3 pb-2 border-b border-neutral-200">
                                {phase}
                            </h4>
                            <div className="space-y-3">
                                {actions
                                    .filter((a) => a.phase === phase)
                                    .map((a, i) => (
                                        <div key={`${phase}-${i}`} className="flex gap-3 p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                                            <div className="flex flex-col items-center gap-1 shrink-0 w-20">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${PRIORITY_STYLES[a.priority]}`}>
                                                    {a.priority.toUpperCase()}
                                                </span>
                                                <span className="text-[10px] text-neutral-400 text-center">{a.timeframe}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-neutral-900">{a.title}</p>
                                                <p className="text-sm text-neutral-600 mt-0.5 leading-relaxed">{a.detail}</p>
                                                <p className="text-[11px] text-primary-700 font-medium mt-1">Lean tool: {a.tool}</p>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </CardBody>
            </Card>
        </div>
    );
}
