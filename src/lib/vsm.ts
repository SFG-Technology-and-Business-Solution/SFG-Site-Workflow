// Value Stream Mapping - types, lean calculations, sample data and exporters

export interface VsmProcessStep {
    id: string;
    name: string;
    operators: number;
    cycleTimeSec: number;      // touch time per unit (C/T)
    changeoverSec: number;     // changeover time (C/O)
    uptimePct: number;         // machine/process availability %
    yieldPct: number;          // first-pass yield %
    batchSize: number;         // typical transfer batch
    inventoryBefore: number;   // units queued/waiting before this step
    notes?: string;
}

export interface ValueStream {
    name: string;
    productFamily: string;
    customerName: string;
    supplierName: string;
    demandPerMonth: number;
    daysPerMonth: number;
    shiftsPerDay: number;
    shiftHours: number;
    breaksMinPerShift: number;
    customerOrderMethod: string;   // e.g. "Weekly EDI orders / 90-day forecast"
    supplierOrderMethod: string;   // e.g. "Weekly fax / daily email"
    scheduleMethod: string;        // e.g. "Daily schedule issued to each supervisor"
    deliveryFrequency: string;     // inbound from supplier
    shipmentFrequency: string;     // outbound to customer
    steps: VsmProcessStep[];
    // canvas position overrides keyed by node id (drag & drop)
    positions: Record<string, { x: number; y: number }>;
}

export interface StepMetrics {
    step: VsmProcessStep;
    effectiveCycleSec: number; // cycle time adjusted for uptime & yield
    waitDays: number;          // inventory before step expressed in days of demand
    isBottleneck: boolean;
    overTakt: boolean;
}

export interface VsmMetrics {
    availableSecPerDay: number;
    demandPerDay: number;
    taktSec: number;
    totalProcessTimeSec: number; // value-adding time
    totalWaitDays: number;
    leadTimeDays: number;
    pcePct: number;              // process cycle efficiency
    stepMetrics: StepMetrics[];
    bottleneckId: string | null;
}

export interface PlanAction {
    phase: string;
    title: string;
    detail: string;
    tool: string;       // lean tool / technique
    priority: 'High' | 'Medium' | 'Low';
    timeframe: string;  // e.g. "0-30 days"
}

// ============================================
// CALCULATIONS
// ============================================

export function calcMetrics(vs: ValueStream): VsmMetrics {
    const availableSecPerDay = Math.max(
        0,
        vs.shiftsPerDay * (vs.shiftHours * 3600 - vs.breaksMinPerShift * 60)
    );
    const demandPerDay = vs.daysPerMonth > 0 ? vs.demandPerMonth / vs.daysPerMonth : 0;
    const taktSec = demandPerDay > 0 ? availableSecPerDay / demandPerDay : 0;

    const stepMetrics: StepMetrics[] = vs.steps.map((step) => {
        const uptime = Math.min(100, Math.max(1, step.uptimePct)) / 100;
        const fpYield = Math.min(100, Math.max(1, step.yieldPct)) / 100;
        const effectiveCycleSec = step.cycleTimeSec / (uptime * fpYield);
        const waitDays = demandPerDay > 0 ? step.inventoryBefore / demandPerDay : 0;
        return { step, effectiveCycleSec, waitDays, isBottleneck: false, overTakt: taktSec > 0 && effectiveCycleSec > taktSec };
    });

    let bottleneckId: string | null = null;
    if (stepMetrics.length > 0) {
        const max = stepMetrics.reduce((a, b) => (b.effectiveCycleSec > a.effectiveCycleSec ? b : a));
        max.isBottleneck = true;
        bottleneckId = max.step.id;
    }

    const totalProcessTimeSec = vs.steps.reduce((sum, s) => sum + s.cycleTimeSec, 0);
    const totalWaitDays = stepMetrics.reduce((sum, m) => sum + m.waitDays, 0);
    const processTimeDays = availableSecPerDay > 0 ? totalProcessTimeSec / availableSecPerDay : 0;
    const leadTimeDays = totalWaitDays + processTimeDays;
    const pcePct = leadTimeDays > 0 ? (processTimeDays / leadTimeDays) * 100 : 0;

    return {
        availableSecPerDay,
        demandPerDay,
        taktSec,
        totalProcessTimeSec,
        totalWaitDays,
        leadTimeDays,
        pcePct,
        stepMetrics,
        bottleneckId,
    };
}

export function fmtSeconds(sec: number): string {
    if (!isFinite(sec) || sec <= 0) return '0 s';
    if (sec < 120) return `${Math.round(sec)} s`;
    if (sec < 7200) return `${(sec / 60).toFixed(1)} min`;
    return `${(sec / 3600).toFixed(1)} hr`;
}

export function fmtDays(days: number): string {
    if (!isFinite(days) || days <= 0) return '0 d';
    if (days < 0.1) return `${(days * 8).toFixed(1)} hr`;
    return `${days.toFixed(1)} d`;
}

// ============================================
// IMPROVEMENT PLAN GENERATOR
// ============================================

export function generateActionPlan(vs: ValueStream, m: VsmMetrics): PlanAction[] {
    const actions: PlanAction[] = [];

    actions.push(
        {
            phase: '1. Validate Current State',
            title: 'Walk the process (gemba walk)',
            detail: `Walk the "${vs.name || 'value stream'}" end-to-end with the team, following one unit of work from ${vs.supplierName || 'supplier'} to ${vs.customerName || 'customer'}. Confirm the recorded cycle times, queues and information flows match reality - time them with a stopwatch, do not rely on system reports.`,
            tool: 'Gemba walk',
            priority: 'High',
            timeframe: '0-30 days',
        },
        {
            phase: '1. Validate Current State',
            title: 'Review the map with the people who do the work',
            detail: 'Present the current-state map to operators and supervisors of every step. Correct anything that is wrong and capture frustrations - these usually point at the biggest wastes.',
            tool: 'Current-state review',
            priority: 'High',
            timeframe: '0-30 days',
        }
    );

    for (const sm of m.stepMetrics) {
        const s = sm.step;
        if (sm.isBottleneck && sm.overTakt) {
            actions.push({
                phase: '3. Kaizen Actions',
                title: `Relieve the bottleneck at "${s.name}"`,
                detail: `Effective cycle time ${fmtSeconds(sm.effectiveCycleSec)} exceeds takt ${fmtSeconds(m.taktSec)} - this step cannot keep up with customer demand. Rebalance work, offload tasks to adjacent steps, or add capacity (people/equipment) at this step first.`,
                tool: 'Line balancing / kaizen burst',
                priority: 'High',
                timeframe: '0-30 days',
            });
        }
        if (s.cycleTimeSec > 0 && s.changeoverSec > s.cycleTimeSec * 5) {
            actions.push({
                phase: '3. Kaizen Actions',
                title: `Cut changeover time at "${s.name}"`,
                detail: `Changeover of ${fmtSeconds(s.changeoverSec)} forces large batches (currently ${s.batchSize}). Run a SMED workshop: separate internal vs external setup tasks, convert internal to external, then streamline what remains. Target: halve it, then halve it again.`,
                tool: 'SMED (quick changeover)',
                priority: 'Medium',
                timeframe: '30-60 days',
            });
        }
        if (s.uptimePct < 85) {
            actions.push({
                phase: '3. Kaizen Actions',
                title: `Improve reliability at "${s.name}"`,
                detail: `Uptime of ${s.uptimePct}% is below the 85% threshold. Start daily operator care routines (clean/inspect/lubricate), log every stoppage with a reason code for two weeks, then attack the top three causes.`,
                tool: 'TPM (total productive maintenance)',
                priority: 'Medium',
                timeframe: '30-90 days',
            });
        }
        if (s.yieldPct < 95) {
            actions.push({
                phase: '3. Kaizen Actions',
                title: `Fix first-pass yield at "${s.name}"`,
                detail: `Yield of ${s.yieldPct}% means rework and scrap are inflating the true cycle time. Run a root-cause workshop (5 Whys / fishbone) on the top defect modes and add a poka-yoke (mistake-proofing) where possible.`,
                tool: 'Root cause analysis / poka-yoke',
                priority: 'High',
                timeframe: '0-60 days',
            });
        }
        if (sm.waitDays > 1) {
            actions.push({
                phase: '3. Kaizen Actions',
                title: `Reduce the queue in front of "${s.name}"`,
                detail: `${s.inventoryBefore} units (~${fmtDays(sm.waitDays)} of demand) are waiting before this step - pure non-value-added time. Set a maximum queue (FIFO lane or supermarket with kanban), and only release work when the queue drops below it.`,
                tool: 'Pull system / FIFO lane',
                priority: 'Medium',
                timeframe: '30-60 days',
            });
        }
    }

    if (m.pcePct > 0 && m.pcePct < 5) {
        actions.push({
            phase: '2. Design Future State',
            title: 'Attack lead time, not touch time',
            detail: `Process cycle efficiency is ${m.pcePct.toFixed(1)}% - over ${(100 - m.pcePct).toFixed(0)}% of the lead time is waiting. The future-state map should focus on linking steps into continuous flow and shrinking queues, not on making individual steps faster.`,
            tool: 'Future-state mapping',
            priority: 'High',
            timeframe: '0-30 days',
        });
    }

    actions.push(
        {
            phase: '2. Design Future State',
            title: 'Draw the future-state map',
            detail: `Using the current-state map, design the target: where can steps flow one-piece? Where is a pull signal needed instead of a schedule? Which single step should receive the schedule (the pacemaker)? Set a target lead time (current: ${fmtDays(m.leadTimeDays)}).`,
            tool: 'Future-state VSM',
            priority: 'High',
            timeframe: '0-30 days',
        },
        {
            phase: '4. Sustain',
            title: 'Stand up a weekly value-stream review',
            detail: 'Put lead time, PCE and the open kaizen actions on a visible board. Review weekly with the team, close actions, and re-measure the map every quarter.',
            tool: 'Visual management / leader standard work',
            priority: 'Medium',
            timeframe: 'Ongoing',
        },
        {
            phase: '4. Sustain',
            title: 'Re-map after improvements land',
            detail: 'Once the 90-day actions complete, re-collect the data and redraw the map. The new current state becomes the baseline for the next future state - VSM is a repeating cycle, not a one-off.',
            tool: 'PDCA cycle',
            priority: 'Low',
            timeframe: '90+ days',
        }
    );

    const phaseOrder = (a: PlanAction) => a.phase.charCodeAt(0);
    return actions.sort((a, b) => phaseOrder(a) - phaseOrder(b));
}

// ============================================
// EXPORTERS
// ============================================

function xmlEscape(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Build a draw.io (diagrams.net) file of the current-state map. */
export function toDrawioXml(vs: ValueStream, m: VsmMetrics): string {
    const cells: string[] = [];
    let id = 1;
    const next = () => `vsm${id++}`;

    const node = (label: string, x: number, y: number, w: number, h: number, style: string) => {
        const cellId = next();
        cells.push(
            `<mxCell id="${cellId}" value="${xmlEscape(label)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`
        );
        return cellId;
    };
    const edge = (from: string, to: string, label: string, dashed: boolean) => {
        cells.push(
            `<mxCell id="${next()}" value="${xmlEscape(label)}" style="endArrow=block;html=1;${dashed ? 'dashed=1;' : ''}fontSize=10;" edge="1" parent="1" source="${from}" target="${to}"><mxGeometry relative="1" as="geometry"/></mxCell>`
        );
    };

    const stepW = 160;
    const gap = 80;
    const rowY = 280;
    const factory = 'shape=mxgraph.lean_mapping.outside_sources;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;';
    const procStyle = 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#333333;verticalAlign=top;fontStyle=1;';
    const dataStyle = 'rounded=0;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontSize=10;align=left;spacingLeft=6;';
    const triStyle = 'triangle=1;direction=north;shape=triangle;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=10;verticalAlign=bottom;';

    const supplier = node(vs.supplierName || 'Supplier', 20, 40, 120, 70, factory);
    const control = node(`Production Control\n${vs.scheduleMethod || ''}`, 420, 30, 200, 60, procStyle);
    const customer = node(
        `${vs.customerName || 'Customer'}\n${Math.round(m.demandPerDay)} /day  Takt ${fmtSeconds(m.taktSec)}`,
        900, 40, 140, 80, factory
    );

    edge(customer, control, vs.customerOrderMethod || 'Orders', true);
    edge(control, supplier, vs.supplierOrderMethod || 'Orders', true);

    let x = 60;
    let prev = supplier;
    vs.steps.forEach((s, i) => {
        const sm = m.stepMetrics[i];
        if (s.inventoryBefore > 0) {
            const tri = node(`${s.inventoryBefore}\n${fmtDays(sm.waitDays)}`, x, rowY + 10, 50, 50, triStyle);
            edge(prev, tri, '', false);
            prev = tri;
            x += 50 + gap / 2;
        }
        const proc = node(`${s.name}\n(${s.operators} op)`, x, rowY, stepW, 50, procStyle);
        node(
            `C/T: ${fmtSeconds(s.cycleTimeSec)}\nC/O: ${fmtSeconds(s.changeoverSec)}\nUptime: ${s.uptimePct}%\nYield: ${s.yieldPct}%\nBatch: ${s.batchSize}`,
            x, rowY + 50, stepW, 90, dataStyle
        );
        edge(prev, proc, '', false);
        edge(control, proc, 'Schedule', true);
        prev = proc;
        x += stepW + gap;
    });
    edge(prev, customer, vs.shipmentFrequency || 'Ship', false);

    node(
        `Lead time: ${fmtDays(m.leadTimeDays)}   |   Process time: ${fmtSeconds(m.totalProcessTimeSec)}   |   PCE: ${m.pcePct.toFixed(1)}%`,
        60, rowY + 200, 700, 40,
        'text;html=1;fontSize=14;fontStyle=1;'
    );

    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram name="${xmlEscape(vs.name || 'Value Stream Map')}">
    <mxGraphModel dx="1000" dy="700" grid="1" gridSize="10" page="1" pageWidth="1169" pageHeight="826">
      <root>
        <mxCell id="0"/><mxCell id="1" parent="0"/>
        ${cells.join('\n        ')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/** CSV of the action plan - opens in Excel, importable to Microsoft Planner via Power Automate / copy-paste. */
export function planToCsv(actions: PlanAction[]): string {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
        'Task Name,Bucket,Priority,Timeframe,Lean Tool,Notes',
        ...actions.map((a) => [esc(a.title), esc(a.phase), a.priority, esc(a.timeframe), esc(a.tool), esc(a.detail)].join(',')),
    ].join('\n');
}

export function downloadFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// DEFAULTS & SAMPLE
// ============================================

export function emptyStep(): VsmProcessStep {
    return {
        id: `step-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
        name: '',
        operators: 1,
        cycleTimeSec: 60,
        changeoverSec: 0,
        uptimePct: 100,
        yieldPct: 100,
        batchSize: 1,
        inventoryBefore: 0,
    };
}

export function emptyStream(): ValueStream {
    return {
        name: '',
        productFamily: '',
        customerName: '',
        supplierName: '',
        demandPerMonth: 1000,
        daysPerMonth: 20,
        shiftsPerDay: 1,
        shiftHours: 8,
        breaksMinPerShift: 30,
        customerOrderMethod: '',
        supplierOrderMethod: '',
        scheduleMethod: '',
        deliveryFrequency: '',
        shipmentFrequency: '',
        steps: [],
        positions: {},
    };
}

export const SAMPLE_STREAM: ValueStream = {
    name: 'Work Order Processing',
    productFamily: 'Maintenance work orders',
    customerName: 'Client Operations',
    supplierName: 'Client Asset Team',
    demandPerMonth: 400,
    daysPerMonth: 20,
    shiftsPerDay: 1,
    shiftHours: 8,
    breaksMinPerShift: 30,
    customerOrderMethod: 'Weekly email orders / monthly forecast',
    supplierOrderMethod: 'Daily work request feed (email)',
    scheduleMethod: 'Weekly schedule issued to supervisors',
    deliveryFrequency: 'Daily',
    shipmentFrequency: 'Daily completion reports',
    steps: [
        {
            id: 'step-1', name: 'Receive & Log Request', operators: 1,
            cycleTimeSec: 300, changeoverSec: 0, uptimePct: 100, yieldPct: 90,
            batchSize: 1, inventoryBefore: 25, notes: 'Requests often missing info',
        },
        {
            id: 'step-2', name: 'Assess & Quote', operators: 2,
            cycleTimeSec: 1800, changeoverSec: 600, uptimePct: 95, yieldPct: 85,
            batchSize: 5, inventoryBefore: 40, notes: 'Batched for site visits',
        },
        {
            id: 'step-3', name: 'Schedule & Resource', operators: 1,
            cycleTimeSec: 600, changeoverSec: 0, uptimePct: 100, yieldPct: 95,
            batchSize: 10, inventoryBefore: 30,
        },
        {
            id: 'step-4', name: 'Execute Work', operators: 4,
            cycleTimeSec: 7200, changeoverSec: 1800, uptimePct: 80, yieldPct: 92,
            batchSize: 1, inventoryBefore: 15, notes: 'Access delays common',
        },
        {
            id: 'step-5', name: 'Close Out & Invoice', operators: 1,
            cycleTimeSec: 900, changeoverSec: 0, uptimePct: 100, yieldPct: 88,
            batchSize: 20, inventoryBefore: 35, notes: 'Invoiced in batches',
        },
    ],
    positions: {},
};
