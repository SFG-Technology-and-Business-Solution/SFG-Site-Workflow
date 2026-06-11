// VSM Buddy AI helpers - thin client for /api/ai/vsm plus rule-based
// fallbacks so every feature still works when no AI key is configured.

import { ValueStream, VsmMetrics, VsmProcessStep, emptyStep, fmtDays, fmtSeconds } from './vsm';

// ============================================
// SERVER AI CLIENT
// ============================================

export async function aiAvailable(): Promise<boolean> {
    try {
        const res = await fetch('/api/ai/vsm');
        const data = await res.json();
        return !!data.configured;
    } catch {
        return false;
    }
}

async function aiCall(mode: 'draft' | 'sanity' | 'narrate' | 'sow', payload: string): Promise<string> {
    const res = await fetch('/api/ai/vsm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, payload }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'ai-error');
    return data.text as string;
}

/** Compact map data for prompts - only what the model needs. */
function mapJson(vs: ValueStream, m: VsmMetrics): string {
    return JSON.stringify({
        name: vs.name,
        demandPerMonth: vs.demandPerMonth,
        leadTimeDays: +m.leadTimeDays.toFixed(2),
        processTimeSec: m.totalProcessTimeSec,
        efficiencyPct: +m.pcePct.toFixed(1),
        steps: vs.steps.map((s, i) => ({
            order: i + 1,
            name: s.name,
            workSec: s.cycleTimeSec,
            queueBefore: s.inventoryBefore,
            queueDays: +(m.stepMetrics[i]?.waitDays ?? 0).toFixed(2),
            uptimePct: s.uptimePct,
            yieldPct: s.yieldPct,
            bottleneck: m.stepMetrics[i]?.isBottleneck ?? false,
            notes: s.notes || undefined,
        })),
    });
}

// ============================================
// 1. DRAFT A MAP FROM A DESCRIPTION
// ============================================

export interface DraftResult {
    name: string;
    steps: VsmProcessStep[];
}

export async function draftFromDescription(description: string): Promise<DraftResult> {
    const text = await aiCall('draft', description);
    // tolerate markdown fences or stray prose around the JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no-json');
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) throw new Error('no-steps');
    const steps: VsmProcessStep[] = parsed.steps.slice(0, 12).map((raw: Record<string, unknown>) => ({
        ...emptyStep(),
        name: String(raw.name || 'Step').slice(0, 60),
        cycleTimeSec: Math.max(0, Number(raw.cycleTimeSec) || 300),
        inventoryBefore: Math.max(0, Number(raw.inventoryBefore) || 0),
        operators: Math.max(1, Number(raw.operators) || 1),
        notes: raw.notes ? String(raw.notes).slice(0, 140) : undefined,
    }));
    return { name: String(parsed.name || '').slice(0, 60), steps };
}

// ============================================
// 2. SANITY CHECKS (rules always run; AI adds depth)
// ============================================

export interface SanityIssue {
    severity: 'warn' | 'info';
    message: string;
}

export function ruleBasedSanity(vs: ValueStream, m: VsmMetrics): SanityIssue[] {
    const issues: SanityIssue[] = [];
    if (vs.steps.length === 0) return issues;

    vs.steps.forEach((s, i) => {
        const label = s.name || `Step ${i + 1}`;
        if (!s.name.trim()) issues.push({ severity: 'warn', message: `Step ${i + 1} has no name yet - name every step so the map reads clearly.` });
        if (s.cycleTimeSec === 0) issues.push({ severity: 'warn', message: `"${label}" has zero work time - even a quick check takes some seconds.` });
        if (s.cycleTimeSec > 8 * 3600) issues.push({ severity: 'info', message: `"${label}" shows ${fmtSeconds(s.cycleTimeSec)} of work per unit - is that hands-on time, or does it include waiting?` });
        const wait = m.stepMetrics[i]?.waitDays ?? 0;
        if (wait > 5) issues.push({ severity: 'info', message: `${s.inventoryBefore} units (~${fmtDays(wait)}) queue before "${label}" - double-check the count; if it is right, this queue is a major target.` });
        if (s.yieldPct === 100 && /rework|error|wrong|missing|defect/i.test(s.notes || '')) {
            issues.push({ severity: 'warn', message: `"${label}" notes mention errors but yield is 100% - lower the yield to match reality.` });
        }
    });

    if (m.demandPerDay === 0) issues.push({ severity: 'warn', message: 'Demand is zero - enter how many units the customer needs per month, or takt time and queues cannot be calculated.' });
    if (m.pcePct > 40 && vs.steps.length > 1) issues.push({ severity: 'info', message: `Efficiency of ${m.pcePct.toFixed(0)}% is unusually high for a first map - most processes are under 15%. Make sure queues between steps were counted.` });
    return issues;
}

export async function aiSanity(vs: ValueStream, m: VsmMetrics): Promise<string> {
    return aiCall('sanity', mapJson(vs, m));
}

// ============================================
// 3. PLAIN-ENGLISH NARRATOR (template always works; AI version is richer)
// ============================================

export function templateNarrative(vs: ValueStream, m: VsmMetrics): string {
    const name = vs.name || 'This process';
    const bottleneck = m.stepMetrics.find((x) => x.isBottleneck);
    const maxQueue = m.stepMetrics.reduce(
        (a, b) => (b.waitDays > (a?.waitDays ?? 0) ? b : a),
        m.stepMetrics[0]
    );

    const p1 = `${name} runs through ${vs.steps.length} steps from ${vs.supplierName || 'the request coming in'} to ${vs.customerName || 'the customer'}. A typical unit of work takes ${fmtDays(m.leadTimeDays)} from start to finish, but only ${fmtSeconds(m.totalProcessTimeSec)} of that is actual work - an efficiency of ${m.pcePct.toFixed(1)}%. The rest of the time, the work is simply waiting for someone to pick it up.`;

    const p2 = maxQueue && maxQueue.waitDays > 0
        ? `The biggest wait is in front of "${maxQueue.step.name}", where about ${maxQueue.step.inventoryBefore} items (~${fmtDays(maxQueue.waitDays)} of work) sit in the queue.${bottleneck ? ` The slowest step is "${bottleneck.step.name}" - it sets the pace for the whole process, so nothing downstream can go faster than it.` : ''}`
        : bottleneck
            ? `The slowest step is "${bottleneck.step.name}" - it sets the pace for the whole process, so nothing downstream can go faster than it.`
            : 'Queues between steps have not been recorded yet, so the picture of where time is lost is incomplete.';

    const p3 = `The fastest way to shorten the end-to-end time is not to work faster - it is to cut the waiting. Start by ${maxQueue && maxQueue.waitDays > 0 ? `limiting the queue before "${maxQueue.step.name}"` : 'measuring the queues between steps'}${bottleneck ? ` and relieving the load on "${bottleneck.step.name}"` : ''}, then re-measure the map to prove the improvement.`;

    return [p1, p2, p3].join('\n\n');
}

export async function aiNarrative(vs: ValueStream, m: VsmMetrics): Promise<string> {
    return aiCall('narrate', mapJson(vs, m));
}

// ============================================
// 4. SOW POLISH
// ============================================

export async function aiPolishSow(draftText: string): Promise<string> {
    return aiCall('sow', draftText);
}
