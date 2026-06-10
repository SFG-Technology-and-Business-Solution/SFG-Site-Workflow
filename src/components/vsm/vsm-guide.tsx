'use client';

// Educational guide: what VSM is, what data to collect, and how to run it.

import React, { useState } from 'react';
import {
    BookOpen,
    ClipboardList,
    Footprints,
    PencilRuler,
    Target,
    ChevronDown,
    Laptop,
} from 'lucide-react';
import { Card, CardBody } from '../ui';

const DATA_ITEMS = [
    { term: 'Process steps', what: 'Each distinct activity work passes through, in order.', how: 'Walk the flow yourself, from request to delivery. Name each step the way the team does.' },
    { term: 'Cycle time (C/T)', what: 'Hands-on time to complete one unit at a step.', how: 'Time 5-10 real units with a stopwatch and average them. Don\'t use estimates from memory.' },
    { term: 'Changeover time (C/O)', what: 'Time to switch from one job/product type to the next.', how: 'Time it from "last good unit of A" to "first good unit of B".' },
    { term: 'Uptime / availability', what: '% of time the step is actually able to work (not broken down, waiting for systems, etc.).', how: 'Log stoppages for a week, or pull it from maintenance records.' },
    { term: 'First-pass yield', what: '% of units that pass through without rework or rejection.', how: 'Count rework/returns at each step for a representative period.' },
    { term: 'Inventory / queue', what: 'Work sitting and waiting before each step (units, emails, work orders).', how: 'Physically count it on the day you walk the process. Queues = hidden lead time.' },
    { term: 'Batch size', what: 'How many units move together between steps.', how: 'Observe how work is actually released - big batches create waiting.' },
    { term: 'Operators', what: 'People working at each step.', how: 'Count who actually touches the work, not the org chart.' },
    { term: 'Customer demand', what: 'Units required per month/day - sets the takt time (the drumbeat).', how: 'Use real order history for the last 3-12 months, not the sales forecast.' },
    { term: 'Information flow', what: 'How orders, forecasts and schedules travel (email, EDI, verbal, paper).', how: 'Ask each step: "How do you know what to work on next?" The answers reveal the real system.' },
];

const STEPS = [
    { icon: Target, title: '1. Pick one value stream', text: 'Choose a single product or service family - work that follows broadly the same path. Don\'t try to map the whole business at once. Define the start (trigger) and end (delivery) points.' },
    { icon: ClipboardList, title: '2. Gather the data sheet', text: 'Print a data collection sheet (the Collect Data tab works as one). For every step you\'ll record: cycle time, changeover, uptime, yield, queue size, batch size and operators - plus customer demand and working time.' },
    { icon: Footprints, title: '3. Walk the process (gemba)', text: 'Go to where the work happens and follow one unit downstream - or better, walk upstream from delivery to request, so you see the process as the customer\'s pull. Time things yourself and count every queue you pass.' },
    { icon: PencilRuler, title: '4. Draw the current state', text: 'Enter the data in the Collect Data tab and the map draws itself: outside sources top corners, information flow along the top, process boxes left-to-right, inventory triangles between them, and the timeline ladder at the bottom.' },
    { icon: Target, title: '5. Read the map', text: 'Compare every step\'s cycle time to takt time (can it keep up with demand?). Compare total lead time to actual processing time - the gap is waste. The bottleneck gets a kaizen burst automatically.' },
    { icon: PencilRuler, title: '6. Design the future state & act', text: 'Ask: where can work flow piece-by-piece? Where do we need a pull signal instead of a schedule? The Action Plan tab turns what the map found into a step-by-step, time-phased plan.' },
];

const MS_GUIDE = [
    { tool: 'Excel / Forms', use: 'Build the data collection sheet as an Excel table (or a Forms survey the team fills in during the walk). One row per process step, columns matching the Collect Data tab here.' },
    { tool: 'Visio', use: 'Visio includes a built-in "Value Stream Map" template (File → New → search "value stream") with the standard symbols. Or export the .drawio file from the Map tab and keep it in diagrams.net.' },
    { tool: 'Planner / To Do', use: 'Export the Action Plan as CSV, then create a Planner plan with one bucket per phase and paste the tasks in. Assign owners and due dates from the timeframe column.' },
    { tool: 'Teams + SharePoint', use: 'Create a Teams channel for the value stream. Pin the map, store the data sheet on SharePoint, and run the weekly review meeting from the channel calendar.' },
    { tool: 'Power Automate', use: 'Once the future state defines pull signals, automate them: e.g. when a queue list on SharePoint exceeds its limit, post an alert to the team channel.' },
];

function Section({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Card>
            <button
                className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-neutral-50 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <span className="text-primary-600">{icon}</span>
                <span className="flex-1 font-semibold text-neutral-900">{title}</span>
                <ChevronDown size={18} className={`text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="px-6 pb-6 border-t border-neutral-100 pt-4">{children}</div>}
        </Card>
    );
}

export function VsmGuide() {
    return (
        <div className="space-y-4">
            <Card className="bg-gradient-to-br from-primary-50 to-white">
                <CardBody>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-primary-100 rounded-xl text-primary-700 shrink-0">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 mb-1">What is Value Stream Mapping?</h2>
                            <p className="text-sm text-neutral-600 leading-relaxed">
                                A value stream is every step - value-adding or not - that work passes through from request
                                to delivery. Value stream mapping (VSM) draws that flow on one page, with real timings, so
                                you can <strong>see the waste</strong>: work usually spends 95%+ of its life <em>waiting</em>, not being
                                worked on. The map makes that visible, points at the bottleneck, and gives the team one
                                shared picture to improve from.
                            </p>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Section title="What information to collect (and how)" icon={<ClipboardList size={20} />} defaultOpen>
                <p className="text-sm text-neutral-600 mb-4">
                    Collect this <strong>at the place the work happens</strong>, on a normal day. Measured beats reported, every time.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-neutral-400 border-b border-neutral-200">
                                <th className="py-2 pr-4 font-semibold">Data item</th>
                                <th className="py-2 pr-4 font-semibold">What it is</th>
                                <th className="py-2 font-semibold">How to collect it</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DATA_ITEMS.map((d) => (
                                <tr key={d.term} className="border-b border-neutral-100 align-top">
                                    <td className="py-2.5 pr-4 font-medium text-neutral-900 whitespace-nowrap">{d.term}</td>
                                    <td className="py-2.5 pr-4 text-neutral-600">{d.what}</td>
                                    <td className="py-2.5 text-neutral-500">{d.how}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            <Section title="How to run a mapping exercise, step by step" icon={<Footprints size={20} />}>
                <div className="grid sm:grid-cols-2 gap-4">
                    {STEPS.map((s) => (
                        <div key={s.title} className="flex gap-3 p-4 rounded-lg bg-neutral-50 border border-neutral-100">
                            <s.icon size={20} className="text-primary-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-sm text-neutral-900 mb-1">{s.title}</p>
                                <p className="text-sm text-neutral-600 leading-relaxed">{s.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Key measures the map calculates for you" icon={<Target size={20} />}>
                <dl className="space-y-3 text-sm">
                    <div>
                        <dt className="font-semibold text-neutral-900">Takt time = available working time ÷ customer demand</dt>
                        <dd className="text-neutral-600">The rhythm the customer sets. Any step slower than takt cannot keep up - that&apos;s your bottleneck.</dd>
                    </div>
                    <div>
                        <dt className="font-semibold text-neutral-900">Lead time = all waiting + all processing</dt>
                        <dd className="text-neutral-600">The elapsed time one unit takes end-to-end. Queues are converted to days using Little&apos;s Law (queue ÷ daily demand).</dd>
                    </div>
                    <div>
                        <dt className="font-semibold text-neutral-900">Process cycle efficiency (PCE) = processing time ÷ lead time</dt>
                        <dd className="text-neutral-600">Typically 1-5% before improvement. Don&apos;t be discouraged by a low number - it&apos;s the opportunity, made visible.</dd>
                    </div>
                </dl>
            </Section>

            <Section title="Doing this with Microsoft 365" icon={<Laptop size={20} />}>
                <p className="text-sm text-neutral-600 mb-4">
                    Everything here exports cleanly into the Microsoft ecosystem if that&apos;s where your team works:
                </p>
                <div className="space-y-3">
                    {MS_GUIDE.map((g) => (
                        <div key={g.tool} className="flex gap-3 text-sm">
                            <span className="font-semibold text-neutral-900 whitespace-nowrap w-40 shrink-0">{g.tool}</span>
                            <span className="text-neutral-600">{g.use}</span>
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}
