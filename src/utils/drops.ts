import type { CarriedSpell } from './gameSession';
import type { StringKey } from './i18n';

/** The string that names each carried spell: on a carrier's label and on the help page. */
export const dropNames: Record<CarriedSpell, StringKey> = {
  patch: 'dropPatch',
  firewall: 'dropFirewall',
  linter: 'dropLinter',
  cache: 'dropCache',
  coffee: 'dropCoffee',
};
