'use client';

// Automation Blueprint - the future-state picture: the same process redrawn
// with the Microsoft tool that will run each step, colour-coded by how
// automated it becomes, plus a before/after lead-time comparison.

import React from 'react';
import { Bot, UserCheck, HardHat } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui';
import { ValueStream, VsmMetrics, fmtDays } from '@/lib/vsm';
import { AutomationMode, projectedLeadTimeDays, stepAutomation } from '@/lib/vsm-sow';

interface VsmBlueprintProps {
    stream: ValueStream;
    metrics: VsmMetrics;
}

const MODE_STYLE: Record<AutomationMode, { card: string; head: string; badge: string; label: string; icon: typeof Bot }> = {
    automated: {
        card: 'border-primary-300 bg-primary-50/60',
        head: 'bg-primary-600 text-white',
        badge: 'text-primary-700',
        label: 'Automated',
        icon: Bot,
    },
    assisted: {
        card: 'border-teal-300 bg-teal-50/60',
        head: 'bg-info text-white',
        badge: 'text-info',
        label: 'Human + assist',
        icon: UserCheck,
    },
    human: {
        card: 'border-neutral-300 bg-neutral-50',
        head: 'bg-neutral-500 text-white',
        badge: 'text-neutral-500',
        label: 'Stays human',
        icon: HardHat,
    },
};

export function VsmBlueprint({ stream, metrics }: VsmBlueprintProps) {
    const projected = projectedLeadTimeDays(stream, metrics);
    const current = metrics.leadTimeDays;
    const saving = current > 0 ? Math.max(0, ((current - projected) / current) * 100) : 0;
    const barScale = current > 0 ? 100 / current : 0;

    return (
        <Card>
            <CardHeader>
                <h3 className="font-semibold text-neutral-900">The automated future state</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                    Your process redrawn with the Microsoft tool that runs each step. Blue = fully automated, teal = a person with automation doing the legwork, grey = stays human (the automation handles its paperwork).
                </p>
            </CardHeader>
            <CardBody className="space-y-6">
                {/* Future-state flow */}
                <div className="flex items-stretch gap-0 overflow-x-auto pb-2 pt-5">
                    {stream.steps.map((s, i) => {
                        const sm = metrics.stepMetrics[i];
                        const auto = stepAutomation(s.name, s.notes || '');
                        const style = MODE_STYLE[auto.mode];
                        const Icon = style.icon;
                        const waitGone = sm && sm.waitDays > 0 && auto.waitFactor < 1;
                        return (
                            <React.Fragment key={s.id}>
                                {i > 0 && (
                                    <div className="flex items-center shrink-0 px-1.5 relative" style={{ minWidth: 44 }}>
                                        <div className="w-full h-0.5 bg-neutral-300 relative">
                                            <span className="absolute -right-1 -top-[3.5px] border-4 border-transparent border-l-neutral-400" />
                                        </div>
                                        {sm && sm.waitDays > 0 && (
                                            <span
                                                className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap px-1.5 py-0.5 rounded-full border ${
                                                    waitGone
                                                        ? 'text-neutral-400 bg-neutral-50 border-neutral-200 line-through'
                                                        : 'text-warning bg-warning-light border-warning/30'
                                                }`}
                                                title={waitGone ? 'This wait largely disappears - automated hand-off' : 'This wait remains'}
                                            >
                                                {fmtDays(sm.waitDays)}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <div className={`shrink-0 w-44 rounded-lg border shadow-sm overflow-hidden ${style.card}`}>
                                    <div className={`px-3 py-1.5 text-xs font-semibold truncate ${style.head}`} title={s.name}>
                                        {i + 1}. {s.name || `Step ${i + 1}`}
                                    </div>
                                    <div className="px-3 py-2 space-y-1">
                                        <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${style.badge}`}>
                                            <Icon size={13} /> {style.label}
                                        </span>
                                        <span className="block text-[11px] text-neutral-600 leading-snug">{auto.toolLabel}</span>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Before / after lead time */}
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-primary-700">Lead time: today vs the blueprint</h4>
                    <div className="space-y-1.5">
                        <BarRow label="Today" value={fmtDays(current)} widthPct={100} cls="bg-neutral-400" />
                        <BarRow label="Automated" value={fmtDays(projected)} widthPct={Math.max(4, projected * barScale)} cls="bg-primary-600" />
                    </div>
                    <p className="text-sm text-neutral-600">
                        Indicative reduction of <strong className="text-primary-700">{saving.toFixed(0)}%</strong> in end-to-end time -
                        the hands-on work stays the same, the waiting between steps shrinks because hand-offs happen instantly.
                        Validate with the pilot before promising it to anyone.
                    </p>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500 border-t border-neutral-100 pt-3">
                    <span className="flex items-center gap-1"><Bot size={13} className="text-primary-600" /> Automated - runs itself</span>
                    <span className="flex items-center gap-1"><UserCheck size={13} className="text-info" /> Human + assist - person decides, automation does the legwork</span>
                    <span className="flex items-center gap-1"><HardHat size={13} className="text-neutral-500" /> Stays human - physical work, digital paperwork</span>
                    <span className="text-neutral-400"><s>0.5 d</s> = wait removed by automation</span>
                </div>
            </CardBody>
        </Card>
    );
}

function BarRow({ label, value, widthPct, cls }: { label: string; value: string; widthPct: number; cls: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="w-20 text-xs font-medium text-neutral-600 text-right shrink-0">{label}</span>
            <div className="flex-1 h-6 bg-neutral-100 rounded overflow-hidden">
                <div className={`h-full rounded ${cls} transition-all`} style={{ width: `${Math.min(100, widthPct)}%` }} />
            </div>
            <span className="w-16 text-sm font-bold text-neutral-900 shrink-0">{value}</span>
        </div>
    );
}
