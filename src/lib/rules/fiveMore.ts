/**
 * 5e.tools' other pages, past the spells, items, feats, species, classes and
 * creatures the app knows by heart: each an entry with a name, a book and
 * its text, so the search finds them and a pop-up shows them the same way.
 * One table, read by the search index (scripts/search-index.mjs) and by the
 * pop-ups (rules/fiveData, rules/peek).
 */
export type MorePage = {
  /** 5e.tools' page, without ".html". */
  page: string;
  /** The data file, and the lists in it that hold entries. */
  file: string;
  keys: string[];
  /** What one is, said in the search and the pop-up. */
  word: string;
};

const MORE_PAGES: MorePage[] = [
  { page: 'rewards', file: 'rewards.json', keys: ['reward'], word: 'Supernatural Gift' },
  { page: 'deities', file: 'deities.json', keys: ['deity'], word: 'Deity' },
  { page: 'vehicles', file: 'vehicles.json', keys: ['vehicle', 'vehicleUpgrade'], word: 'Vehicle' },
  { page: 'objects', file: 'objects.json', keys: ['object'], word: 'Object' },
  { page: 'trapshazards', file: 'trapshazards.json', keys: ['trap', 'hazard'], word: 'Trap or Hazard' },
  { page: 'psionics', file: 'psionics.json', keys: ['psionic'], word: 'Psionic' },
  { page: 'cultsboons', file: 'cultsboons.json', keys: ['cult', 'boon'], word: 'Cult or Boon' },
  { page: 'languages', file: 'languages.json', keys: ['language'], word: 'Language' },
  { page: 'variantrules', file: 'variantrules.json', keys: ['variantrule'], word: 'Rule' },
  { page: 'actions', file: 'actions.json', keys: ['action'], word: 'Action' },
  { page: 'recipes', file: 'recipes.json', keys: ['recipe'], word: 'Recipe' },
  { page: 'decks', file: 'decks.json', keys: ['deck'], word: 'Deck' },
  { page: 'senses', file: 'senses.json', keys: ['sense'], word: 'Sense' },
  { page: 'skills', file: 'skills.json', keys: ['skill'], word: 'Skill' },
  { page: 'charcreationoptions', file: 'charcreationoptions.json', keys: ['charoption'], word: 'Character Option' }
];

export const morePage = (page: string): MorePage | undefined => MORE_PAGES.find((p) => p.page === page);

/** What a trap, a hazard, a cult or a boon is, from its own list where one file holds two. */
export const MORE_WORD: Record<string, string> = { trap: 'Trap', hazard: 'Hazard', cult: 'Cult', boon: 'Boon', vehicleUpgrade: 'Vehicle Upgrade' };
