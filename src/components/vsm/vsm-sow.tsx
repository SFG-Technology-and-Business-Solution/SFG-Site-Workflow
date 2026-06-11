'use client';

// Scope of Works tab - five quick questions + a generated, decision-ready
// proposal for automating the mapped process with Microsoft 365 tools.

import React, { useEffect, useState } from 'react';
import { Download, FileText, Printer, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardBody, Button } from '../ui';
import { ValueStream, VsmMetrics, downloadFile } from '@/lib/vsm';
import { SowAnswers, SowDocument, emptyAnswers, generateSow, sowToHtml, sowToText } from '@/lib/vsm-sow';
import { aiAvailable, aiPolishSow } from '@/lib/vsm-ai';

interface VsmSowProps {
    stream: ValueStream;
    metrics: VsmMetrics;
}

const inputCls =
    'w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white';

function answersKey(id: string) {
    return `vsm-sow-answers-${id}`;
}

export function VsmSow({ stream, metrics }: VsmSowProps) {
    const [answers, setAnswers] = useState<SowAnswers>(emptyAnswers());
    const [doc, setDoc] = useState<SowDocument | null>(null);
    const [hasAi, setHasAi] = useState(false);
    const [polished, setPolished] = useState<string | null>(null);
    const [polishing, setPolishing] = useState(false);

    useEffect(() => {
        aiAvailable().then(setHasAi);
        try {
            const saved = localStorage.getItem(answersKey(stream.id));
            if (saved) setAnswers({ ...emptyAnswers(), ...JSON.parse(saved) });
        } catch {
            // ignore corrupted save
        }
    }, [stream.id]);

    const setA = (patch: Partial<SowAnswers>) => {
        const next = { ...answers, ...patch };
        setAnswers(next);
        localStorage.setItem(answersKey(stream.id), JSON.stringify(next));
    };

    const generate = () => {
        setDoc(generateSow(stream, metrics, answers));
        setPolished(null);
    };

    const fileBase = (stream.name || 'process').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase();

    const downloadWord = () => {
        if (!doc) return;
        downloadFile(`${fileBase}-scope-of-works.doc`, sowToHtml(doc), 'application/msword');
    };

    const printSow = () => {
        if (!doc) return;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(sowToHtml(doc));
        w.document.close();
        w.focus();
        w.print();
    };

    const polish = async () => {
        if (!doc) return;
        setPolishing(true);
        try {
            setPolished(await aiPolishSow(sowToText(doc)));
        } catch {
            alert('The AI could not polish the document right now - the generated version below is still ready to use.');
        } finally {
            setPolishing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Questionnaire */}
            <Card>
                <CardHeader>
                    <h3 className="font-semibold text-neutral-900">Five quick questions</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        The map knows the times and queues - these are the things only you know. Then the Scope of Works writes itself.
                    </p>
                </CardHeader>
                <CardBody className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-neutral-500 mb-1">
                            1 · What software or systems touch this process today?
                        </label>
                        <input className={inputCls} value={answers.systemsUsed} placeholder="e.g. Outlook, Excel spreadsheets, MYOB, paper forms"
                            onChange={(e) => setA({ systemsUsed: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">
                            2 · How many times does it run per week?
                        </label>
                        <input type="number" min={0} className={inputCls} value={answers.runsPerWeek}
                            onChange={(e) => setA({ runsPerWeek: Math.max(0, Number(e.target.value) || 0) })} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">
                            3 · How many people are involved across it?
                        </label>
                        <input type="number" min={0} className={inputCls} value={answers.peopleInvolved}
                            onChange={(e) => setA({ peopleInvolved: Math.max(0, Number(e.target.value) || 0) })} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">
                            4 · Which step does the team find most painful?
                        </label>
                        <select className={inputCls} value={answers.painPointStepId} onChange={(e) => setA({ painPointStepId: e.target.value })}>
                            <option value="">Let the data decide</option>
                            {stream.steps.map((s, i) => (
                                <option key={s.id} value={s.id}>{s.name || `Step ${i + 1}`}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-500 mb-1">
                            5 · Any records or sign-offs that must be kept? <span className="text-neutral-400">(optional)</span>
                        </label>
                        <input className={inputCls} value={answers.compliance} placeholder="e.g. signed safety permits kept 7 years"
                            onChange={(e) => setA({ compliance: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                        <Button icon={doc ? <RefreshCw size={16} /> : <FileText size={16} />} onClick={generate} className="w-full sm:w-auto">
                            {doc ? 'Regenerate the Scope of Works' : 'Generate the Scope of Works'}
                        </Button>
                    </div>
                </CardBody>
            </Card>

            {/* Generated document */}
            {doc && (
                <Card>
                    <CardHeader
                        action={
                            <div className="flex gap-2">
                                {hasAi && (
                                    <Button variant="secondary" size="sm" icon={<Sparkles size={14} />} onClick={polish} disabled={polishing}>
                                        {polishing ? 'Polishing…' : 'Polish wording with AI'}
                                    </Button>
                                )}
                                <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={printSow}>Print / PDF</Button>
                                <Button size="sm" icon={<Download size={14} />} onClick={downloadWord}>Download for Word</Button>
                            </div>
                        }
                    >
                        <h3 className="font-semibold text-neutral-900">{doc.title}</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">Prepared for {doc.preparedFor} · {doc.date} · Draft for review</p>
                    </CardHeader>
                    <CardBody className="space-y-6 text-sm text-neutral-700">
                        <Section title="Background"><p>{doc.background}</p></Section>
                        <Section title="Current state (from the map)"><Bullets items={doc.currentState} /></Section>
                        <Section title="Objectives"><Bullets items={doc.objectives} /></Section>
                        <Section title="Recommended automation, step by step">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-primary-50 text-primary-900 text-left">
                                            <th className="border border-neutral-200 px-3 py-2 w-[18%]">Process step</th>
                                            <th className="border border-neutral-200 px-3 py-2 w-[38%]">Problem today</th>
                                            <th className="border border-neutral-200 px-3 py-2">Recommended Microsoft automation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {doc.recommendations.map((r, i) => (
                                            <tr key={i} className="align-top">
                                                <td className="border border-neutral-200 px-3 py-2">
                                                    <span className="font-semibold text-neutral-900">{i + 1}. {r.stepName}</span>
                                                    <span className="block text-xs text-neutral-400 mt-1">Effort: {r.effort}</span>
                                                </td>
                                                <td className="border border-neutral-200 px-3 py-2">{r.problem}</td>
                                                <td className="border border-neutral-200 px-3 py-2">
                                                    {r.recommendation}
                                                    <span className="block text-xs font-semibold text-primary-700 mt-1">{r.tools.join(' · ')}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Section>
                        <Section title="Suggested pilot"><p>{doc.pilot}</p></Section>
                        <Section title="Expected benefits"><Bullets items={doc.benefits} /></Section>
                        <Section title="Licensing notes"><Bullets items={doc.licensing} /></Section>
                        <Section title="Assumptions"><Bullets items={doc.assumptions} /></Section>
                        <Section title="Next steps">
                            <ol className="list-decimal ml-5 space-y-1">
                                {doc.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                            </ol>
                        </Section>
                    </CardBody>
                </Card>
            )}

            {/* AI-polished version */}
            {polished && (
                <Card>
                    <CardHeader>
                        <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                            <Sparkles size={16} className="text-primary-600" /> AI-polished wording
                        </h3>
                        <p className="text-xs text-neutral-500 mt-0.5">Same facts and structure, smoother prose. Copy what you like into the document above.</p>
                    </CardHeader>
                    <CardBody>
                        <div className="whitespace-pre-wrap text-sm text-neutral-700 leading-relaxed">{polished}</div>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h4 className="text-sm font-semibold text-primary-700 border-b-2 border-primary-100 pb-1 mb-2">{title}</h4>
            {children}
        </div>
    );
}

function Bullets({ items }: { items: string[] }) {
    return (
        <ul className="list-disc ml-5 space-y-1">
            {items.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
    );
}
