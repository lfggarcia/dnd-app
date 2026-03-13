#!/usr/bin/env node
/**
 * scripts/generate-character-catalog.js
 *
 * Full character catalog generator for TORRE.
 * Generates 4 portrait variants per DnD 5e class (12 classes × ~4-5 races = 52+ portraits).
 * Each entry in the catalog represents a usable character archetype the player can select.
 *
 * Output structure:
 *   assets/images/characters/<charClass>/<race>_<n>/portrait.png
 *   assets/images/characters/<charClass>/<race>_<n>/expressions.json  (optional, run after)
 *   assets/images/characters/catalog.json         <- app index (class + race metadata)
 *   assets/images/characters/progress.json        <- resume state
 *
 * Run:
 *   node scripts/generate-character-catalog.js
 *   node scripts/generate-character-catalog.js --resume
 *   node scripts/generate-character-catalog.js --class fighter
 *   node scripts/generate-character-catalog.js --class fighter --race elf
 *
 * To fill 13 parties (52 characters) the script generates:
 *   12 classes × 4 race variants + 4 extra bonus entries = 52 entries minimum.
 *
 * Requirements: Node 18+, ComfyUI at COMFY_URL with PerfectDeliberate v8 + LoRAs.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const COMFY_URL     = process.env.COMFY_URL ?? 'http://192.168.0.17:8089';
const POLL_INTERVAL = 2_000;
const POLL_MAX      = 180;

const IMAGES_DIR    = path.join(__dirname, '..', 'assets', 'images', 'characters');
const CATALOG_FILE  = path.join(IMAGES_DIR, 'catalog.json');
const PROGRESS_FILE = path.join(IMAGES_DIR, 'catalog_progress.json');

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error(`Node 18+ required`); process.exit(1); }

// ---------------------------------------------------------------------------
// Quality tags
// ---------------------------------------------------------------------------
const QUALITY_PREFIX = 'score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres';
const QUALITY_NEG    = 'score_6, score_5, score_4, low quality, worst quality, blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature, photorealistic, multiple girls, crowd, duplicate';

// ---------------------------------------------------------------------------
// Race visual descriptors (must match RACE_VISUAL in geminiImageService.ts)
// ---------------------------------------------------------------------------
const RACE_VISUAL = {
  human:       'human female',
  elf:         'elf female, long pointed ears, ethereal graceful features, lithe slender build',
  dwarf:       'dwarf female, stocky powerful build, braided hair, wide shoulders',
  halfling:    'halfling female, very short petite stature, curly hair, nimble energetic',
  'half-elf':  'half-elf female, slightly pointed ears, delicate mixed-heritage features',
  'half-orc':  'half-orc female, grey-green tinted skin, prominent lower canines, strong powerful build',
  gnome:       'gnome female, tiny small stature, large bright curious eyes, button nose',
  tiefling:    'tiefling female, small curved ram horns, long thin tail, solid-color glowing eyes',
  dragonborn:  'dragonborn female, humanoid body, human face structure, reptilian scale texture on skin, slit vertical pupils, small curved horns on forehead',
};

// ---------------------------------------------------------------------------
// Class visual descriptors
// ---------------------------------------------------------------------------
const CLASS_VISUAL = {
  barbarian: 'barbarian warrior, minimal hide or leather armor, large brutal melee weapon, tribal paint or markings',
  bard:      'bard performer, colorful flamboyant outfit, lute or instrument, decorative cape',
  cleric:    'cleric priest, holy symbol amulet, chainmail or robes, mace or staff, faint divine glow',
  druid:     'druid, nature-themed flowing robes, carved wooden staff, leaf and vine motifs',
  fighter:   'fighter soldier, plate armor or chainmail, sword and shield or greatsword, battle-worn gear',
  monk:      'monk martial artist, simple cloth gi wrappings, barefoot or sandals, rope belt, fighting stance',
  paladin:   'paladin holy knight, shining full plate armor, holy symbol, divine radiant aura',
  ranger:    'ranger hunter, worn leather armor, longbow on back, dark travel cloak, forest-adapted gear',
  rogue:     'rogue assassin, form-fitting dark leather armor, twin daggers at hip, hood or mask',
  sorcerer:  'sorcerer mage, flowing otherworldly robes, raw magical energy crackling around hands, arcane orb',
  warlock:   'warlock, dark eldritch robes, pact weapon, occult runes and symbols, shadowy void magic',
  wizard:    'wizard scholar, arcane patterned robes, spellbook tome, staff or wand, glowing magical sigils',
};

// ---------------------------------------------------------------------------
// Subclass descriptors for visual variety (used by variant index)
// ---------------------------------------------------------------------------
const SUBCLASS_FLAVOR = {
  // barbarian
  'barbarian-berserker':     'rage frenzy expression, bloodlust in eyes',
  'barbarian-totem':         'nature spirit totem feathers and bones accessories',
  // bard
  'bard-lore':               'scholar-bard, ancient tome at hip, ink-stained fingers',
  'bard-valor':              'battle-bard, light armor, sword and lute',
  // cleric
  'cleric-life':             'healer cleric, glowing green healing light, white vestments',
  'cleric-war':              'war cleric, heavy armor, divine war banner',
  // druid
  'druid-land':              'circle of land, nature commune pose, glowing runes on skin',
  'druid-moon':              'circle of moon, lunar symbol, wild shape aura shimmer',
  // fighter
  'fighter-champion':        'battle-hardened veteran, multiple scars, no-nonsense expression',
  'fighter-battlemaster':    'tactical fighter, battle map scroll, commanding posture',
  // monk
  'monk-open-hand':          'open-hand style, graceful flowing martial arts stance',
  'monk-shadow':             'shadow monk, dark clothing, shadow energy tendrils',
  // paladin
  'paladin-devotion':        'oath of devotion, shining holy blade, pure white aura',
  'paladin-vengeance':       'oath of vengeance, dark plate accents, cold determined eyes',
  // ranger
  'ranger-hunter':           'hunter ranger, two weapons, tracking stance, eyes scanning',
  'ranger-beastmaster':      'beast companion, hand resting on animal companion',
  // rogue
  'rogue-thief':             'nimble thief, grappling hook, sly charming smile',
  'rogue-assassin':          'assassin, facemask half-up, poison vial, shadow hiding',
  // sorcerer
  'sorcerer-draconic':       'draconic sorcerer, faint scale shimmer on skin, dragon magic',
  'sorcerer-wild':           'wild magic sorcerer, chaotic magic sparks, unpredictable aura',
  // warlock
  'warlock-fiend':           'fiend patron, hellfire in palm, orange-red infernal glow',
  'warlock-great-old-one':   'great old one, void tendrils, eldritch symbols, maddening gaze',
  // wizard
  'wizard-evocation':        'evocation wizard, crackling lightning and fire in both hands',
  'wizard-abjuration':       'abjuration wizard, protective rune shields floating around them',
};

// ---------------------------------------------------------------------------
// Catalog entries — 4+ variants per class covering different races/subclasses
// Total: 52 entries which fills 13 parties (13 × 4 = 52)
//
// Key format: <charClass>_<race>_<n>  (n = 1..4)
// ---------------------------------------------------------------------------
const CATALOG_ENTRIES = [
  // ── BARBARIAN (4 variants) ────────────────────────────────────────────────
  { key: 'barbarian_human_1',    charClass: 'barbarian', race: 'human',     subclass: 'berserker',
    hair: 'wild unkempt dark hair',     eyes: 'fierce dark brown eyes',
    skin: 'tanned fair skin',   desc: 'tribal tattoos, berserker rage expression, savage primal energy',
    pose: 'cowboy shot, aggressive battle stance, greatsword raised',
    bg:   'stormy battlefield ruins, lightning flashes' },
  { key: 'barbarian_half-orc_2', charClass: 'barbarian', race: 'half-orc',  subclass: 'berserker',
    hair: 'short black mohawk',         eyes: 'glowing red rage eyes',
    skin: 'olive grey-green orc skin',  desc: 'small tusks, tribal war paint, muscular build, leather vest',
    pose: 'cowboy shot, roaring battle cry stance, axe swinging',
    bg:   'burning village with dramatic fire glow' },
  { key: 'barbarian_dwarf_3',    charClass: 'barbarian', race: 'dwarf',     subclass: 'totem',
    hair: 'braided auburn hair with bone beads', eyes: 'steel blue determined eyes',
    skin: 'ruddy fair skin',    desc: 'totem warrior, bear spirit runes on skin, wide stance',
    pose: 'cowboy shot, bear stance ready to charge',
    bg:   'misty mountain path, spirit animal shadow behind' },
  { key: 'barbarian_elf_4',      charClass: 'barbarian', race: 'elf',       subclass: 'totem',
    hair: 'long wild silver hair',      eyes: 'feral violet eyes',
    skin: 'pale moonlit skin',  desc: 'nature-rage barbarian, vine tattoos, minimal armor, elegant savage contrast',
    pose: 'cowboy shot, leaping sprint attack mid-air',
    bg:   'ancient forest clearing, moonlight breaking through' },

  // ── BARD (4 variants) ─────────────────────────────────────────────────────
  { key: 'bard_half-elf_1',     charClass: 'bard', race: 'half-elf', subclass: 'lore',
    hair: 'wavy chestnut hair with colorful streaks', eyes: 'bright green charismatic eyes',
    skin: 'warm tan mixed-heritage skin', desc: 'colorful performer vest, lute under arm, charming grin',
    pose: 'cowboy shot, mid-performance bow, one hand behind back dramatically',
    bg:   'warm tavern stage, lantern and candle light' },
  { key: 'bard_human_2',        charClass: 'bard', race: 'human',    subclass: 'valor',
    hair: 'short auburn hair',           eyes: 'lively blue eyes',
    skin: 'fair rosy skin',    desc: 'valor bard, light leather armor, short sword and lute, battle-ready pose',
    pose: 'cowboy shot, weapon and instrument held simultaneously, ready for anything',
    bg:   'coastal cliff, dramatic sea wind, bards tale moment' },
  { key: 'bard_tiefling_3',     charClass: 'bard', race: 'tiefling', subclass: 'lore',
    hair: 'dark purple silky hair',      eyes: 'golden curious eyes',
    skin: 'pale lavender skin, curved small horns', desc: 'theatrical tiefling, elaborate costume, enchanting presence',
    pose: 'cowboy shot, spell-song casting, musical magic notes floating',
    bg:   'moonlit outdoor amphitheater, audience silhouettes' },
  { key: 'bard_gnome_4',        charClass: 'bard', race: 'gnome',    subclass: 'lore',
    hair: 'wild curly rainbow-tinted hair',  eyes: 'sparkling bright magenta eyes',
    skin: 'fair smooth gnome skin',  desc: 'tiny gnome bard, oversized colorful hat, small violin, mischievous smile',
    pose: 'cowboy shot, playing tiny instrument with huge passion',
    bg:   'fairground festival, colorful tents and lanterns' },

  // ── CLERIC (5 variants = fills extra party) ───────────────────────────────
  { key: 'cleric_human_1',     charClass: 'cleric', race: 'human',    subclass: 'life',
    hair: 'long blond neat hair',       eyes: 'kind warm brown eyes',
    skin: 'fair rosy skin',   desc: 'life domain cleric, gold and white robes, healing glow in hands, holy symbol',
    pose: 'cowboy shot, healing prayer gesture, compassionate expression',
    bg:   'cathedral interior, stained glass window light streaming' },
  { key: 'cleric_dwarf_2',     charClass: 'cleric', race: 'dwarf',    subclass: 'war',
    hair: 'braided red hair',           eyes: 'stoic grey eyes',
    skin: 'ruddy dwarf skin',  desc: 'war domain cleric, heavy plate, divine war banner, holy warhammer',
    pose: 'cowboy shot, shield raised with holy symbol, battle-ready consecrated stance',
    bg:   'temple battlefield, divine light descending' },
  { key: 'cleric_elf_3',       charClass: 'cleric', race: 'elf',      subclass: 'life',
    hair: 'silver moonlit straight hair', eyes: 'luminous pale blue eyes',
    skin: 'pearl ethereal skin', desc: 'moonelf cleric, moonlit silver robes, lunar holy symbol, ethereal grace',
    pose: 'cowboy shot, channeling divine moon energy, arms raised',
    bg:   'moonlit shrine, silver divine radiance' },
  { key: 'cleric_half-elf_4',  charClass: 'cleric', race: 'half-elf', subclass: 'war',
    hair: 'dark wavy hair',             eyes: 'determined hazel eyes',
    skin: 'medium warm mixed skin', desc: 'half-elf war cleric, battle vestments, sword and mace, holy symbol on shield',
    pose: 'cowboy shot, blessing sword with divine glow, resolute expression',
    bg:   'fortress chapel, battle outside the window' },
  { key: 'cleric_dragonborn_5',charClass: 'cleric', race: 'dragonborn', subclass: 'life',
    hair: 'no hair, draconic head features', eyes: 'golden reptilian slit pupils',
    skin: 'golden-bronze dragon scales, draconic face structure', desc: 'dragon cleric, ornate gold-plated holy armor, impressive draconic presence',
    pose: 'cowboy shot, divine radiance pouring from outstretched hand',
    bg:   'dragon temple, golden divine smoke and incense' },

  // ── DRUID (4 variants) ────────────────────────────────────────────────────
  { key: 'druid_elf_1',        charClass: 'druid', race: 'elf',      subclass: 'moon',
    hair: 'wild flower-woven hair',     eyes: 'nature green glowing eyes',
    skin: 'warm golden-green tinted ethereal skin', desc: 'moon druid, antler headpiece, nature robes with vine patterns, wild shape aura',
    pose: 'cowboy shot, communing with nature, hands on gnarled oak staff',
    bg:   'ancient grove, bioluminescent mushrooms, midnight moonlight' },
  { key: 'druid_human_2',      charClass: 'druid', race: 'human',    subclass: 'land',
    hair: 'wild brown hair with leaves',  eyes: 'earth brown wide eyes',
    skin: 'sun-tanned outdoorswoman skin', desc: 'circle of land druid, layered forest garments, spell ingredient pouches',
    pose: 'cowboy shot, channeling earth magic, ground growing around feet',
    bg:   'misty forest glade, ancient standing stones' },
  { key: 'druid_gnome_3',      charClass: 'druid', race: 'gnome',    subclass: 'land',
    hair: 'mossy green tinted curly hair', eyes: 'bright hazel curious eyes',
    skin: 'freckled fair gnome skin', desc: 'gnome nature druid, tiny frame in oversized nature armor, talking to forest creatures',
    pose: 'cowboy shot, tiny druid with huge personality, bird on shoulder',
    bg:   'enchanted garden, tiny footpath through giant flowers' },
  { key: 'druid_half-elf_4',   charClass: 'druid', race: 'half-elf', subclass: 'moon',
    hair: 'silver streaked auburn hair', eyes: 'moonlit silver-green eyes',
    skin: 'warm fair mixed skin', desc: 'half-elf druid, elegant wild magic, lunar cycle runes on arms, graceful wild nature',
    pose: 'cowboy shot, shape-shift initiation stance, moonlight transforming',
    bg:   'forest clearing under full moon, mist rising' },

  // ── FIGHTER (4 variants) ──────────────────────────────────────────────────
  { key: 'fighter_human_1',    charClass: 'fighter', race: 'human',    subclass: 'champion',
    hair: 'short practical dark brown hair', eyes: 'sharp no-nonsense grey eyes',
    skin: 'battle-scarred tanned skin', desc: 'veteran champion fighter, heavy plate armor, battle scars, longsword and kite shield',
    pose: 'cowboy shot, confident battle stance, shield at ready, sword at hip',
    bg:   'stone fortress courtyard, training grounds at dusk' },
  { key: 'fighter_elf_2',      charClass: 'fighter', race: 'elf',      subclass: 'battlemaster',
    hair: 'short silver hair slicked back', eyes: 'calculating violet eyes',
    skin: 'pale elegant elf skin', desc: 'elf battle master, light elven plate, twin rapiers, calculating tactical expression',
    pose: 'cowboy shot, tactical ready stance, studying opponent, weapons crossed',
    bg:   'dueling arena, gallery of watchers' },
  { key: 'fighter_dwarf_3',    charClass: 'fighter', race: 'dwarf',    subclass: 'champion',
    hair: 'long braided chestnut beard and hair', eyes: 'fierce amber eyes',
    skin: 'tough battle-hardened dwarf skin', desc: 'dwarf fighter, full dwarven plate, twin war axes, proud battle stance',
    pose: 'cowboy shot, axes crossed over chest, immovable stance',
    bg:   'mountain pass canyon, dramatic sunrise behind' },
  { key: 'fighter_half-orc_4', charClass: 'fighter', race: 'half-orc', subclass: 'battlemaster',
    hair: 'short black hair, battle-worn',  eyes: 'intimidating dark eyes',
    skin: 'grey-green orc muscle skin', desc: 'half-orc battle master, heavy armor over massive frame, tactical command presence',
    pose: 'cowboy shot, commanding battlefield stance, pointing strategic direction',
    bg:   'active battlefield, soldiers behind following orders' },

  // ── MONK (4 variants) ─────────────────────────────────────────────────────
  { key: 'monk_human_1',       charClass: 'monk', race: 'human',    subclass: 'open-hand',
    hair: 'hair in neat topknot',         eyes: 'peaceful focused brown eyes',
    skin: 'athletic golden-tan training skin', desc: 'open hand monk, simple white gi, athletic lean body, ki energy shimmer',
    pose: 'cowboy shot, centered martial arts ready stance, ki glowing in fists',
    bg:   'monastery rooftop at dawn, mountain mist below' },
  { key: 'monk_elf_2',         charClass: 'monk', race: 'elf',      subclass: 'shadow',
    hair: 'dark hair tied back with shadow ribbon', eyes: 'twilight purple eyes',
    skin: 'dark cool-tone elven skin', desc: 'shadow monk, dark silk garments, shadow tendrils, stealthy elegant',
    pose: 'cowboy shot, shadow dancing stance, shadows rising from feet',
    bg:   'moonlit rooftop, city below in fog' },
  { key: 'monk_halfling_3',    charClass: 'monk', race: 'halfling', subclass: 'open-hand',
    hair: 'curly light brown hair',       eyes: 'bright eager green eyes',
    skin: 'warm fair halfling skin, nimble frame', desc: 'halfling monk, surprisingly powerful small frame, deceptively fast strikes',
    pose: 'cowboy shot, mid-kick aerial pose showing speed and agility',
    bg:   'courtyard stone tiles, training dummy shattered' },
  { key: 'monk_half-elf_4',    charClass: 'monk', race: 'half-elf', subclass: 'shadow',
    hair: 'sleek dark hair, warrior braid', eyes: 'piercing silver eyes',
    skin: 'warm mixed-heritage athletic skin', desc: 'half-elf shadow monk, minimal dark wrappings, perfect form, meditation focus',
    pose: 'cowboy shot, shadow step mid-teleport pose, partially in shadow',
    bg:   'ancient dojo candlelight, calligraphy scrolls on wall' },

  // ── PALADIN (5 variants) ──────────────────────────────────────────────────
  { key: 'paladin_human_1',    charClass: 'paladin', race: 'human',    subclass: 'devotion',
    hair: 'short noble blond hair',       eyes: 'noble sky blue eyes',
    skin: 'fair noble skin',  desc: 'oath of devotion paladin, gleaming full plate, holy sword, white aura, warm divine light',
    pose: 'cowboy shot, holding holy sword skyward, divine light beam from blade',
    bg:   'golden divine temple, aurora light cascading' },
  { key: 'paladin_dwarf_2',    charClass: 'paladin', race: 'dwarf',    subclass: 'devotion',
    hair: 'braided red-gold hair and beard', eyes: 'warm amber devout eyes',
    skin: 'proud stocky dwarf skin', desc: 'dwarven paladin, ornate ancestral plate, sacred warhammer, ancestral oath runes',
    pose: 'cowboy shot, warhammer and shield, guardian protective stance',
    bg:   'dwarven hall of ancestors, carved stone pillars' },
  { key: 'paladin_half-elf_3', charClass: 'paladin', race: 'half-elf', subclass: 'vengeance',
    hair: 'dark hair with silver temples',  eyes: 'cold violet righteous eyes',
    skin: 'warm fair mixed skin', desc: 'vengeance paladin, dark plate with gold accents, justice sword, intense focused gaze',
    pose: 'cowboy shot, judgment stance, sword point at fallen enemy below',
    bg:   'ruined cathedral, villain kneeling in shadow' },
  { key: 'paladin_tiefling_4', charClass: 'paladin', race: 'tiefling', subclass: 'devotion',
    hair: 'white hair, small curved horns', eyes: 'glowing warm golden redemption eyes',
    skin: 'pale silver-lavender skin', desc: 'tiefling redemption paladin, white gold armor contrasting dark heritage, inspiring presence',
    pose: 'cowboy shot, holding pale white flame in palm, angelic and demonic contrast',
    bg:   'heaven-gate threshold, light and shadow both present' },
  { key: 'paladin_dragonborn_5',charClass: 'paladin', race: 'dragonborn', subclass: 'vengeance',
    hair: 'no hair, silver-scaled dragon head', eyes: 'luminous silver dragon eyes',
    skin: 'silver metallic dragon scales, imposing stature', desc: 'silver dragonborn paladin, silver full plate, frost breath charge, magnificent warrior',
    pose: 'cowboy shot, frost breath weapon charging in mouth, battle formation stance',
    bg:   'winter battlefield, frost and divine fire contrasting' },

  // ── RANGER (4 variants) ───────────────────────────────────────────────────
  { key: 'ranger_elf_1',       charClass: 'ranger', race: 'elf',      subclass: 'hunter',
    hair: 'braided silver hair with leaves', eyes: 'sharp amber hunter eyes',
    skin: 'forest-dappled pale elf skin', desc: 'elf ranger hunter, worn green leather armor, longbow drawn, forest guardian',
    pose: 'cowboy shot, drawn bow aimed, one eye closed for perfect aim',
    bg:   'misty ancient forest ruins, morning light through trees' },
  { key: 'ranger_human_2',     charClass: 'ranger', race: 'human',    subclass: 'beast-master',
    hair: 'windswept brown hair',         eyes: 'warm outdoors brown eyes',
    skin: 'weather-tanned adventurer skin', desc: 'beast master ranger, forest gear, animal companion wolf at side, wilderness bond',
    pose: 'cowboy shot, hand on wolf shoulder companion, dual blades ready',
    bg:   'forest opening, beast companion glowing with bond' },
  { key: 'ranger_halfling_3',  charClass: 'ranger', race: 'halfling', subclass: 'hunter',
    hair: 'curly light hair with feather',  eyes: 'bright observant hazel eyes',
    skin: 'warm lightly tanned halfling skin', desc: 'halfling ranger, small but deadly, hooded forest cloak, shortbow specialist',
    pose: 'cowboy shot, crouched scouting pose, nocked arrow ready from ambush',
    bg:   'dense forest underbrush, dappled moonlight' },
  { key: 'ranger_half-elf_4',  charClass: 'ranger', race: 'half-elf', subclass: 'hunter',
    hair: 'darker hair with forest-braids', eyes: 'vigilant green eyes',
    skin: 'olive forest-worker mixed skin', desc: 'half-elf ranger, dual curved blades, tracking stance, ranger mark glowing on hand',
    pose: 'cowboy shot, twin blades crossed ready, hunter tracking mark activated',
    bg:   'twilight ravine, hunted prey tracks visible' },

  // ── ROGUE (4 variants) ────────────────────────────────────────────────────
  { key: 'rogue_halfling_1',   charClass: 'rogue', race: 'halfling', subclass: 'thief',
    hair: 'curly dark hair, messy',       eyes: 'clever mischievous brown eyes',
    skin: 'fair nimble halfling skin', desc: 'halfling thief, black leather gear too big for tiny frame, lock-pick tools everywhere',
    pose: 'cowboy shot, crouched sneaking stance one dagger drawn',
    bg:   'shadowy city alleyway, moonlit cobblestone' },
  { key: 'rogue_human_2',      charClass: 'rogue', race: 'human',    subclass: 'assassin',
    hair: 'dark close-cropped tactical hair', eyes: 'cold grey emotionless eyes',
    skin: 'pale shadow-dwelling skin', desc: 'assassin rogue, form-fitting black silent armor, poison vial, mask half-raised',
    pose: 'cowboy shot, mid-shadow-step pose, blade extended for silent kill',
    bg:   'rooftop at night, city below, mark in window visible' },
  { key: 'rogue_tiefling_3',   charClass: 'rogue', race: 'tiefling', subclass: 'thief',
    hair: 'short blue-black hair, small horns', eyes: 'cunning amber slit-pupil eyes',
    skin: 'blue-grey tiefling smooth skin', desc: 'tiefling thief, elegant dark outfit with pockets everywhere, charming confidence',
    pose: 'cowboy shot, leaning casual but hands very busy stealing unnoticed',
    bg:   'noble party reception hall, chandelier above' },
  { key: 'rogue_half-elf_4',   charClass: 'rogue', race: 'half-elf', subclass: 'assassin',
    hair: 'sleek dark pulled-back hair',    eyes: 'narrow calculating violet eyes',
    skin: 'warm neutral mixed skin', desc: 'half-elf arcane rogue, shadow blade in main hand, arcane trickery glow off-hand',
    pose: 'cowboy shot, shadow blade materialized, arcane energy crackling',
    bg:   'mystical shadow dimension pocket, planar rifts' },

  // ── SORCERER (4 variants) ─────────────────────────────────────────────────
  { key: 'sorcerer_human_1',   charClass: 'sorcerer', race: 'human',    subclass: 'draconic',
    hair: 'long flowing dark hair',       eyes: 'gold draconic-touched eyes',
    skin: 'warm golden-tinted skin, faint scale hints at temples', desc: 'draconic sorcerer, scales showing at collarbone, golden dragon power crackling',
    pose: 'cowboy shot, dragon magic erupting from both hands, draconic wings outline behind',
    bg:   'ancient dragon ruin, dragon energy flowing through ley lines' },
  { key: 'sorcerer_tiefling_2',charClass: 'sorcerer', race: 'tiefling', subclass: 'wild',
    hair: 'wild magenta-pink hair defying gravity', eyes: 'glowing wild magic cycling-color eyes',
    skin: 'pink-tinted tiefling skin', desc: 'wild magic sorcerer, magical chaos swirling, wild surge manifestation visible',
    pose: 'cowboy shot, wild surge mid-chaotic explosion, look of delighted panic',
    bg:   'magical chaos field, reality warping around them' },
  { key: 'sorcerer_elf_3',     charClass: 'sorcerer', race: 'elf',      subclass: 'draconic',
    hair: 'silver hair crackling with magical static', eyes: 'crystalline arcane blue eyes',
    skin: 'luminous pale elf skin with arcane rune glow', desc: 'elf draconic sorcerer, arcane robes with draconic patterns, raw magical resonance',
    pose: 'cowboy shot, controlled devastating arcane blast ready, intense focus',
    bg:   'floating magical tower, storm clouds below' },
  { key: 'sorcerer_half-elf_4',charClass: 'sorcerer', race: 'half-elf', subclass: 'wild',
    hair: 'wild multi-color wild surge affected hair', eyes: 'swirling chromatic wild magic eyes',
    skin: 'warm mixed skin with random glowing wild magic spots', desc: 'half-elf wild sorcerer, untamed raw power, exciting personality',
    pose: 'cowboy shot, surfing wild magic surge wave, exhilarated laughter',
    bg:   'magical anomaly zone, reality patchwork colors' },

  // ── WARLOCK (4 variants) ──────────────────────────────────────────────────
  { key: 'warlock_tiefling_1', charClass: 'warlock', race: 'tiefling', subclass: 'fiend',
    hair: 'straight dark hair, curved horns', eyes: 'glowing orange fiendish eyes',
    skin: 'red-orange tiefling skin, hellfire aura', desc: 'fiend warlock, dark pact leather, hellfire in palm, dark power confidence',
    pose: 'cowboy shot, fiend pact blade materialized, hellfire crackling',
    bg:   'infernal realm threshold, brimstone and ash' },
  { key: 'warlock_human_2',    charClass: 'warlock', race: 'human',    subclass: 'great-old-one',
    hair: 'disheveled dark hair touched by void', eyes: 'void-filled deep purple eyes',
    skin: 'pale void-touched skin, eldritch mark', desc: 'great old one warlock, eldritch symbols tattooed, void tendrils responding',
    pose: 'cowboy shot, communicating with incomprehensible patron, far-away gaze',
    bg:   'infinite void library, impossible angles and geometry' },
  { key: 'warlock_elf_3',      charClass: 'warlock', race: 'elf',      subclass: 'great-old-one',
    hair: 'dark elf hair with star-void shine', eyes: 'dark elf void-silver eyes',
    skin: 'dark cool-tone elf skin', desc: 'dark elf great old one warlock, pact tome floating open, cosmic knowledge visible',
    pose: 'cowboy shot, reading eldritch pact tome, reality warping around the book',
    bg:   'astral plane, stars and void mixing' },
  { key: 'warlock_half-orc_4', charClass: 'warlock', race: 'half-orc', subclass: 'fiend',
    hair: 'mohawk with burn scars',       eyes: 'burning amber pact-fire eyes',
    skin: 'dark grey-green skin with fiend brands', desc: 'half-orc fiend warlock, pact scars glowing, intimidating dark power presence',
    pose: 'cowboy shot, dark pact greataxe manifested, infernal command aura',
    bg:   'dark fortress throne room, hellfire sconces' },

  // ── WIZARD (4 variants) ───────────────────────────────────────────────────
  { key: 'wizard_human_1',     charClass: 'wizard', race: 'human',    subclass: 'evocation',
    hair: 'neat scholarly dark hair',     eyes: 'sharp intellectual dark eyes',
    skin: 'indoor scholar pale skin',    desc: 'evocation wizard, arcane patterned robes, crackling ball lightning spell, mastery in hands',
    pose: 'cowboy shot, crackling lightning evocation ready, focused mastery expression',
    bg:   'arcane tower study peak, storm behind window' },
  { key: 'wizard_gnome_2',     charClass: 'wizard', race: 'gnome',    subclass: 'abjuration',
    hair: 'large poofy whitening grey hair', eyes: 'magnified brilliant curious eyes behind thick spectacles',
    skin: 'gnome scholar soft skin', desc: 'gnome wizard professor, too-large pointy hat, magical encyclopedias floating, protective runes',
    pose: 'cowboy shot, protective ward spell raised, books orbiting gleefully',
    bg:   'magical university library, floating books and candles' },
  { key: 'wizard_elf_3',       charClass: 'wizard', race: 'elf',      subclass: 'evocation',
    hair: 'long elegant silver-white hair', eyes: 'ancient luminous arcane blue eyes',
    skin: 'ageless pale elf scholar skin', desc: 'elf arcane scholar, flowing midnight robes with constellation embroidery, millennium of study',
    pose: 'cowboy shot, channeling ancient elven arcane mastery, controlled precision',
    bg:   'elven magicka observatory, crystal lens and star charts' },
  { key: 'wizard_half-elf_4',  charClass: 'wizard', race: 'half-elf', subclass: 'abjuration',
    hair: 'practical tied-back dark hair',  eyes: 'resourceful analytical hazel eyes',
    skin: 'warm scholar mixed-heritage skin', desc: 'half-elf abjuration wizard, protective rune field, defensive magical barriers',
    pose: 'cowboy shot, abjuration ward shield deployed, runic barrier glowing',
    bg:   'magical nexus ward, layered protective fields visible' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  process.stdout.write(`[${new Date().toLocaleTimeString('es', { hour12: false })}] ${msg}\n`);
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveProgress(p) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function saveCatalog(catalog) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
}

// ---------------------------------------------------------------------------
// ComfyUI API
// ---------------------------------------------------------------------------
async function queueWorkflow(workflow) {
  const r = await fetch(`${COMFY_URL}/prompt`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt: workflow }),
  });
  if (!r.ok) throw new Error(`Queue ${r.status}: ${await r.text()}`);
  return (await r.json()).prompt_id;
}

async function pollUntilDone(promptId, label) {
  const t0 = Date.now();
  for (let i = 0; i < POLL_MAX; i++) {
    await sleep(POLL_INTERVAL);
    const r = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (!r.ok) continue;
    const h     = await r.json();
    const entry = h[promptId];
    if (entry?.status?.completed)              return { entry, elapsed: Date.now() - t0 };
    if (entry?.status?.status_str === 'error') throw new Error('ComfyUI generation error');
    const s = Math.floor((Date.now() - t0) / 1000);
    process.stdout.write(`\r     ${label} — ${s}s elapsed...   `);
  }
  throw new Error(`Timeout after ${(POLL_MAX * POLL_INTERVAL) / 1000}s`);
}

async function fetchBlob(filename, subfolder) {
  const p = new URLSearchParams({ filename, subfolder, type: 'output' });
  const r = await fetch(`${COMFY_URL}/view?${p}`);
  if (!r.ok) throw new Error(`Image fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isValidPng = buf => buf.length > 10_000 && PNG_MAGIC.every((b, i) => buf[i] === b);

// ---------------------------------------------------------------------------
// Workflow builder — identical to existing generate-characters.js
// ---------------------------------------------------------------------------
function buildPortraitWorkflow(positiveText, negativeText, seed) {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple',  inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',              inputs: { model: ['1', 0], clip: ['1', 1], lora_name: '748cmSDXL.safetensors',                        strength_model: 0.5,  strength_clip: 0.5  } },
    '3':  { class_type: 'LoraLoader',              inputs: { model: ['2', 0], clip: ['2', 1], lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors', strength_model: 0.55, strength_clip: 0.55 } },
    '4':  { class_type: 'LoraLoader',              inputs: { model: ['3', 0], clip: ['3', 1], lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',  strength_model: 0.6,  strength_clip: 0.6  } },
    '5':  { class_type: 'LoraLoader',              inputs: { model: ['4', 0], clip: ['4', 1], lora_name: 'Detailer_NoobAI_Incrs_v1.safetensors',        strength_model: 0.70, strength_clip: 0.70 } },
    '19': { class_type: 'LoraLoader',              inputs: { model: ['5', 0], clip: ['5', 1], lora_name: 'Face_Enhancer_Illustrious.safetensors',       strength_model: 0.45, strength_clip: 0.45 } },
    '20': { class_type: 'LoraLoader',              inputs: { model: ['19', 0], clip: ['19', 1], lora_name: 'Best_Facial_Expression_Helper_XTREME_ILLU-000005.safetensors', strength_model: 0.35, strength_clip: 0.35 } },
    '6':  { class_type: 'CLIPSetLastLayer',        inputs: { clip: ['20', 1], stop_at_clip_layer: -2 } },
    '7':  { class_type: 'CLIPTextEncode',          inputs: { text: positiveText, clip: ['6', 0] } },
    '8':  { class_type: 'CLIPTextEncode',          inputs: { text: negativeText, clip: ['6', 0] } },
    '9':  { class_type: 'EmptyLatentImage',        inputs: { width: 832, height: 1216, batch_size: 1 } },
    '10': { class_type: 'KSampler',                inputs: { seed, steps: 38, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1.0,  model: ['20', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['9', 0] } },
    '11': { class_type: 'VAEDecodeTiled',          inputs: { samples: ['10', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '12': { class_type: 'UpscaleModelLoader',      inputs: { model_name: 'remacri_original.safetensors' } },
    '13': { class_type: 'ImageUpscaleWithModel',   inputs: { upscale_model: ['12', 0], image: ['11', 0] } },
    '14': { class_type: 'ImageScale',              inputs: { upscale_method: 'lanczos', width: 1248, height: 1824, crop: 'disabled', image: ['13', 0] } },
    '15': { class_type: 'VAEEncodeTiled',          inputs: { pixels: ['14', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '16': { class_type: 'KSampler',                inputs: { seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.55, model: ['20', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['15', 0] } },
    '17': { class_type: 'VAEDecodeTiled',          inputs: { samples: ['16', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '18': { class_type: 'SaveImage',               inputs: { filename_prefix: 'catalog', images: ['17', 0] } },
  };
}

function buildPromptForEntry(entry) {
  const raceDesc  = RACE_VISUAL[entry.race] ?? entry.race;
  const classDesc = CLASS_VISUAL[entry.charClass] ?? entry.charClass;
  const subDesc   = entry.subclass && SUBCLASS_FLAVOR[`${entry.charClass}-${entry.subclass}`]
    ? SUBCLASS_FLAVOR[`${entry.charClass}-${entry.subclass}`]
    : '';

  const positive = [
    QUALITY_PREFIX,
    'BREAK',
    `1girl, solo, ${raceDesc}, ${entry.hair}, ${entry.eyes}, ${entry.skin}`,
    `${classDesc}${subDesc ? `, ${subDesc}` : ''}`,
    `${entry.desc}`,
    `${entry.pose}`,
    `${entry.bg}, dramatic lighting, highly detailed, expressive eyes, perfect face`,
    'usnr, 748cmstyle',
  ].join(', ');

  const negative = [
    QUALITY_NEG,
    'multiple girls, crowd, deformed hands, bad hands, nsfw, nude',
  ].join(', ');

  return { positive, negative };
}

// ---------------------------------------------------------------------------
// Per-character generation
// ---------------------------------------------------------------------------
async function generateEntry(entry) {
  const { positive, negative } = buildPromptForEntry(entry);
  const seed     = Math.floor(Math.random() * 2 ** 32);
  const workflow = buildPortraitWorkflow(positive, negative, seed);
  const promptId = await queueWorkflow(workflow);
  const { entry: result, elapsed } = await pollUntilDone(promptId, entry.key);
  process.stdout.write('\n');

  const imgs = result.outputs?.['18']?.images;
  if (!imgs?.length) throw new Error('No output images in history');
  return { ...imgs[0], elapsed, seed };
}

async function processEntry(entry, progress, catalog) {
  const charDir = path.join(IMAGES_DIR, entry.charClass, entry.key);
  fs.mkdirSync(charDir, { recursive: true });

  if (progress[entry.key]) {
    log(`  [SKIP] ${entry.key} — already generated`);
    if (!catalog[entry.key]) {
      catalog[entry.key] = buildCatalogRecord(entry, progress[entry.key].portrait);
    }
    return;
  }

  log(`  Generating ${entry.key} (${entry.charClass} / ${entry.race})...`);
  const result = await generateEntry(entry);
  const buf    = await fetchBlob(result.filename, result.subfolder);
  if (!isValidPng(buf)) throw new Error(`PNG inválido para ${entry.key}`);

  const outPath     = path.join(charDir, 'portrait.png');
  fs.writeFileSync(outPath, buf);

  const relPortrait = `assets/images/characters/${entry.charClass}/${entry.key}/portrait.png`;

  progress[entry.key] = { portrait: relPortrait, seed: result.seed };
  catalog[entry.key]  = buildCatalogRecord(entry, relPortrait);

  saveProgress(progress);
  saveCatalog(catalog);
  log(`  Saved ${path.relative(process.cwd(), outPath)} (${(buf.length / 1024).toFixed(0)} KB, ${(result.elapsed / 1000).toFixed(1)}s)`);
}

function buildCatalogRecord(entry, portraitPath) {
  return {
    key:          entry.key,
    charClass:    entry.charClass,
    race:         entry.race,
    subclass:     entry.subclass ?? null,
    portraitPath, // relative from project root
    expressions:  null, // filled by generate-expressions.js via --character flag
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  const args       = process.argv.slice(2);
  const resume     = args.includes('--resume');
  const filterClass = args.includes('--class') ? args[args.indexOf('--class') + 1] : null;
  const filterRace  = args.includes('--race')  ? args[args.indexOf('--race' ) + 1] : null;

  const total  = CATALOG_ENTRIES.length;
  const classes = [...new Set(CATALOG_ENTRIES.map(e => e.charClass))];

  console.log('\n=== TORRE · Character Catalog Generator ===');
  console.log(`  Entries   : ${total} (${Math.ceil(total / 4)} full parties)`);
  console.log(`  Classes   : ${classes.join(', ')}`);
  console.log(`  Resume    : ${resume ? 'ON' : 'OFF'}`);
  console.log(`  Filter    : ${filterClass ? `class=${filterClass}` : 'all'}${filterRace ? ` race=${filterRace}` : ''}`);
  console.log(`  Output    : assets/images/characters/`);
  console.log(`  Index     : assets/images/characters/catalog.json`);
  console.log('');

  process.stdout.write('Connecting to ComfyUI... ');
  const ping = await fetch(`${COMFY_URL}/system_stats`).catch(e => {
    throw new Error(`Cannot reach ComfyUI: ${e.message}`);
  });
  if (!ping.ok) throw new Error(`ComfyUI returned HTTP ${ping.status}`);
  console.log('OK\n');

  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const progress = resume ? loadProgress() : {};
  const catalog  = resume && fs.existsSync(CATALOG_FILE)
    ? JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
    : {};

  let targets = CATALOG_ENTRIES;
  if (filterClass) targets = targets.filter(e => e.charClass === filterClass);
  if (filterRace)  targets = targets.filter(e => e.race      === filterRace);

  if (targets.length === 0) {
    console.error(`No entries match filter: class=${filterClass ?? '*'} race=${filterRace ?? '*'}`);
    console.error(`Available classes: ${classes.join(', ')}`);
    console.error(`Available races: ${[...new Set(CATALOG_ENTRIES.map(e => e.race))].join(', ')}`);
    process.exit(1);
  }

  log(`Starting: ${targets.length} characters to generate`);
  log(`Ctrl+C to pause — rerun with --resume to continue\n`);

  const t0 = Date.now();
  let done  = 0;

  for (const entry of targets) {
    log(`\n[${entry.key.toUpperCase()}] (${++done}/${targets.length})`);
    try {
      await processEntry(entry, progress, catalog);
    } catch (err) {
      log(`  ERROR: ${err.message}`);
      saveProgress(progress);
      saveCatalog(catalog);
    }
  }

  const elapsed = (Date.now() - t0) / 1000;
  console.log(`\n=== Done in ${(elapsed / 60).toFixed(1)} min ===`);
  console.log(`  Catalog : ${path.relative(process.cwd(), CATALOG_FILE)}`);
  console.log(`  Entries : ${Object.keys(catalog).length} portraits\n`);

  console.log('Next step — generate expressions for each portrait:');
  for (const key of Object.keys(catalog)) {
    const p = catalog[key];
    const portraitFile = path.basename(p.portraitPath ?? '', '.png') + '.png';
    console.log(`  node scripts/generate-expressions.js --character ${p.charClass}/${key} --input ${portraitFile}`);
  }
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
