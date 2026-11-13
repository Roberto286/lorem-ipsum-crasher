import { expect, it } from 'vitest';
import { t } from '../src/utils/i18n';

it('fills placeholders with the given values', () => {
  const text = t('score', { value: 120 });

  expect(text).toContain('120');
  expect(text).not.toContain('{');
});
