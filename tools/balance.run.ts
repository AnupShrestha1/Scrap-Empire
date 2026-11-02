// `npm run balance`: plays 50 simulated minutes with the bot and prints the pacing report: business level
// times against their targets, gaps between purchases, income by source and where the money went.
// BALANCE_TIMELINE=1 also prints every event.
import { test } from 'vitest';
import { formatTime, PROFILES, purchaseGaps, runBot, type IncomeSource } from './bot';

declare const process: { stdout: { write(text: string): void }; env: Record<string, string | undefined> };

const MINUTES = 50;

/** When each business level should arrive (minutes), from docs/PROGRESSION.md §8. */
export const LEVEL_TARGETS: Readonly<Record<number, readonly [number, number]>> = {
  2: [1.5, 2.5],
  3: [3, 5],
  4: [7, 10],
  5: [12, 16],
  6: [18, 24],
  7: [26, 34],
  8: [36, 46],
};

/** Longest wait between purchases allowed in each phase (seconds). */
export const GAP_TARGETS: readonly { from: number; to: number; longest: number }[] = [
  { from: 0, to: 10, longest: 90 },
  { from: 10, to: 30, longest: 150 },
  { from: 30, to: 50, longest: 240 },
];

const pad = (s: string | number, n: number) => String(s).padStart(n);

test('balance report', () => {
  const { timeline, stats } = runBot(MINUTES);
  const out: string[] = [`Balance run: ${MINUTES} simulated minutes`, ''];

  out.push('Business levels      reached   target       ');
  for (const [lvl, [lo, hi]] of Object.entries(LEVEL_TARGETS)) {
    const at = stats.levelAt[Number(lvl)];
    const min = at === undefined ? undefined : at / 60;
    const verdict = min === undefined ? 'MISSED' : min < lo ? 'early' : min > hi ? 'LATE' : 'ok';
    out.push(`  Lv ${lvl}               ${pad(at === undefined ? '--:--' : formatTime(at), 7)}   ${pad(lo, 4)}–${hi} min   ${verdict}`);
  }

  out.push('', 'Purchase gaps        count   average   longest   target');
  for (const g of GAP_TARGETS) {
    const r = purchaseGaps(timeline, g.to, g.from);
    out.push(
      `  ${pad(g.from, 2)}–${pad(g.to, 2)} min          ${pad(r.count, 3)}   ${pad(r.average.toFixed(0), 5)} s   ${pad(r.longest.toFixed(0), 5)} s   ≤${g.longest} s ${r.longest <= g.longest ? 'ok' : 'LONG'}`,
    );
  }

  const sources: IncomeSource[] = ['metal', 'product', 'order', 'staffSales', 'objective', 'chest'];
  out.push('', `Income per ${stats.windowS / 60} min     ${sources.map((k) => pad(k, 10)).join('')}     total   $/min`);
  stats.income.forEach((w, i) => {
    const total = sources.reduce((a, k) => a + w[k], 0);
    const from = (i * stats.windowS) / 60;
    out.push(`  ${pad(from, 2)}–${pad(from + stats.windowS / 60, 2)} min       ${sources.map((k) => pad(w[k], 10)).join('')}  ${pad(total, 8)}  ${pad(Math.round(total / (stats.windowS / 60)), 6)}`);
  });

  const flows = ['delivered', 'shredded', 'made', 'filled', 'expired'] as const;
  out.push('', `Flow per ${stats.windowS / 60} min       ${flows.map((k) => pad(k, 10)).join('')}`);
  stats.flow.forEach((w, i) => {
    const from = (i * stats.windowS) / 60;
    out.push(`  ${pad(from, 2)}–${pad(from + stats.windowS / 60, 2)} min       ${flows.map((k) => pad(w[k], 10)).join('')}`);
  });

  const spent = Object.entries(stats.spent).sort((a, b) => b[1] - a[1]);
  const totalSpent = spent.reduce((a, [, v]) => a + v, 0);
  out.push('', `Spent $${totalSpent}: ${spent.map(([k, v]) => `${k} $${v}`).join(', ')}`);

  // The same game played casually (slower walking, a pause before each decision): it should stay close.
  const casual = runBot(MINUTES, stats.windowS, PROFILES.casual).stats;
  out.push(
    '',
    `Casual player levels: ${Object.keys(LEVEL_TARGETS)
      .map((lvl) => `Lv ${lvl} ${casual.levelAt[Number(lvl)] === undefined ? '--:--' : formatTime(casual.levelAt[Number(lvl)]!)}`)
      .join(', ')}`,
  );

  const firstLine = timeline.find((e) => e.what.startsWith('built line'));
  out.push(`First factory line at ${firstLine ? formatTime(firstLine.seconds) : 'never'}`);

  if (process.env.BALANCE_TIMELINE) {
    out.push('', 'Timeline:', ...timeline.map((e) => `  ${formatTime(e.seconds)}  ${e.purchase ? '$' : ' '} ${e.what}`));
  }
  process.stdout.write(out.join('\n') + '\n');
});
