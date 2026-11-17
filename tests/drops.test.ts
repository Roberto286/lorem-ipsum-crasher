import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { dropNames, pickupOf } from '../src/utils/drops';
import type { CarriedSpell, Cast } from '../src/utils/gameSession';
import { t } from '../src/utils/i18n';

const drops = Object.keys(dropNames) as CarriedSpell[];
const castOf = (spell: CarriedSpell): Cast =>
  spell === 'patch' ? { spell, healed: config.spells.patch.lives } : { spell };

describe('pickupOf', () => {
  it('shows every carried drop in its own colour', () => {
    for (const spell of drops) {
      const pickup = pickupOf(castOf(spell));

      expect(pickup?.text).toBeTruthy();
      expect(pickup?.text).not.toContain('{');
      expect(pickup?.color).toBe(config.spells[spell].color);
    }
  });

  it('names the drop for a firewall, a linter and a coffee', () => {
    for (const spell of ['firewall', 'linter', 'coffee'] as const) {
      expect(pickupOf({ spell })?.text).toBe(t(dropNames[spell]));
    }
  });

  it('counts the lives a patch gave back, and says so when they were already full', () => {
    expect(pickupOf({ spell: 'patch', healed: 1 })?.text).toContain('1');
    expect(pickupOf({ spell: 'patch', healed: 0 })?.text).not.toBe(
      pickupOf({ spell: 'patch', healed: 1 })?.text,
    );
    expect(pickupOf({ spell: 'patch', healed: 0 })?.text).not.toContain('0');
  });

  it('gives the cache factor', () => {
    expect(pickupOf({ spell: 'cache' })?.text).toContain(String(config.spells.cache.scoreScale));
  });

  it('shows nothing for a spell no demon carries', () => {
    expect(pickupOf({ spell: 'freeze' })).toBeUndefined();
    expect(pickupOf({ spell: 'tab' })).toBeUndefined();
  });
});
