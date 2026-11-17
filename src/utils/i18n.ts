import { config } from '../config';

const en = {
  title: 'LOREM IPSUM CRASHER',
  intro1:
    'Lorem ipsum dolor sit amet. For centuries everyone took it for filler text. ' +
    'It is a summoning spell.',
  intro2:
    'Developers pasted it into every mockup, template and landing page. ' +
    'Billions of invocations.',
  intro3: 'The demons are awake. And they are done being placeholders.',
  intro4: 'One dev is still online. Type their names to banish them.',
  introHint: 'ENTER: NEXT   ESC: SKIP',
  howToPlay:
    'Type the demons away before they reach you.\n' + 'Type a role command when it lights up.',
  mobileUnsupported: 'This game needs a real keyboard.\n\nPlay it on a desktop computer.',
  start: 'PRESS ENTER TO START',
  difficulty: 'DIFFICULTY  < {level} >',
  heroClass: 'CLASS: {name}',
  junior: 'JUNIOR DEV',
  devops: 'DEVOPS',
  dba: 'DBA',
  cto: 'CTO',
  easy: 'EASY',
  normal: 'NORMAL',
  hard: 'HARD',
  hell: 'HELL',
  gameOver: 'GAME OVER',
  score: 'SCORE {value}',
  combo: 'x{value}',
  lives: 'LIVES {value}',
  shield: 'FW',
  linter: 'LINT',
  cache: 'CACHE',
  time: 'TIME {value}s',
  highScores: 'HIGH SCORES',
  highScoreRow: '{rank}. {score}  {seconds}s',
  pause: 'PAUSE',
  resume: 'RESUME',
  paused: 'PAUSED',
  soundOn: 'SOUND ON',
  soundOff: 'SOUND OFF',
  moreWords: '+{count}',
  skillCommand: 'SKILL: {command}',
  ultimateCommand: 'ULT: {command}',
  helpHint: 'H: HELP',
  helpFooter: '< > PAGE   ESC: BACK',
  helpPage: '{page}/{total}',
  helpBasics: 'HOW TO PLAY',
  helpLevels: 'LEVELS',
  helpDemons: 'DEMONS',
  helpDrops: 'DROPS',
  helpTypeHeading: 'TYPE',
  helpType:
    'One dev is still online. Type the word over a demon to hurl it. ' +
    'Type its last word to banish it.',
  helpLivesHeading: 'LIVES',
  helpLives: 'You have {lives} lives. A demon that reaches you costs lives: see DEMONS.',
  helpComboHeading: 'COMBO',
  helpCombo:
    'A perfect word has no wrong letter. {words} in a row raise the score multiplier, up to ' +
    'x{max}. A typo lowers it, a lost life resets it to x1.',
  helpKeysHeading: 'KEYS',
  helpKeys: 'Backspace erases a typo on {levels}. ESC pauses.',
  levelWords: 'Up to {count} word(s) per demon.',
  levelPhrase: 'Words form a phrase, typed whole, spaces included.',
  levelSpawn: 'Spawn gap {pct}%.',
  levelKamikaze: 'Kamikazes {pct}%.',
  levelGhost: 'Ghosts {pct}%.',
  levelErasable: 'Backspace erases a typo.',
  levelReset: 'A typo clears the buffer and enrages the demon: speed x{boost}.',
  demonGrunt: 'Walks in from any edge. Speed x{speedScale}. Costs {damage} life(s).',
  demonKamikaze:
    'One word of up to {maxWordLength} letters. Sides only. Speed x{speedScale}. ' +
    'Costs {damage} life(s).',
  demonGhost:
    'One word of up to {maxWordLength} letters, hidden as ??? until it is {revealDistance} px ' +
    'from you. Speed x{speedScale}. Costs {damage} life(s).',
  demonTank:
    'Miniboss: first at {first}s, then every {every}s. {minWords} to {maxWords} words. ' +
    'Speed x{speedScale}. Costs {damage} life(s). Always carries a drop.',
  demonPhrase: 'On {levels}, {words} words are typed together.',
  roleCharge:
    'Commands fill yellow as they charge, and turn red while you type them. ' +
    'Coffee refills them.',
  skillRecharge: 'Ready again {seconds}s after use.',
  ultimateCharge: 'Needs {words} charge: +1 per perfect word, +1 per {seconds}s. Empties on use.',
  passive: 'PASSIVE',
  dropsHow:
    'Banish a carrier cleanly, last word typed with no wrong letter, to get its drop. ' +
    "Its label wears the drop's color; a tank keeps its own and gets a frame.",
  grunt: 'GRUNT',
  kamikaze: 'KAMIKAZE',
  ghost: 'GHOST',
  hiddenWord: '???',
  tank: 'TANK',
  dropPatch: 'PATCH',
  dropFirewall: 'FIREWALL',
  dropLinter: 'LINTER',
  dropCache: 'CACHE',
  dropCoffee: 'COFFEE',
  pickupPatch: '+{lives} LIFE',
  pickupPatchFull: 'LIFE FULL',
  pickupCache: 'CACHE x{scoreScale}',
  spellPatch: 'Heals {lives} life(s), up to {maxLives}.',
  spellFirewall: 'Absorbs the next {hits} demon(s) that reach you.',
  spellLinter: 'Forgives {typos} typo(s): the combo stays.',
  spellCache: 'Word score x{scoreScale} for {seconds}s.',
  spellCoffee: 'Refills the skill. Adds {chargeWords} to the ultimate charge.',
  spellFreeze: 'No demon moves for {seconds}s.',
  spellThrottle: 'Every demon moves at {speedPct}% speed for {seconds}s.',
  spellTruncate: "Cuts {letters} letters off every demon's next word. One letter stays.",
  spellDrop: 'Banishes every demon. Their remaining letters score at the base rate.',
  spellPushback: 'Pushes every demon back {pixels} px, never past the edge it came from.',
  spellDescope:
    'For {seconds}s every demon needs only a short word, {letters}+ letters. Typing it kills the demon.',
  spellTab: "Completes the closest demon's next word, as if typed perfectly.",
  spellSnippet:
    "For {seconds}s, typing the first {letters} letters of the closest demon's next word kills it.",
  passiveGrace: 'A demon that reaches you waits {graceSeconds}s before it costs a life.',
  passiveSlow:
    'A word typed on a demon that survives it slows that demon to {speedPct}% for {slowSeconds}s.',
  passiveBurn: "Each kill cuts {burnLetters} letter(s) off the closest demon's next word.",
  passivePush: 'A word that leaves a demon alive pushes it back {pushPixels} px.',
};

export type StringKey = keyof typeof en;

// New language: add its dictionary here and set config.locale.
const locales: Record<string, Record<StringKey, string>> = { en };

export function t(key: StringKey, values: Record<string, string | number> = {}): string {
  const dictionary = locales[config.locale] ?? en;
  return dictionary[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
}
