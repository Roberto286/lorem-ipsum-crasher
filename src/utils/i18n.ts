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
};

export type StringKey = keyof typeof en;

// New language: add its dictionary here and set config.locale.
const locales: Record<string, Record<StringKey, string>> = { en };

export function t(key: StringKey, values: Record<string, string | number> = {}): string {
  const dictionary = locales[config.locale] ?? en;
  return dictionary[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
}
