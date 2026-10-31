// `npm run balance`: plays 30 simulated minutes and prints the timeline and pacing.
import { test } from 'vitest';
import { formatTime, purchaseGaps, runBot } from './bot';

declare const process: { stdout: { write(text: string): void } };

const MINUTES = 30;

test('balance timeline', () => {
  const timeline = runBot(MINUTES);
  const lines = timeline.map((e) => `  ${formatTime(e.seconds)}  ${e.purchase ? '$' : ' '} ${e.what}`);
  const early = purchaseGaps(timeline, 20);
  const firstLine = timeline.find((e) => e.what.startsWith('built line'));
  process.stdout.write(
    [
      `Balance run: ${MINUTES} simulated minutes`,
      ...lines,
      '',
      `First 20 min: ${early.count} purchases, average gap ${early.average.toFixed(0)} s, longest ${early.longest.toFixed(0)} s`,
      `First factory line at ${firstLine ? formatTime(firstLine.seconds) : 'never'}`,
    ].join('\n'),
  );
});
