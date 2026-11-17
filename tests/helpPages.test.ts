import { describe, expect, it } from 'vitest';
import { config, type ClassKey } from '../src/config';
import { t } from '../src/utils/i18n';
import { helpPages, spellText } from '../src/utils/helpPages';

const allText = (page: ReturnType<typeof helpPages>[number]) =>
  page.blocks.map((block) => `${block.heading ?? ''}\n${block.text}`).join('\n');

describe('helpPages', () => {
  const pages = helpPages();

  it('has a page for the basics, levels, demons, each role and the drops', () => {
    expect(pages).toHaveLength(4 + Object.keys(config.classes).length);
  });

  it('leaves no placeholder unfilled', () => {
    for (const page of pages) {
      expect(allText(page)).not.toMatch(/[{}]|undefined|NaN/);
      expect(page.title).not.toBe('');
    }
  });

  it('shows the commands of each role on its own page', () => {
    for (const key of Object.keys(config.classes) as ClassKey[]) {
      const role = config.classes[key];
      const page = pages.find((candidate) => candidate.title === t(key));
      const text = page ? allText(page) : '';
      expect(text).toContain(role.skill.command);
      expect(text).toContain(role.ultimate.command);
    }
  });

  it('reads the numbers from config', () => {
    expect(spellText('cache')).toContain(String(config.spells.cache.seconds));
    expect(spellText('throttle')).toContain(`${config.spells.throttle.speedScale * 100}%`);
    expect(allText(pages[0])).toContain(String(config.player.lives));
    expect(allText(pages[2])).toContain(String(config.difficulty.tankSpawnSeconds.first));
    expect(allText(pages[2])).toContain(String(config.enemyTypes.ghost.revealDistance));
  });
});
