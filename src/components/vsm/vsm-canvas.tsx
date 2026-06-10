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

const STEP_W = 150;
const STEP_GAP = 70;
const DATA_H = 78;
const PROC_H = 46;
const ROW_Y = 290;
const TOP_Y = 50;

interface NodePos {
    x: number;
    y: number;
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
    return (
        <g
            transform={`translate(${p.x},${p.y})`}
            onPointerDown={onPointerDown}
            className="cursor-grab"
            style={{ touchAction: 'none' }}
        >
            <path
                d={`M0,20 L${w / 3},6 L${w / 3},20 L${(2 * w) / 3},6 L${(2 * w) / 3},20 L${w},6 L${w},58 L0,58 Z`}
                fill="#eff6ff"
                stroke={selected ? '#2563eb' : '#475569'}
                strokeWidth={selected ? 2.5 : 1.5}
            />
            <text x={w / 2} y={38} textAnchor="middle" fontSize="12" fontWeight={600} fill="#1e293b">
                {label}
            </text>
            {sub && (
                <text x={w / 2} y={52} textAnchor="middle" fontSize="9" fill="#64748b">
                    {sub}
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
                    stroke="#64748b"
                    strokeWidth={1.3}
                    strokeDasharray="6 4"
                    markerEnd="url(#arrow-info)"
                />
                {label && (
                    <text x={mx} y={my + 12} textAnchor="middle" fontSize="9" fill="#64748b">
                        {label}
                    </text>
                )}
            </g>
        );
    };

    // Timeline ladder geometry: order steps by current x so dragging keeps the ladder sane
    const orderedSteps = [...steps].sort((a, b) => pos(a.id).x - pos(b.id).x);
    const ladderY = 480;
    const ladderSegW = Math.max(60, (width - 220) / Math.max(1, n * 2));
    let ladderX = 110;
    const ladderSegs: React.ReactNode[] = [];
    orderedSteps.forEach((s, i) => {
        const sm = metrics.stepMetrics.find((m) => m.step.id === s.id)!;
        // wait segment (upper rail = non-value-added)
        ladderSegs.push(
            <g key={`w-${s.id}`}>
                <path
                    d={`M${ladderX},${ladderY - 22} H${ladderX + ladderSegW} V${ladderY}`}
                    fill="none" stroke="#dc2626" strokeWidth={1.6}
                />
                <text x={ladderX + ladderSegW / 2} y={ladderY - 28} textAnchor="middle" fontSize="10" fill="#dc2626" fontWeight={600}>
                    {fmtDays(sm.waitDays)}
                </text>
            </g>
        );
        ladderX += ladderSegW;
        // cycle segment (lower rail = value-added)
        ladderSegs.push(
            <g key={`c-${s.id}`}>
                <path
                    d={`M${ladderX},${ladderY} H${ladderX + ladderSegW} ${i < orderedSteps.length - 1 ? `V${ladderY - 22}` : ''}`}
                    fill="none" stroke="#16a34a" strokeWidth={1.6}
                />
                <text x={ladderX + ladderSegW / 2} y={ladderY + 16} textAnchor="middle" fontSize="10" fill="#16a34a" fontWeight={600}>
                    {fmtSeconds(s.cycleTimeSec)}
                </text>
            </g>
        );
        ladderX += ladderSegW;
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
                    style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', userSelect: 'none' }}
                >
                    <defs>
                        <marker id="arrow-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                            <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
                        </marker>
                        <marker id="arrow-info" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                            <path d="M0,0 L10,5 L0,10 Z" fill="#64748b" />
                        </marker>
                    </defs>

                    <rect width={width} height={height} fill="#fafafa" />
                    <text x={20} y={26} fontSize="15" fontWeight={700} fill="#0f172a">
                        {stream.name || 'Value Stream Map'}
                        {stream.productFamily ? `  -  ${stream.productFamily}` : ''}
                        <tspan fontSize="11" fontWeight={500} fill={stream.mapType === 'future' ? '#7c3aed' : '#64748b'}>
                            {'   '}{stream.mapType === 'future' ? 'FUTURE STATE' : 'CURRENT STATE'}
                            {stream.client ? `  ·  ${stream.client}` : ''}
                        </tspan>
                    </text>
                    <text x={width - 16} y={height - 12} textAnchor="end" fontSize="10" fill="#94a3b8">
                        Made with VSM Buddy · AI² Solutions
                    </text>

                    {/* Information flow (dashed) */}
                    {infoArrow(customerP.x + 10, customerP.y + 30, controlP.x + 220, controlP.y + 28, stream.customerOrderMethod || 'Orders / forecast', 'cust-pc')}
                    {infoArrow(controlP.x, controlP.y + 28, supplierP.x + 130, supplierP.y + 30, stream.supplierOrderMethod || 'Orders', 'pc-sup')}
                    {steps.map((s) => {
                        const sp = pos(s.id);
                        return infoArrow(controlP.x + 110, controlP.y + 56, sp.x + STEP_W / 2, sp.y - 4, '', `pc-${s.id}`);
                    })}

                    {/* Material flow arrows: supplier -> steps (in x order) -> customer */}
                    {(() => {
                        const chain: { x: number; y: number }[] = [
                            { x: supplierP.x + 70, y: supplierP.y + 58 },
                            ...orderedSteps.map((s) => {
                                const p = pos(s.id);
                                return { x: p.x + STEP_W / 2, y: p.y + (PROC_H + DATA_H) / 2 };
                            }),
                            { x: customerP.x + 70, y: customerP.y + 58 },
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
                                    stroke="#334155"
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
                        <rect width={220} height={56} fill="#f8fafc" stroke={selected === 'control' ? '#2563eb' : '#475569'} strokeWidth={selected === 'control' ? 2.5 : 1.5} />
                        <text x={110} y={22} textAnchor="middle" fontSize="12" fontWeight={600} fill="#1e293b">Production Control</text>
                        <text x={110} y={40} textAnchor="middle" fontSize="9" fill="#64748b">{stream.scheduleMethod || 'Scheduling'}</text>
                    </g>

                    {/* Process steps with data boxes, inventory triangles & kaizen bursts */}
                    {steps.map((s) => {
                        const sm = metrics.stepMetrics.find((m) => m.step.id === s.id)!;
                        const p = pos(s.id);
                        const isSel = selected === s.id;
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
                                        <path d="M0,40 L20,4 L40,40 Z" fill="#fef9c3" stroke="#ca8a04" strokeWidth={1.5} />
                                        <text x={20} y={32} textAnchor="middle" fontSize="9" fontWeight={700} fill="#854d0e">{s.inventoryBefore}</text>
                                        <text x={20} y={54} textAnchor="middle" fontSize="9" fill="#854d0e">{fmtDays(sm.waitDays)}</text>
                                    </g>
                                )}

                                {/* process box */}
                                <rect width={STEP_W} height={PROC_H} fill="#ffffff" stroke={isSel ? '#2563eb' : '#334155'} strokeWidth={isSel ? 2.5 : 1.5} />
                                <text x={STEP_W / 2} y={20} textAnchor="middle" fontSize="11.5" fontWeight={700} fill="#0f172a">
                                    {s.name || 'Process'}
                                </text>
                                <text x={STEP_W / 2} y={36} textAnchor="middle" fontSize="9" fill="#64748b">
                                    {s.operators} operator{s.operators === 1 ? '' : 's'}
                                </text>

                                {/* data box */}
                                <rect y={PROC_H} width={STEP_W} height={DATA_H} fill="#f8fafc" stroke="#94a3b8" strokeWidth={1} />
                                {[
                                    `C/T: ${fmtSeconds(s.cycleTimeSec)}`,
                                    `C/O: ${fmtSeconds(s.changeoverSec)}`,
                                    `Uptime: ${s.uptimePct}%  Yield: ${s.yieldPct}%`,
                                    `Batch: ${s.batchSize}`,
                                ].map((line, li) => (
                                    <text key={li} x={8} y={PROC_H + 16 + li * 16} fontSize="9.5" fill="#334155">
                                        {line}
                                    </text>
                                ))}

                                {/* kaizen burst on the bottleneck */}
                                {sm.isBottleneck && (
                                    <g transform={`translate(${STEP_W - 14},-14)`}>
                                        <path
                                            d="M0,-16 L5,-5 L17,-8 L9,1 L18,9 L6,8 L4,20 L-3,9 L-15,13 L-8,2 L-18,-5 L-6,-6 Z"
                                            fill="#fef2f2" stroke="#dc2626" strokeWidth={1.4}
                                        />
                                        <text y={4} textAnchor="middle" fontSize="7.5" fontWeight={700} fill="#dc2626">KAIZEN</text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {/* Timeline ladder */}
                    {n > 0 && (
                        <g>
                            <text x={110} y={ladderY - 46} fontSize="10" fontWeight={600} fill="#dc2626">Waiting (non-value-added)</text>
                            <text x={110} y={ladderY + 34} fontSize="10" fontWeight={600} fill="#16a34a">Processing (value-added)</text>
                            {ladderSegs}
                            <g transform={`translate(${ladderX + 24},${ladderY - 30})`}>
                                <rect width={210} height={62} rx={6} fill="#ffffff" stroke="#cbd5e1" />
                                <text x={10} y={18} fontSize="10" fill="#334155">Lead time: <tspan fontWeight={700}>{fmtDays(metrics.leadTimeDays)}</tspan></text>
                                <text x={10} y={34} fontSize="10" fill="#334155">Process time: <tspan fontWeight={700}>{fmtSeconds(metrics.totalProcessTimeSec)}</tspan></text>
                                <text x={10} y={50} fontSize="10" fill="#334155">Cycle efficiency: <tspan fontWeight={700}>{metrics.pcePct.toFixed(1)}%</tspan></text>
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
