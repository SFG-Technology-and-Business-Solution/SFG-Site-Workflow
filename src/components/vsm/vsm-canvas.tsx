'use client';

// Interactive (draw.io style) value stream map canvas.
// Nodes are draggable; positions persist on the stream via onPositionsChange.

import React, { useRef, useState, useCallback } from 'react';
import { Download, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { Button } from '../ui';
import {
    ValueStream,
    VsmMetrics,
    fmtSeconds,
    fmtDays,
    toDrawioXml,
    downloadFile,
} from '@/lib/vsm';

interface VsmCanvasProps {
    stream: ValueStream;
    metrics: VsmMetrics;
    onPositionsChange: (positions: Record<string, { x: number; y: number }>) => void;
}

const STEP_W = 160;
const STEP_GAP = 80;
const DATA_H = 78;
const PROC_H = 50;
const ROW_Y = 290;
const TOP_Y = 50;

// Fluent palette
const INK = '#242424';
const INK_2 = '#616161';
const INK_3 = '#8a8a8a';
const BLUE = '#0078d4';
const NAVY = '#0a2e4d';
const RED = '#d13438';
const GREEN = '#107c10';

interface NodePos {
    x: number;
    y: number;
}

/** Word-wrap a label into at most maxLines lines of ~maxChars, ellipsising the rest. */
function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        if ((line + ' ' + word).trim().length <= maxChars) {
            line = (line + ' ' + word).trim();
        } else {
            if (line) lines.push(line);
            line = word;
            if (lines.length === maxLines) break;
        }
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length > maxLines || (lines.length === maxLines && line && !lines.includes(line))) {
        lines.length = maxLines;
        const last = lines[maxLines - 1];
        lines[maxLines - 1] = last.length > maxChars - 1 ? last.slice(0, maxChars - 1) + '…' : last + '…';
    }
    return lines.length ? lines : [text.slice(0, maxChars)];
}

function trunc(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

interface FactoryNodeProps {
    p: NodePos;
    label: string;
    sub?: string;
    selected: boolean;
    onPointerDown: (e: React.PointerEvent) => void;
}

// Standard VSM outside-source symbol (sawtooth factory roof)
function FactoryNode({ p, label, sub, selected, onPointerDown }: FactoryNodeProps) {
    const w = 140;
    const lines = wrapLabel(label, 20, 2);
    return (
        <g
            transform={`translate(${p.x},${p.y})`}
            onPointerDown={onPointerDown}
            className="cursor-grab"
            style={{ touchAction: 'none' }}
        >
            <title>{label}</title>
            <path
                d={`M0,20 L${w / 3},6 L${w / 3},20 L${(2 * w) / 3},6 L${(2 * w) / 3},20 L${w},6 L${w},62 L0,62 Z`}
                fill="#eff6fc"
                stroke={selected ? BLUE : '#5b5b5b'}
                strokeWidth={selected ? 2.5 : 1.5}
            />
            {lines.map((ln, i) => (
                <text key={i} x={w / 2} y={lines.length === 1 ? 38 : 33 + i * 12} textAnchor="middle" fontSize={lines.length === 1 ? 12 : 10.5} fontWeight={600} fill={INK}>
                    {ln}
                </text>
            ))}
            {sub && (
                <text x={w / 2} y={56} textAnchor="middle" fontSize="9" fill={INK_2}>
                    {trunc(sub, 26)}
                </text>
            )}
        </g>
    );
}

export function VsmCanvas({ stream, metrics, onPositionsChange }: VsmCanvasProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
    const [selected, setSelected] = useState<string | null>(null);

    const steps = stream.steps;
    const n = steps.length;

    // Default layout positions, overridable by drag
    const width = Math.max(1100, 180 + n * (STEP_W + STEP_GAP) + 220);
    const height = 620;

    const defaultPos = useCallback(
        (id: string): NodePos => {
            if (id === 'supplier') return { x: 30, y: TOP_Y };
            if (id === 'customer') return { x: width - 170, y: TOP_Y };
            if (id === 'control') return { x: width / 2 - 110, y: TOP_Y };
            const i = steps.findIndex((s) => s.id === id);
            return { x: 110 + i * (STEP_W + STEP_GAP), y: ROW_Y };
        },
        [steps, width]
    );

    const pos = (id: string): NodePos => stream.positions[id] ?? defaultPos(id);

    const toSvgPoint = (e: React.PointerEvent): NodePos => {
        const rect = svgRef.current!.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (width / rect.width),
            y: (e.clientY - rect.top) * (height / rect.height),
        };
    };

    const startDrag = (id: string) => (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const p = toSvgPoint(e);
        const np = pos(id);
        setSelected(id);
        setDrag({ id, dx: p.x - np.x, dy: p.y - np.y });
    };

    const onMove = (e: React.PointerEvent) => {
        if (!drag) return;
        const p = toSvgPoint(e);
        onPositionsChange({
            ...stream.positions,
            [drag.id]: {
                x: Math.max(0, Math.min(width - 60, p.x - drag.dx)),
                y: Math.max(0, Math.min(height - 60, p.y - drag.dy)),
            },
        });
    };

    const endDrag = () => setDrag(null);

    const resetLayout = () => onPositionsChange({});

    const exportSvg = () => {
        if (!svgRef.current) return;
        const src = new XMLSerializer().serializeToString(svgRef.current);
        downloadFile(`${stream.name || 'value-stream-map'}.svg`, src, 'image/svg+xml');
    };

    const exportPng = () => {
        if (!svgRef.current) return;
        const src = new XMLSerializer().serializeToString(svgRef.current);
        const img = new Image();
        const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (!blob) return;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${stream.name || 'value-stream-map'}.png`;
                a.click();
                URL.revokeObjectURL(a.href);
            });
        };
        img.src = url;
    };

    const exportDrawio = () => {
        downloadFile(
            `${stream.name || 'value-stream-map'}.drawio`,
            toDrawioXml(stream, metrics),
            'application/xml'
        );
    };

    const supplierP = pos('supplier');
    const customerP = pos('customer');
    const controlP = pos('control');

    const infoArrow = (x1: number, y1: number, x2: number, y2: number, label: string, key: string) => {
        const mx = (x1 + x2) / 2;
        const my = Math.min(y1, y2) - 26;
        return (
            <g key={key}>
                <path
                    d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
                    fill="none"
                    stroke={INK_3}
                    strokeWidth={1.2}
                    strokeDasharray="6 4"
                    markerEnd="url(#arrow-info)"
                />
                {label && (
                    <text x={mx} y={my + 12} textAnchor="middle" fontSize="9" fill={INK_2}>
                        <title>{label}</title>
                        {trunc(label, 44)}
                    </text>
                )}
            </g>
        );
    };

    // Steps ordered by current x so dragging keeps flow & ladder sane
    const orderedSteps = [...steps].sort((a, b) => pos(a.id).x - pos(b.id).x);

    // Schedule rail: one clean dashed line from Production Control across the
    // step row with a short drop to each step (replaces the n-arrow spider web)
    const railY = ROW_Y - 34;
    const railNodes: React.ReactNode[] = [];
    if (n > 0) {
        const xs = orderedSteps.map((s) => pos(s.id).x + STEP_W / 2);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const cx = controlP.x + 110;
        const cy = controlP.y + 56;
        railNodes.push(
            <g key="rail" stroke={INK_3} strokeWidth={1.2} strokeDasharray="5 4" fill="none">
                <path d={`M${cx},${cy} L${Math.max(minX, Math.min(maxX, cx))},${railY}`} />
                {n > 1 && <line x1={minX} y1={railY} x2={maxX} y2={railY} />}
                {xs.map((x, i) => (
                    <line key={i} x1={x} y1={railY} x2={x} y2={ROW_Y - 6} markerEnd="url(#arrow-info)" />
                ))}
            </g>,
            <text key="rail-label" x={(minX + maxX) / 2} y={railY - 6} textAnchor="middle" fontSize="9" fill={INK_2}>
                {trunc(stream.scheduleMethod || 'Schedule', 40)}
            </text>
        );
    }

    // Timeline ladder anchored to each step's actual x position
    const ladderY = 480;
    const ladderSegs: React.ReactNode[] = [];
    let ladderEndX = 110;
    orderedSteps.forEach((s, i) => {
        const sm = metrics.stepMetrics.find((m) => m.step.id === s.id)!;
        const px = pos(s.id).x;
        const waitStart = i === 0 ? Math.max(60, px - 70) : pos(orderedSteps[i - 1].id).x + STEP_W;
        // wait segment (upper rail = non-value-added)
        ladderSegs.push(
            <g key={`w-${s.id}`}>
                <path d={`M${waitStart},${ladderY - 22} H${px} V${ladderY}`} fill="none" stroke={RED} strokeWidth={1.6} />
                <text x={(waitStart + px) / 2} y={ladderY - 28} textAnchor="middle" fontSize="10" fill={RED} fontWeight={600}>
                    {fmtDays(sm.waitDays)}
                </text>
            </g>
        );
        // work segment (lower rail = value-added)
        ladderSegs.push(
            <g key={`c-${s.id}`}>
                <path
                    d={`M${px},${ladderY} H${px + STEP_W} ${i < orderedSteps.length - 1 ? `V${ladderY - 22}` : ''}`}
                    fill="none" stroke={GREEN} strokeWidth={1.6}
                />
                <text x={px + STEP_W / 2} y={ladderY + 16} textAnchor="middle" fontSize="10" fill={GREEN} fontWeight={600}>
                    {fmtSeconds(s.cycleTimeSec)}
                </text>
            </g>
        );
        ladderEndX = px + STEP_W;
    });

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportDrawio}>
                    Export .drawio
                </Button>
                <Button variant="secondary" size="sm" icon={<ImageIcon size={14} />} onClick={exportPng}>
                    Export PNG
                </Button>
                <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportSvg}>
                    Export SVG
                </Button>
                <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={resetLayout}>
                    Reset layout
                </Button>
                <span className="text-xs text-neutral-400 ml-auto">Tip: drag any box to rearrange - the arrows follow.</span>
            </div>

            <div className="overflow-x-auto border border-neutral-200 rounded-xl bg-white">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    width={width}
                    height={height}
                    onPointerMove={onMove}
                    onPointerUp={endDrag}
                    onPointerLeave={endDrag}
                    style={{ fontFamily: '"Segoe UI", ui-sans-serif, system-ui, sans-serif', userSelect: 'none' }}
                >
                    <defs>
                        <marker id="arrow-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                            <path d="M0,0 L10,5 L0,10 Z" fill="#3b3a39" />
                        </marker>
                        <marker id="arrow-info" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                            <path d="M0,0 L10,5 L0,10 Z" fill={INK_3} />
                        </marker>
                    </defs>

                    <rect width={width} height={height} fill="#faf9f8" />
                    <text x={20} y={26} fontSize="15" fontWeight={700} fill={NAVY}>
                        {stream.name || 'Value Stream Map'}
                        {stream.productFamily ? `  -  ${stream.productFamily}` : ''}
                        <tspan fontSize="11" fontWeight={500} fill={stream.mapType === 'future' ? BLUE : INK_2}>
                            {'   '}{stream.mapType === 'future' ? 'FUTURE STATE' : 'CURRENT STATE'}
                            {stream.client ? `  ·  ${stream.client}` : ''}
                        </tspan>
                    </text>
                    <text x={width - 16} y={height - 12} textAnchor="end" fontSize="10" fill={INK_3}>
                        Made with VSM Buddy · AI² Solutions
                    </text>

                    {/* Information flow (dashed) */}
                    {infoArrow(customerP.x + 10, customerP.y + 30, controlP.x + 220, controlP.y + 28, stream.customerOrderMethod || 'Orders / forecast', 'cust-pc')}
                    {infoArrow(controlP.x, controlP.y + 28, supplierP.x + 130, supplierP.y + 30, stream.supplierOrderMethod || 'Orders', 'pc-sup')}

                    {/* Schedule rail to the step row */}
                    {railNodes}

                    {/* Material flow arrows: supplier -> steps (in x order) -> customer */}
                    {(() => {
                        const chain: { x: number; y: number }[] = [
                            { x: supplierP.x + 70, y: supplierP.y + 62 },
                            ...orderedSteps.map((s) => {
                                const p = pos(s.id);
                                return { x: p.x + STEP_W / 2, y: p.y + (PROC_H + DATA_H) / 2 };
                            }),
                            { x: customerP.x + 70, y: customerP.y + 62 },
                        ];
                        return chain.slice(0, -1).map((a, i) => {
                            // start/end at box edges rather than centres
                            const b = chain[i + 1];
                            const x1 = i === 0 ? a.x : a.x + STEP_W / 2;
                            // stop short of the target step's inventory triangle when it has one
                            const x2 = i === chain.length - 2 ? b.x : b.x - STEP_W / 2 - (orderedSteps[i]?.inventoryBefore ? 56 : 0);
                            return (
                                <line
                                    key={`mat-${i}`}
                                    x1={x1}
                                    y1={a.y}
                                    x2={x2}
                                    y2={b.y}
                                    stroke="#3b3a39"
                                    strokeWidth={1.8}
                                    markerEnd="url(#arrow-flow)"
                                />
                            );
                        });
                    })()}

                    {/* Outside sources */}
                    <FactoryNode
                        p={supplierP}
                        label={stream.supplierName || 'Supplier'}
                        sub={stream.deliveryFrequency}
                        selected={selected === 'supplier'}
                        onPointerDown={startDrag('supplier')}
                    />
                    <FactoryNode
                        p={customerP}
                        label={stream.customerName || 'Customer'}
                        sub={`${Math.round(metrics.demandPerDay)}/day · Takt ${fmtSeconds(metrics.taktSec)}`}
                        selected={selected === 'customer'}
                        onPointerDown={startDrag('customer')}
                    />

                    {/* Production control */}
                    <g
                        transform={`translate(${controlP.x},${controlP.y})`}
                        onPointerDown={startDrag('control')}
                        className="cursor-grab"
                        style={{ touchAction: 'none' }}
                    >
                        <rect width={220} height={56} fill="#ffffff" stroke={selected === 'control' ? BLUE : '#5b5b5b'} strokeWidth={selected === 'control' ? 2.5 : 1.5} />
                        <text x={110} y={22} textAnchor="middle" fontSize="12" fontWeight={600} fill={INK}>Production Control</text>
                        <text x={110} y={40} textAnchor="middle" fontSize="9" fill={INK_2}>
                            <title>{stream.scheduleMethod || 'Scheduling'}</title>
                            {trunc(stream.scheduleMethod || 'Scheduling', 38)}
                        </text>
                    </g>

                    {/* Process steps with data boxes, inventory triangles & kaizen bursts */}
                    {steps.map((s, idx) => {
                        const sm = metrics.stepMetrics.find((m) => m.step.id === s.id)!;
                        const p = pos(s.id);
                        const isSel = selected === s.id;
                        const nameLines = wrapLabel(s.name || `Step ${idx + 1}`, 24, 2);
                        // only print data rows that carry real information
                        const dataRows = [
                            `C/T: ${s.cycleTimeSec > 0 ? fmtSeconds(s.cycleTimeSec) : '—'}`,
                            ...(s.changeoverSec > 0 ? [`C/O: ${fmtSeconds(s.changeoverSec)}`] : []),
                            ...((s.uptimePct > 0 && s.uptimePct < 100) || (s.yieldPct > 0 && s.yieldPct < 100)
                                ? [`Uptime: ${s.uptimePct || 100}%  Yield: ${s.yieldPct || 100}%`]
                                : []),
                            ...(s.batchSize > 1 ? [`Batch: ${s.batchSize}`] : []),
                        ];
                        return (
                            <g
                                key={s.id}
                                transform={`translate(${p.x},${p.y})`}
                                onPointerDown={startDrag(s.id)}
                                className="cursor-grab"
                                style={{ touchAction: 'none' }}
                            >
                                {/* inventory triangle before the step */}
                                {s.inventoryBefore > 0 && (
                                    <g transform={`translate(${-52},${(PROC_H + DATA_H) / 2 - 22})`}>
                                        <path d="M0,40 L20,4 L40,40 Z" fill="#fff8e1" stroke="#c19c00" strokeWidth={1.5} />
                                        <text x={20} y={32} textAnchor="middle" fontSize="9" fontWeight={700} fill="#7a6400">{s.inventoryBefore}</text>
                                        <text x={20} y={54} textAnchor="middle" fontSize="9" fill="#7a6400">{fmtDays(sm.waitDays)}</text>
                                    </g>
                                )}

                                {/* process box */}
                                <rect width={STEP_W} height={PROC_H} fill="#ffffff" stroke={isSel ? BLUE : '#3b3a39'} strokeWidth={isSel ? 2.5 : 1.5} />
                                <title>{s.name}</title>
                                {nameLines.map((ln, li) => (
                                    <text
                                        key={li}
                                        x={STEP_W / 2}
                                        y={nameLines.length === 1 ? 20 : 16 + li * 13}
                                        textAnchor="middle"
                                        fontSize={nameLines.length === 1 ? 11.5 : 10}
                                        fontWeight={700}
                                        fill={NAVY}
                                    >
                                        {ln}
                                    </text>
                                ))}
                                {s.operators > 0 && (
                                    <text x={STEP_W / 2} y={PROC_H - 7} textAnchor="middle" fontSize="9" fill={INK_2}>
                                        {s.operators} {s.operators === 1 ? 'person' : 'people'}
                                    </text>
                                )}

                                {/* data box */}
                                <rect y={PROC_H} width={STEP_W} height={DATA_H} fill="#faf9f8" stroke="#a19f9d" strokeWidth={1} />
                                {dataRows.map((line, li) => (
                                    <text key={li} x={8} y={PROC_H + 17 + li * 16} fontSize="9.5" fill={INK}>
                                        {line}
                                    </text>
                                ))}

                                {/* kaizen burst on the bottleneck */}
                                {sm.isBottleneck && (
                                    <g transform={`translate(${STEP_W - 14},-14)`}>
                                        <path
                                            d="M0,-16 L5,-5 L17,-8 L9,1 L18,9 L6,8 L4,20 L-3,9 L-15,13 L-8,2 L-18,-5 L-6,-6 Z"
                                            fill="#fdf3f4" stroke={RED} strokeWidth={1.4}
                                        />
                                        <text y={4} textAnchor="middle" fontSize="7.5" fontWeight={700} fill={RED}>KAIZEN</text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {/* Timeline ladder */}
                    {n > 0 && (
                        <g>
                            <text x={60} y={ladderY - 46} fontSize="10" fontWeight={600} fill={RED}>Waiting (non-value-added)</text>
                            <text x={60} y={ladderY + 34} fontSize="10" fontWeight={600} fill={GREEN}>Working (value-added)</text>
                            {ladderSegs}
                            <g transform={`translate(${ladderEndX + 28},${ladderY - 30})`}>
                                <rect width={216} height={66} rx={6} fill="#ffffff" stroke="#d1d1d1" />
                                <rect width={216} height={4} rx={2} fill={BLUE} />
                                <text x={10} y={22} fontSize="10" fill={INK}>Lead time: <tspan fontWeight={700}>{fmtDays(metrics.leadTimeDays)}</tspan></text>
                                <text x={10} y={38} fontSize="10" fill={INK}>Work time: <tspan fontWeight={700}>{fmtSeconds(metrics.totalProcessTimeSec)}</tspan></text>
                                <text x={10} y={54} fontSize="10" fill={INK}>Efficiency: <tspan fontWeight={700}>{metrics.pcePct.toFixed(1)}%</tspan></text>
                            </g>
                        </g>
                    )}
                </svg>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500 px-1">
                <span>▭ Process + data box</span>
                <span className="text-yellow-700">▲ Inventory / queue</span>
                <span>⇢ dashed = information flow</span>
                <span>→ solid = material/work flow</span>
                <span className="text-red-600">✷ Kaizen burst = bottleneck</span>
            </div>
        </div>
    );
}
