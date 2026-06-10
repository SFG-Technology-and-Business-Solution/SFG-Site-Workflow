'use client';

// Guided data-collection worksheet for the value stream.

import React from 'react';
import { Plus, Trash2, ArrowDown, ArrowUp, Info } from 'lucide-react';
import { Card, CardHeader, CardBody, Button } from '../ui';
import { ValueStream, VsmProcessStep, VsmMetrics, emptyStep, fmtSeconds } from '@/lib/vsm';

interface VsmDataFormProps {
    stream: ValueStream;
    metrics: VsmMetrics;
    onChange: (stream: ValueStream) => void;
}

const inputCls =
    'w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white';
const labelCls = 'block text-xs font-medium text-neutral-500 mb-1';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className={labelCls} title={hint}>
                {label}
            </label>
            {children}
            {hint && <p className="text-[11px] text-neutral-400 mt-1 leading-snug">{hint}</p>}
        </div>
    );
}

export function VsmDataForm({ stream, metrics, onChange }: VsmDataFormProps) {
    const set = (patch: Partial<ValueStream>) => onChange({ ...stream, ...patch });

    const setStep = (id: string, patch: Partial<VsmProcessStep>) =>
        set({ steps: stream.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

    const addStep = () => set({ steps: [...stream.steps, emptyStep()] });

    const removeStep = (id: string) => set({ steps: stream.steps.filter((s) => s.id !== id) });

    const moveStep = (id: string, dir: -1 | 1) => {
        const i = stream.steps.findIndex((s) => s.id === id);
        const j = i + dir;
        if (j < 0 || j >= stream.steps.length) return;
        const steps = [...stream.steps];
        [steps[i], steps[j]] = [steps[j], steps[i]];
        set({ steps });
    };

    const num = (v: string) => (v === '' ? 0 : Math.max(0, Number(v)));

    return (
        <div className="space-y-6">
            {/* 1. Define the stream */}
            <Card>
                <CardHeader>
                    <h3 className="font-semibold text-neutral-900">1 · Define the value stream</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">One product or service family, from request to delivery.</p>
                </CardHeader>
                <CardBody className="grid sm:grid-cols-2 gap-4">
                    <Field label="Organisation / client" hint="Whose process is this?">
                        <input className={inputCls} value={stream.client} placeholder="Acme Industries"
                            onChange={(e) => set({ client: e.target.value })} />
                    </Field>
                    <Field label="Department / business area" hint="e.g. Maintenance, Finance, Customer Service">
                        <input className={inputCls} value={stream.area} placeholder="Maintenance Services"
                            onChange={(e) => set({ area: e.target.value })} />
                    </Field>
                    <Field label="Map type" hint="Current state = as it is today. Future state = the target design.">
                        <select className={inputCls} value={stream.mapType}
                            onChange={(e) => set({ mapType: e.target.value as 'current' | 'future' })}>
                            <option value="current">Current state (as-is)</option>
                            <option value="future">Future state (target)</option>
                        </select>
                    </Field>
                    <Field label="Value stream name" hint="e.g. Work order processing, Quote to cash">
                        <input className={inputCls} value={stream.name} placeholder="Work Order Processing"
                            onChange={(e) => set({ name: e.target.value })} />
                    </Field>
                    <Field label="Product / service family" hint="The group of similar work this map covers">
                        <input className={inputCls} value={stream.productFamily} placeholder="Maintenance work orders"
                            onChange={(e) => set({ productFamily: e.target.value })} />
                    </Field>
                    <Field label="Customer (who receives the output)">
                        <input className={inputCls} value={stream.customerName} placeholder="Client Operations"
                            onChange={(e) => set({ customerName: e.target.value })} />
                    </Field>
                    <Field label="Supplier (who triggers / feeds the work)">
                        <input className={inputCls} value={stream.supplierName} placeholder="Client Asset Team"
                            onChange={(e) => set({ supplierName: e.target.value })} />
                    </Field>
                </CardBody>
            </Card>

            {/* 2. Demand & working time */}
            <Card>
                <CardHeader>
                    <h3 className="font-semibold text-neutral-900">2 · Customer demand & working time</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">These set the takt time - the pace the customer demands.</p>
                </CardHeader>
                <CardBody>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <Field label="Demand / month" hint="Units ordered per month">
                            <input type="number" className={inputCls} value={stream.demandPerMonth}
                                onChange={(e) => set({ demandPerMonth: num(e.target.value) })} />
                        </Field>
                        <Field label="Working days / month">
                            <input type="number" className={inputCls} value={stream.daysPerMonth}
                                onChange={(e) => set({ daysPerMonth: num(e.target.value) })} />
                        </Field>
                        <Field label="Shifts / day">
                            <input type="number" className={inputCls} value={stream.shiftsPerDay}
                                onChange={(e) => set({ shiftsPerDay: num(e.target.value) })} />
                        </Field>
                        <Field label="Hours / shift">
                            <input type="number" className={inputCls} value={stream.shiftHours}
                                onChange={(e) => set({ shiftHours: num(e.target.value) })} />
                        </Field>
                        <Field label="Breaks (min/shift)">
                            <input type="number" className={inputCls} value={stream.breaksMinPerShift}
                                onChange={(e) => set({ breaksMinPerShift: num(e.target.value) })} />
                        </Field>
                    </div>
                    <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-primary-50 rounded-lg text-sm text-primary-800">
                        <Info size={16} className="shrink-0" />
                        <span>
                            Takt time = <strong>{fmtSeconds(metrics.taktSec)}</strong> per unit
                            ({Math.round(metrics.demandPerDay)} units/day across {fmtSeconds(metrics.availableSecPerDay)} of working time).
                            Any step slower than this can&apos;t keep up with demand.
                        </span>
                    </div>
                </CardBody>
            </Card>

            {/* 3. Information flow */}
            <Card>
                <CardHeader>
                    <h3 className="font-semibold text-neutral-900">3 · Information flow</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">How does each part of the stream know what to do next?</p>
                </CardHeader>
                <CardBody className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Field label="How the customer orders" hint="e.g. Weekly email orders / 90-day forecast">
                        <input className={inputCls} value={stream.customerOrderMethod}
                            onChange={(e) => set({ customerOrderMethod: e.target.value })} />
                    </Field>
                    <Field label="How you order from the supplier" hint="e.g. Daily work request feed">
                        <input className={inputCls} value={stream.supplierOrderMethod}
                            onChange={(e) => set({ supplierOrderMethod: e.target.value })} />
                    </Field>
                    <Field label="How work is scheduled internally" hint="e.g. Weekly schedule to supervisors">
                        <input className={inputCls} value={stream.scheduleMethod}
                            onChange={(e) => set({ scheduleMethod: e.target.value })} />
                    </Field>
                    <Field label="Inbound delivery frequency" hint="From supplier">
                        <input className={inputCls} value={stream.deliveryFrequency}
                            onChange={(e) => set({ deliveryFrequency: e.target.value })} />
                    </Field>
                    <Field label="Outbound shipment frequency" hint="To customer">
                        <input className={inputCls} value={stream.shipmentFrequency}
                            onChange={(e) => set({ shipmentFrequency: e.target.value })} />
                    </Field>
                </CardBody>
            </Card>

            {/* 4. Process steps */}
            <Card>
                <CardHeader action={
                    <Button size="sm" icon={<Plus size={16} />} onClick={addStep}>Add step</Button>
                }>
                    <h3 className="font-semibold text-neutral-900">4 · Process steps (in order of flow)</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Walk the process and time each step. The queue is what&apos;s waiting <em>before</em> the step.</p>
                </CardHeader>
                <CardBody className="space-y-4">
                    {stream.steps.length === 0 && (
                        <p className="text-sm text-neutral-400 text-center py-6">
                            No steps yet - add the first step of the process, or load the sample from the header.
                        </p>
                    )}
                    {stream.steps.map((s, i) => {
                        const sm = metrics.stepMetrics.find((m) => m.step.id === s.id);
                        return (
                            <div key={s.id} className={`rounded-xl border p-4 ${sm?.isBottleneck ? 'border-red-300 bg-red-50/40' : 'border-neutral-200 bg-neutral-50/50'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <input
                                        className={`${inputCls} font-medium`}
                                        placeholder={`Step ${i + 1} name (e.g. Assess & Quote)`}
                                        value={s.name}
                                        onChange={(e) => setStep(s.id, { name: e.target.value })}
                                    />
                                    {sm?.isBottleneck && (
                                        <span className="text-[11px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full whitespace-nowrap">
                                            BOTTLENECK
                                        </span>
                                    )}
                                    <div className="flex gap-1 shrink-0">
                                        <button className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded" onClick={() => moveStep(s.id, -1)} title="Move earlier" aria-label="Move step earlier">
                                            <ArrowUp size={15} />
                                        </button>
                                        <button className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded" onClick={() => moveStep(s.id, 1)} title="Move later" aria-label="Move step later">
                                            <ArrowDown size={15} />
                                        </button>
                                        <button className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => removeStep(s.id)} title="Remove step" aria-label="Remove step">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                                    <Field label="Cycle time (s)" hint="Touch time per unit">
                                        <input type="number" className={inputCls} value={s.cycleTimeSec}
                                            onChange={(e) => setStep(s.id, { cycleTimeSec: num(e.target.value) })} />
                                    </Field>
                                    <Field label="Changeover (s)">
                                        <input type="number" className={inputCls} value={s.changeoverSec}
                                            onChange={(e) => setStep(s.id, { changeoverSec: num(e.target.value) })} />
                                    </Field>
                                    <Field label="Uptime %">
                                        <input type="number" max={100} className={inputCls} value={s.uptimePct}
                                            onChange={(e) => setStep(s.id, { uptimePct: Math.min(100, num(e.target.value)) })} />
                                    </Field>
                                    <Field label="Yield %">
                                        <input type="number" max={100} className={inputCls} value={s.yieldPct}
                                            onChange={(e) => setStep(s.id, { yieldPct: Math.min(100, num(e.target.value)) })} />
                                    </Field>
                                    <Field label="Batch size">
                                        <input type="number" className={inputCls} value={s.batchSize}
                                            onChange={(e) => setStep(s.id, { batchSize: num(e.target.value) })} />
                                    </Field>
                                    <Field label="Queue before" hint="Units waiting">
                                        <input type="number" className={inputCls} value={s.inventoryBefore}
                                            onChange={(e) => setStep(s.id, { inventoryBefore: num(e.target.value) })} />
                                    </Field>
                                    <Field label="Operators">
                                        <input type="number" className={inputCls} value={s.operators}
                                            onChange={(e) => setStep(s.id, { operators: num(e.target.value) })} />
                                    </Field>
                                </div>
                                <div className="mt-3">
                                    <input
                                        className={`${inputCls} text-neutral-500`}
                                        placeholder="Observations (e.g. work batched for site visits, frequent access delays)"
                                        value={s.notes || ''}
                                        onChange={(e) => setStep(s.id, { notes: e.target.value })}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {stream.steps.length > 0 && (
                        <Button variant="secondary" icon={<Plus size={16} />} onClick={addStep} className="w-full">
                            Add another step
                        </Button>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
