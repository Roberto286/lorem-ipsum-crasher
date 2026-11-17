import { config } from '../config';
import type { CarriedSpell, Cast } from './gameSession';
import { t, type StringKey } from './i18n';

/** The string that names each carried spell: on the help page and in the pickup text. */
export const dropNames: Record<CarriedSpell, StringKey> = {
  patch: 'dropPatch',
  firewall: 'dropFirewall',
  linter: 'dropLinter',
  cache: 'dropCache',
  coffee: 'dropCoffee',
};

/**
 * What a drop that was just cast shows over the hero: a text and the drop's colour. Undefined for
 * a spell no demon carries. A patch at full lives says so instead of promising a life.
 */
export function pickupOf(cast: Cast): { text: string; color: number } | undefined {
  switch (cast.spell) {
    case 'patch':
      return {
        text: cast.healed > 0 ? t('pickupPatch', { lives: cast.healed }) : t('pickupPatchFull'),
        color: config.spells.patch.color,
      };
    case 'cache':
      return {
        text: t('pickupCache', { scoreScale: config.spells.cache.scoreScale }),
        color: config.spells.cache.color,
      };
    case 'firewall':
    case 'linter':
    case 'coffee':
      return { text: t(dropNames[cast.spell]), color: config.spells[cast.spell].color };
    default:
      return undefined;
  }
}
