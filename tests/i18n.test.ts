import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { format, t } from '../src/i18n';

describe('i18n', () => {
  it('looks up English strings', () => {
    expect(t('boot.error')).toBe(en['boot.error']);
  });

  it('fills placeholders and leaves unknown ones', () => {
    expect(format('{item} storage full ({n}/{max})', { item: 'Iron', n: 50 })).toBe('Iron storage full (50/{max})');
  });
});
