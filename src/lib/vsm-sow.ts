// Scope of Works generator - turns a completed value stream map plus a short
// questionnaire into a decision-ready proposal for automating the process
// with Microsoft 365 / Power Platform tools. Pure rules, no AI required;
// the AI polish in vsm-ai.ts only improves the prose.

import { ValueStream, VsmMetrics, fmtDays, fmtSeconds } from './vsm';

// ============================================
// TYPES
// ============================================

export interface SowAnswers {
    systemsUsed: string;      // what software/systems touch this process today
    runsPerWeek: number;      // how many times the process runs per week
    peopleInvolved: number;   // headcount across the process
    painPointStepId: string;  // step the team finds most painful
    compliance: string;       // records/sign-offs that must be kept (optional)
}

export function emptyAnswers(): SowAnswers {
    return { systemsUsed: '', runsPerWeek: 20, peopleInvolved: 3, painPointStepId: '', compliance: '' };
}

export interface SowRecommendation {
    stepName: string;
    problem: string;
    recommendation: string;
    tools: string[];
    effort: 'Small' | 'Medium' | 'Large';
}

export interface SowDocument {
    title: string;
    preparedFor: string;
    date: string;
    background: string;
    currentState: string[];
    objectives: string[];
    recommendations: SowRecommendation[];
    pilot: string;
    benefits: string[];
    licensing: string[];
    assumptions: string[];
    nextSteps: string[];
}

// ============================================
// STEP CLASSIFIER
// ============================================

type StepKind = 'intake' | 'approval' | 'scheduling' | 'admin' | 'reporting' | 'execution' | 'generic';

function classify(name: string, notes: string): StepKind {
    const t = `${name} ${notes}`.toLowerCase();
    if (/receive|log|intake|request|enquir|email|register|capture|order/.test(t)) return 'intake';
    if (/approv|review|assess|check|inspect|sign|authoris|authorize|verify|quote/.test(t)) return 'approval';
    if (/schedul|assign|resourc|plan|book|dispatch|allocat/.test(t)) return 'scheduling';
    if (/invoice|bill|payment|close|closeout|close-out|file|document|paperwork|data entry|enter/.test(t)) return 'admin';
    if (/report|dashboard|kpi|metric/.test(t)) return 'reporting';
    if (/execute|work|build|install|repair|deliver|manufactur|weld|paint|fabricat|transport/.test(t)) return 'execution';
    return 'generic';
}

const KIND_RULES: Record<StepKind, { problem: string; rec: string; tools: string[]; effort: SowRecommendation['effort'] }> = {
    intake: {
        problem: 'Work arrives unstructured (email, phone, paper) and someone re-types it, which causes delays, missing information and no visibility of the queue.',
        rec: 'Replace manual logging with a Microsoft Form (or shared mailbox rule) that feeds a Power Automate flow, creating a tracked item in a Microsoft List automatically - with required fields so requests arrive complete.',
        tools: ['Microsoft Forms', 'Power Automate', 'Microsoft Lists'],
        effort: 'Small',
    },
    approval: {
        problem: 'Items wait for a person to review or sign off, and nothing chases the approver - waiting time dwarfs the actual review time.',
        rec: 'Route each item through Approvals in Microsoft Teams via Power Automate: the approver gets a one-click approve/reject card on their phone, automatic reminders escalate after a set time, and the decision is logged.',
        tools: ['Power Automate', 'Teams Approvals'],
        effort: 'Small',
    },
    scheduling: {
        problem: 'Scheduling and assignment are done by hand, so work sits unassigned and people are double-booked or idle.',
        rec: 'Use Power Automate to create assigned Planner tasks (with due dates) the moment upstream work completes, and surface the schedule in a shared Teams channel calendar so everyone sees the same plan.',
        tools: ['Power Automate', 'Microsoft Planner', 'Outlook/Teams calendar'],
        effort: 'Medium',
    },
    admin: {
        problem: 'Closing out, invoicing or paperwork is batched up because it is tedious, which delays cash and buries errors until late.',
        rec: 'Generate the documents automatically: a Power Automate flow fills a Word template from the tracked data and routes it for sign-off, removing the re-typing and letting items close one at a time instead of in batches.',
        tools: ['Power Automate', 'Word templates', 'Microsoft Lists'],
        effort: 'Medium',
    },
    reporting: {
        problem: 'Reports are assembled by hand from several sources, so they are late, occasionally wrong, and consume skilled time.',
        rec: 'Point Power BI at the Microsoft Lists data so the report builds itself and is always current; share it as a tab in Teams.',
        tools: ['Power BI', 'Microsoft Lists'],
        effort: 'Medium',
    },
    execution: {
        problem: 'The physical work itself cannot be automated with software - but the paperwork, status updates and waiting around it can.',
        rec: 'Give the field team a phone-friendly checklist (Microsoft Lists or a simple Power App) to capture completion, photos and issues on the spot - status flows back automatically, so no end-of-day data entry and no chasing for updates.',
        tools: ['Microsoft Lists', 'Power Apps (simple)', 'Power Automate'],
        effort: 'Large',
    },
    generic: {
        problem: 'The step is tracked informally, so its queue and status are invisible until someone asks.',
        rec: 'Track the step as a status column in the shared Microsoft List with automatic notifications on handover, making the queue visible and hand-offs instant.',
        tools: ['Microsoft Lists', 'Power Automate'],
        effort: 'Small',
    },
};

// ============================================
// GENERATOR
// ============================================

export function generateSow(vs: ValueStream, m: VsmMetrics, a: SowAnswers): SowDocument {
    const name = vs.name || 'the process';
    const recommendations: SowRecommendation[] = [];

    vs.steps.forEach((s, i) => {
        const sm = m.stepMetrics[i];
        const kind = classify(s.name, s.notes || '');
        const rule = KIND_RULES[kind];
        let problem = rule.problem;
        if (sm && sm.waitDays > 0.5) {
            problem += ` Right now about ${s.inventoryBefore} items (~${fmtDays(sm.waitDays)}) are queued in front of this step.`;
        }
        if (s.yieldPct < 95) {
            problem += ` ${100 - s.yieldPct}% of items need rework here.`;
        }
        let rec = rule.rec;
        if (s.yieldPct < 95 && (kind === 'intake' || kind === 'admin' || kind === 'generic')) {
            rec += ' Add required fields and validation at the point of entry so incomplete or incorrect items cannot enter the queue (digital mistake-proofing).';
        }
        recommendations.push({
            stepName: s.name || `Step ${i + 1}`,
            problem,
            recommendation: rec,
            tools: rule.tools,
            effort: rule.effort,
        });
    });

    // pilot: the painful step if nominated, else biggest queue, else bottleneck
    const painStep = vs.steps.find((s) => s.id === a.painPointStepId);
    const maxQueue = [...m.stepMetrics].sort((x, y) => y.waitDays - x.waitDays)[0];
    const bottleneck = m.stepMetrics.find((x) => x.isBottleneck);
    const pilotStep = painStep || (maxQueue && maxQueue.waitDays > 0 ? maxQueue.step : bottleneck?.step) || vs.steps[0];
    const pilotRec = recommendations.find((r) => r.stepName === (pilotStep?.name || ''));

    // indicative benefit: automation typically removes 30-60% of waiting on automated handovers
    const adminSecPerRun = vs.steps
        .filter((s) => ['intake', 'approval', 'admin', 'generic', 'scheduling'].includes(classify(s.name, s.notes || '')))
        .reduce((sum, s) => sum + s.cycleTimeSec, 0);
    const hoursSavedPerWeek = a.runsPerWeek > 0 ? ((adminSecPerRun * 0.5) * a.runsPerWeek) / 3600 : 0;

    return {
        title: `Scope of Works - Automating "${vs.name || 'Untitled process'}" with Microsoft 365`,
        preparedFor: vs.client || 'Internal',
        date: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
        background: `This Scope of Works was generated from a value stream map of "${name}"${vs.area ? ` in ${vs.area}` : ''}. The map records ${vs.steps.length} steps from ${vs.supplierName || 'request'} to ${vs.customerName || 'customer'}, running approximately ${a.runsPerWeek} times per week with ${a.peopleInvolved} people involved.${a.systemsUsed ? ` Systems currently touching the process: ${a.systemsUsed}.` : ''} The purpose of this document is to support a decision on which parts of the process to automate using only Microsoft 365 tools the organisation already licenses.`,
        currentState: [
            `End-to-end lead time: ${fmtDays(m.leadTimeDays)} per unit of work.`,
            `Actual hands-on work: ${fmtSeconds(m.totalProcessTimeSec)} per unit - a process cycle efficiency of ${m.pcePct.toFixed(1)}%. The remaining ${(100 - m.pcePct).toFixed(0)}% of the lead time is waiting.`,
            bottleneck ? `Pacing constraint (bottleneck): "${bottleneck.step.name}".` : 'No single bottleneck identified.',
            maxQueue && maxQueue.waitDays > 0 ? `Largest queue: ${maxQueue.step.inventoryBefore} items (~${fmtDays(maxQueue.waitDays)}) before "${maxQueue.step.name}".` : 'Queue sizes between steps were not significant or not recorded.',
            a.compliance ? `Compliance / record-keeping requirements: ${a.compliance}.` : '',
        ].filter(Boolean),
        objectives: [
            'Cut waiting time between steps - the dominant waste - by automating hand-offs, notifications and approvals.',
            'Eliminate re-typing and incomplete information at the point work enters the process.',
            'Make every item’s status visible without phone calls or status meetings.',
            'Stay entirely within Microsoft 365 tools already licensed, avoiding new software purchases.',
        ],
        recommendations,
        pilot: pilotStep
            ? `Start with "${pilotStep.name}"${painStep ? ' (nominated by the team as the most painful step)' : maxQueue && maxQueue.waitDays > 0 && pilotStep.id === maxQueue.step.id ? ' (it has the largest queue)' : ''}. ${pilotRec ? pilotRec.recommendation : ''} Run the pilot for 2-4 weeks, measure the queue and lead time before and after, then extend the same pattern to the neighbouring steps.`
            : 'Add process steps to the map to receive a pilot recommendation.',
        benefits: [
            hoursSavedPerWeek > 0.5
                ? `Indicative time recovery: roughly ${hoursSavedPerWeek.toFixed(0)} staff-hours per week (assumes automation halves the manual handling on administrative steps at ${a.runsPerWeek} runs/week). Validate during the pilot.`
                : 'Time recovery to be quantified during the pilot.',
            'Faster lead time: automated hand-offs remove queue time, which the map shows is the bulk of the end-to-end delay.',
            'Fewer errors: required fields and validation stop incomplete work entering the process.',
            'Visibility: a live view of every item’s status in Teams replaces chasing and status meetings.',
        ],
        licensing: [
            'Microsoft Forms, Lists, Planner, Teams and standard Power Automate flows are included in Microsoft 365 Business/Enterprise licences - no extra cost.',
            'Power BI Pro (approx. AU$15/user/month) is needed only for the people who view dashboards, and only if the reporting recommendation is adopted.',
            'A simple Power App for field capture may require Power Apps licensing depending on design; the pilot can use Microsoft Lists’ built-in mobile forms at no extra cost.',
        ],
        assumptions: [
            'The organisation has Microsoft 365 with Teams and SharePoint already deployed.',
            'Process knowledge holders are available for short workshops during build and pilot.',
            'Figures in this document come from the value stream map and questionnaire; they are estimates for decision-making, to be validated in the pilot.',
        ],
        nextSteps: [
            'Review this scope with the process owner and correct anything the map got wrong.',
            'Approve the pilot step and nominate a pilot owner.',
            'Build the pilot (typically 1-2 weeks of part-time effort for the patterns above).',
            'Measure for 2-4 weeks, compare against the baseline in this document, then decide on rollout.',
        ],
    };
}

// ============================================
// EXPORT (plain text for AI polish; HTML for Word/print)
// ============================================

export function sowToText(d: SowDocument): string {
    const lines: string[] = [
        d.title, `Prepared for: ${d.preparedFor}  |  Date: ${d.date}`, '',
        'BACKGROUND', d.background, '',
        'CURRENT STATE (FROM THE MAP)', ...d.currentState.map((s) => `- ${s}`), '',
        'OBJECTIVES', ...d.objectives.map((s) => `- ${s}`), '',
        'RECOMMENDED AUTOMATION, STEP BY STEP',
    ];
    d.recommendations.forEach((r, i) => {
        lines.push(`${i + 1}. ${r.stepName} [effort: ${r.effort}]`, `   Problem: ${r.problem}`, `   Recommendation: ${r.recommendation}`, `   Microsoft tools: ${r.tools.join(', ')}`);
    });
    lines.push('', 'SUGGESTED PILOT', d.pilot, '', 'EXPECTED BENEFITS', ...d.benefits.map((s) => `- ${s}`), '', 'LICENSING NOTES', ...d.licensing.map((s) => `- ${s}`), '', 'ASSUMPTIONS', ...d.assumptions.map((s) => `- ${s}`), '', 'NEXT STEPS', ...d.nextSteps.map((s, i) => `${i + 1}. ${s}`));
    return lines.join('\n');
}

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Branded, print-ready HTML - also opens cleanly in Microsoft Word as a .doc. */
export function sowToHtml(d: SowDocument): string {
    const li = (items: string[]) => items.map((s) => `<li>${esc(s)}</li>`).join('');
    const recRows = d.recommendations
        .map(
            (r, i) => `<tr>
<td><b>${i + 1}. ${esc(r.stepName)}</b><br/><span class="muted">Effort: ${r.effort}</span></td>
<td>${esc(r.problem)}</td>
<td>${esc(r.recommendation)}<br/><span class="tools">${esc(r.tools.join(' · '))}</span></td>
</tr>`
        )
        .join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(d.title)}</title>
<style>
body{font-family:"Segoe UI",system-ui,Arial,sans-serif;color:#242424;max-width:860px;margin:32px auto;padding:0 24px;line-height:1.5;font-size:14px}
h1{color:#0a2e4d;font-size:24px;margin-bottom:2px}
h2{color:#0078d4;font-size:16px;margin-top:28px;border-bottom:2px solid #deecf9;padding-bottom:4px}
.meta{color:#616161;font-size:13px;margin-bottom:18px}
table{border-collapse:collapse;width:100%;font-size:13px}
td,th{border:1px solid #e5e5e5;padding:8px;vertical-align:top;text-align:left}
th{background:#eff6fc;color:#0a2e4d}
.muted{color:#8a8a8a;font-size:12px}
.tools{color:#005a9e;font-size:12px;font-weight:600}
li{margin-bottom:5px}
.brand{display:flex;align-items:center;gap:8px;margin-bottom:18px}
.mark{width:26px;height:26px;border-radius:5px;background:#0078d4;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
@media print{body{margin:0}}
</style></head><body>
<div class="brand"><span class="mark">V</span><b>VSM Buddy</b><span class="muted">· Value Stream Mapping</span></div>
<h1>${esc(d.title)}</h1>
<div class="meta">Prepared for: <b>${esc(d.preparedFor)}</b> &nbsp;|&nbsp; Date: ${esc(d.date)} &nbsp;|&nbsp; Status: Draft for review</div>
<h2>Background</h2><p>${esc(d.background)}</p>
<h2>Current state (from the map)</h2><ul>${li(d.currentState)}</ul>
<h2>Objectives</h2><ul>${li(d.objectives)}</ul>
<h2>Recommended automation, step by step</h2>
<table><tr><th style="width:18%">Process step</th><th style="width:38%">Problem today</th><th>Recommended Microsoft automation</th></tr>${recRows}</table>
<h2>Suggested pilot</h2><p>${esc(d.pilot)}</p>
<h2>Expected benefits</h2><ul>${li(d.benefits)}</ul>
<h2>Licensing notes</h2><ul>${li(d.licensing)}</ul>
<h2>Assumptions</h2><ul>${li(d.assumptions)}</ul>
<h2>Next steps</h2><ol>${li(d.nextSteps)}</ol>
</body></html>`;
}
