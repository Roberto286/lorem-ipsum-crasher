import { config, type ClassKey, type EnemyType, type LevelKey, type SpellKey } from '../config';
import type { CarriedSpell, RoleAbilities } from './gameSession';
import { t, type StringKey } from './i18n';

/** A heading over a text, with an optional sprite or colour swatch in the column left of it. */
export interface HelpBlock {
  heading?: string;
  text: string;
  icon?: { sprite: string } | { color: number };
}

export interface HelpPage {
  title: string;
  blocks: HelpBlock[];
}

const levelKeys = Object.keys(config.levels) as LevelKey[];
const classKeys = Object.keys(config.classes) as ClassKey[];
const enemyKeys = Object.keys(config.enemyTypes) as EnemyType[];
const dropNames: Record<CarriedSpell, StringKey> = {
  patch: 'dropPatch',
  firewall: 'dropFirewall',
  linter: 'dropLinter',
  cache: 'dropCache',
  coffee: 'dropCoffee',
};
const dropKeys = Object.keys(dropNames) as CarriedSpell[];

const spellKeys: Record<SpellKey, StringKey> = {
  patch: 'spellPatch',
  firewall: 'spellFirewall',
  linter: 'spellLinter',
  cache: 'spellCache',
  coffee: 'spellCoffee',
  freeze: 'spellFreeze',
  throttle: 'spellThrottle',
  truncate: 'spellTruncate',
  drop: 'spellDrop',
  pushback: 'spellPushback',
  descope: 'spellDescope',
  tab: 'spellTab',
  snippet: 'spellSnippet',
};

// The first passive field a role has picks the text.
const passiveKeys: [string, StringKey][] = [
  ['graceSeconds', 'passiveGrace'],
  ['slowSeconds', 'passiveSlow'],
  ['burnLetters', 'passiveBurn'],
  ['pushPixels', 'passivePush'],
];

/** The numbers of a config entry as text values, plus its speed multiplier as a percentage. */
function numbers(entry: object): Record<string, number> {
  const values: Record<string, number> = { maxLives: config.player.lives };
  for (const [name, value] of Object.entries(entry)) {
    if (typeof value !== 'number') continue;
    values[name] = value;
    if (name === 'speedScale' || name === 'slowFactor') values.speedPct = Math.round(value * 100);
  }
  return values;
}

const levelNames = (include: (level: LevelKey) => boolean) =>
  levelKeys
    .filter(include)
    .map((level) => t(level))
    .join(', ');

function basicsPage(): HelpPage {
  const { perfectWordsPerLevel, maxMultiplier } = config.combo;
  return {
    title: t('helpBasics'),
    blocks: [
      { heading: t('helpTypeHeading'), text: t('helpType') },
      { heading: t('helpLivesHeading'), text: t('helpLives', { lives: config.player.lives }) },
      {
        heading: t('helpComboHeading'),
        text: t('helpCombo', { words: perfectWordsPerLevel, max: maxMultiplier }),
      },
      {
        heading: t('helpKeysHeading'),
        text: t('helpKeys', { levels: levelNames((level) => config.levels[level].erasableTypos) }),
      },
    ],
  };
}

/** One short paragraph per level: only what differs from the plain rules. */
function levelText(level: LevelKey): string {
  const rules = config.levels[level];
  return [
    t('levelWords', { count: rules.maxWordsPerEnemy }),
    rules.wholePhrase ? t('levelPhrase') : '',
    t('levelSpawn', { pct: Math.round(rules.spawnIntervalScale * 100) }),
    rules.kamikazeChanceScale === 1
      ? ''
      : t('levelKamikaze', { pct: Math.round(rules.kamikazeChanceScale * 100) }),
    rules.erasableTypos
      ? t('levelErasable')
      : t('levelReset', { boost: config.enemy.typoSpeedBoost }),
  ]
    .filter((part) => part !== '')
    .join(' ');
}

function levelsPage(): HelpPage {
  return {
    title: t('helpLevels'),
    blocks: levelKeys.map((level) => ({ heading: t(level), text: levelText(level) })),
  };
}

const demonKeys: Record<EnemyType, StringKey> = {
  grunt: 'demonGrunt',
  kamikaze: 'demonKamikaze',
  tank: 'demonTank',
};

function demonText(type: EnemyType): string {
  const rules = config.enemyTypes[type];
  const values = { ...numbers(rules), ...numbers(config.difficulty.tankSpawnSeconds) };
  const text = t(demonKeys[type], values);
  if (type !== 'tank') return text;
  const phraseLevels = levelNames((level) => config.levels[level].wholePhrase);
  return `${text} ${t('demonPhrase', { levels: phraseLevels, words: config.enemyTypes.tank.phraseWords })}`;
}

function demonsPage(): HelpPage {
  return {
    title: t('helpDemons'),
    blocks: enemyKeys.map((type) => ({
      heading: t(type),
      text: demonText(type),
      icon: { sprite: config.enemyTypes[type].sprite },
    })),
  };
}

/** What a spell does, with its numbers read from config. */
export function spellText(spell: SpellKey): string {
  return t(spellKeys[spell], numbers(config.spells[spell]));
}

function rolePage(heroClass: ClassKey): HelpPage {
  const role: RoleAbilities = config.classes[heroClass];
  const blocks: HelpBlock[] = [];
  if (role.skill) {
    const { command, spell, cooldownSeconds } = role.skill;
    blocks.push({
      heading: t('skillCommand', { command }),
      text: `${spellText(spell)} ${t('skillRecharge', { seconds: cooldownSeconds })}`,
    });
  }
  if (role.ultimate) {
    const { command, spell, chargeWords, chargeSeconds } = role.ultimate;
    blocks.push({
      heading: t('ultimateCommand', { command }),
      text:
        `${spellText(spell)} ` +
        t('ultimateCharge', { words: chargeWords, seconds: chargeSeconds }),
    });
  }
  const passive = passiveKeys.find(([field]) => role.passive && field in role.passive);
  if (role.passive && passive) {
    blocks.push({ heading: t('passive'), text: t(passive[1], numbers(role.passive)) });
  }
  blocks.push({ text: t('roleCharge') });
  return { title: t(heroClass), blocks };
}

function dropsPage(): HelpPage {
  return {
    title: t('helpDrops'),
    blocks: [
      { text: t('dropsHow') },
      ...dropKeys.map((spell) => ({
        heading: t(dropNames[spell]),
        text: spellText(spell),
        icon: { color: config.spells[spell].color },
      })),
    ],
  };
}

/** Every page of the how-to-play screen, in order. */
export function helpPages(): HelpPage[] {
  return [basicsPage(), levelsPage(), demonsPage(), ...classKeys.map(rolePage), dropsPage()];
}
