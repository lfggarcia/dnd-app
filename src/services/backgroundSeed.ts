import { upsertResourceBatch } from '../database';

/**
 * Seed backgrounds that aren't in the SRD API.
 * The official D&D 5e API only includes "Acolyte" as SRD content.
 * These complement it with the most common PHB backgrounds for TORRE.
 */
export function seedCustomBackgrounds(): void {
  upsertResourceBatch(
    CUSTOM_BACKGROUNDS.map(bg => ({
      endpoint: 'backgrounds',
      indexKey: bg.index,
      name: bg.name,
      data: bg,
    })),
  );
}

const CUSTOM_BACKGROUNDS = [
  {
    index: 'soldier',
    name: 'Soldier',
    starting_proficiencies: [
      { index: 'skill-athletics', name: 'Skill: Athletics' },
      { index: 'skill-intimidation', name: 'Skill: Intimidation' },
    ],
    starting_equipment: [],
    feature: {
      name: 'Military Rank',
      desc: [
        'You have a military rank from your career as a soldier. Soldiers still recognize your authority and influence.',
      ],
    },
  },
  {
    index: 'criminal',
    name: 'Criminal',
    starting_proficiencies: [
      { index: 'skill-deception', name: 'Skill: Deception' },
      { index: 'skill-stealth', name: 'Skill: Stealth' },
    ],
    starting_equipment: [],
    feature: {
      name: 'Criminal Contact',
      desc: [
        'You have a reliable and trustworthy contact who acts as your liaison to a network of other criminals.',
      ],
    },
  },
  {
    index: 'sage',
    name: 'Sage',
    starting_proficiencies: [
      { index: 'skill-arcana', name: 'Skill: Arcana' },
      { index: 'skill-history', name: 'Skill: History' },
    ],
    starting_equipment: [],
    feature: {
      name: 'Researcher',
      desc: [
        'When you attempt to learn or recall a piece of lore, if you do not know that information, you often know where and from whom you can obtain it.',
      ],
    },
  },
  {
    index: 'outlander',
    name: 'Outlander',
    starting_proficiencies: [
      { index: 'skill-athletics', name: 'Skill: Athletics' },
      { index: 'skill-survival', name: 'Skill: Survival' },
    ],
    starting_equipment: [],
    feature: {
      name: 'Wanderer',
      desc: [
        'You have an excellent memory for maps and geography, and you can always recall the general layout of terrain and settlements.',
      ],
    },
  },
  {
    index: 'noble',
    name: 'Noble',
    starting_proficiencies: [
      { index: 'skill-history', name: 'Skill: History' },
      { index: 'skill-persuasion', name: 'Skill: Persuasion' },
    ],
    starting_equipment: [],
    feature: {
      name: 'Position of Privilege',
      desc: [
        'Thanks to your noble birth, people are inclined to think the best of you. You are welcome in high society.',
      ],
    },
  },
  {
    index: 'hermit',
    name: 'Hermit',
    starting_proficiencies: [
      { index: 'skill-medicine', name: 'Skill: Medicine' },
      { index: 'skill-religion', name: 'Skill: Religion' },
    ],
    starting_equipment: [],
    feature: {
      name: 'Discovery',
      desc: [
        'The quiet seclusion of your extended hermitage gave you access to a unique and powerful discovery.',
      ],
    },
  },
];
