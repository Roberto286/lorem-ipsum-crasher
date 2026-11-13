import { config } from '../config';

const en = {
  title: 'LOREM IPSUM CRASHER',
  lore:
    'Lorem Ipsum was never filler text. It is a summoning spell. ' +
    'Developers abused it for decades. The demons are awake, and they want revenge.\n\n' +
    'Type their names to banish them.',
  mobileUnsupported: 'This game needs a real keyboard.\n\nPlay it on a desktop computer.',
  start: 'PRESS ENTER TO START',
  difficulty: 'DIFFICULTY  < {level} >',
  easy: 'EASY',
  normal: 'NORMAL',
  hard: 'HARD',
  hell: 'HELL',
  gameOver: 'GAME OVER',
  score: 'SCORE {value}',
  lives: 'LIVES {value}',
  time: 'TIME {value}s',
  highScores: 'HIGH SCORES',
  highScoreRow: '{rank}. {score}  {seconds}s',
  pause: 'PAUSE',
  resume: 'RESUME',
  paused: 'PAUSED',
  soundOn: 'SOUND ON',
  soundOff: 'SOUND OFF',
};

export type StringKey = keyof typeof en;

// New language: add its dictionary here and set config.locale.
const locales: Record<string, Record<StringKey, string>> = { en };

export function t(key: StringKey, values: Record<string, string | number> = {}): string {
  const dictionary = locales[config.locale] ?? en;
  return dictionary[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
}
