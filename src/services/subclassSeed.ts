import { upsertResourceBatch } from '../database';

/**
 * Seed the second subclass per primary class.
 * The SRD API only provides 1 subclass per class — these complement them
 * so each class has exactly 2 options in TORRE.
 *
 * Format matches the D&D 5e API subclass response structure.
 */
export function seedCustomSubclasses(): void {
  upsertResourceBatch(
    CUSTOM_SUBCLASSES.map(sub => ({
      endpoint: 'subclasses',
      indexKey: sub.index,
      name: sub.name,
      data: sub,
    })),
  );
}

const CUSTOM_SUBCLASSES = [
  {
    index: 'totem-warrior',
    name: 'Path of the Totem Warrior',
    class: { index: 'barbarian', name: 'Barbarian', url: '/api/classes/barbarian' },
    subclass_flavor: 'Path of the Totem Warrior',
    desc: [
      'A spiritual warrior who draws power from animal spirit guides. The totem warrior gains abilities tied to a chosen animal spirit — Bear, Eagle, or Wolf — that enhance rage and grant supernatural awareness.',
    ],
    spells: [],
  },
  {
    index: 'valor',
    name: 'College of Valor',
    class: { index: 'bard', name: 'Bard', url: '/api/classes/bard' },
    subclass_flavor: 'College of Valor',
    desc: [
      'Battle bards who weave magic and martial prowess together. They inspire allies through tales of heroic deeds, gain proficiency with medium armor, shields, and martial weapons, and can strike in concert with their spellcasting.',
    ],
    spells: [],
  },
  {
    index: 'war',
    name: 'War Domain',
    class: { index: 'cleric', name: 'Cleric', url: '/api/classes/cleric' },
    subclass_flavor: 'War Domain',
    desc: [
      'Clerics of war gods who excel in martial combat. They gain proficiency with heavy armor and martial weapons, can make bonus weapon attacks guided by divine favor, and channel divinity to strike with supernatural accuracy.',
    ],
    spells: [],
  },
  {
    index: 'moon',
    name: 'Circle of the Moon',
    class: { index: 'druid', name: 'Druid', url: '/api/classes/druid' },
    subclass_flavor: 'Circle of the Moon',
    desc: [
      'Druids who specialize in the use of Wild Shape for combat. They can transform into more powerful beast forms, use Wild Shape as a bonus action, and eventually assume elemental forms.',
    ],
    spells: [],
  },
  {
    index: 'battle-master',
    name: 'Battle Master',
    class: { index: 'fighter', name: 'Fighter', url: '/api/classes/fighter' },
    subclass_flavor: 'Battle Master',
    desc: [
      'Tactical fighters who employ combat maneuvers fueled by superiority dice. They can disarm, trip, riposte, and perform other battlefield techniques that turn the tide of combat through skill rather than brute force.',
    ],
    spells: [],
  },
  {
    index: 'shadow',
    name: 'Way of Shadow',
    class: { index: 'monk', name: 'Monk', url: '/api/classes/monk' },
    subclass_flavor: 'Way of Shadow',
    desc: [
      'Monks who follow the tradition of shadow arts, using ki to duplicate shadow magic effects. They can cast darkness, silence, and other stealth-related spells, teleport between shadows, and become invisible.',
    ],
    spells: [],
  },
  {
    index: 'vengeance',
    name: 'Oath of Vengeance',
    class: { index: 'paladin', name: 'Paladin', url: '/api/classes/paladin' },
    subclass_flavor: 'Oath of Vengeance',
    desc: [
      'Paladins sworn to punish those who commit grievous sins. They channel divinity to gain advantage against sworn enemies, move with supernatural speed to pursue foes, and are relentless in their pursuit of justice.',
    ],
    spells: [],
  },
  {
    index: 'beast-master',
    name: 'Beast Master',
    class: { index: 'ranger', name: 'Ranger', url: '/api/classes/ranger' },
    subclass_flavor: 'Beast Master',
    desc: [
      'Rangers who form a deep bond with a beast companion. The companion fights alongside them, grows stronger as the ranger gains levels, and can be directed to attack, dash, disengage, or help in combat.',
    ],
    spells: [],
  },
  {
    index: 'assassin',
    name: 'Assassin',
    class: { index: 'rogue', name: 'Rogue', url: '/api/classes/rogue' },
    subclass_flavor: 'Assassin',
    desc: [
      'Rogues who specialize in the art of dealing death swiftly and silently. They gain proficiency with disguise kits and poisoner kits, deal devastating damage to surprised targets, and can assume false identities.',
    ],
    spells: [],
  },
  {
    index: 'wild-magic',
    name: 'Wild Magic',
    class: { index: 'sorcerer', name: 'Sorcerer', url: '/api/classes/sorcerer' },
    subclass_flavor: 'Wild Magic',
    desc: [
      'Sorcerers whose innate magic comes from wild, chaotic forces. Their spellcasting can trigger unpredictable wild magic surges, they can bend luck in their favor, and they learn to channel the chaos for controlled bursts of power.',
    ],
    spells: [],
  },
  {
    index: 'great-old-one',
    name: 'The Great Old One',
    class: { index: 'warlock', name: 'Warlock', url: '/api/classes/warlock' },
    subclass_flavor: 'The Great Old One',
    desc: [
      'Warlocks who serve an ancient entity from beyond the stars — beings such as Cthulhu or Tharizdun. They gain telepathic abilities, can project psychic terror, and eventually create thralls from defeated minds.',
    ],
    spells: [],
  },
  {
    index: 'abjuration',
    name: 'School of Abjuration',
    class: { index: 'wizard', name: 'Wizard', url: '/api/classes/wizard' },
    subclass_flavor: 'School of Abjuration',
    desc: [
      'Wizards who specialize in protective and warding magic. They create an arcane ward that absorbs damage, can strengthen abjuration spells, and eventually resist spell effects with supernatural resilience.',
    ],
    spells: [],
  },
];
