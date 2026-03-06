import { upsertTranslationBatch, type Translation } from '../database';

/**
 * Seed the database with Spanish translations for core D&D 5e resources.
 * These cover the official SRD translations for races, classes, ability scores,
 * alignments, skills, conditions, damage types, languages, etc.
 */
export function seedSpanishTranslations(): void {
  const translations: Translation[] = [
    // ─── Ability Scores ────────────────────────────────────
    ...abilityScores(),
    // ─── Alignments ────────────────────────────────────────
    ...alignments(),
    // ─── Races ─────────────────────────────────────────────
    ...races(),
    // ─── Subraces ──────────────────────────────────────────
    ...subraces(),
    // ─── Classes ───────────────────────────────────────────
    ...classes(),
    // ─── Subclasses ────────────────────────────────────────
    ...subclasses(),
    // ─── Skills ────────────────────────────────────────────
    ...skills(),
    // ─── Conditions ────────────────────────────────────────
    ...conditions(),
    // ─── Damage Types ──────────────────────────────────────
    ...damageTypes(),
    // ─── Magic Schools ─────────────────────────────────────
    ...magicSchools(),
    // ─── Languages ─────────────────────────────────────────
    ...languages(),
    // ─── Backgrounds ───────────────────────────────────────
    ...backgrounds(),
    // ─── Weapon Properties ─────────────────────────────────
    ...weaponProperties(),
  ];

  upsertTranslationBatch(translations);
}

// ─── Helper ────────────────────────────────────────────────

function t(
  endpoint: string,
  indexKey: string,
  fieldPath: string,
  value: string,
): Translation {
  return { endpoint, index_key: indexKey, field_path: fieldPath, lang: 'es', value };
}

// ─── Ability Scores ────────────────────────────────────────

function abilityScores(): Translation[] {
  return [
    t('ability-scores', 'str', 'name', 'FUE'),
    t('ability-scores', 'str', 'full_name', 'Fuerza'),
    t('ability-scores', 'str', 'desc', 'Mide el poder físico natural, entrenamiento atlético y la extensión a la que puedes ejercer fuerza bruta.'),

    t('ability-scores', 'dex', 'name', 'DES'),
    t('ability-scores', 'dex', 'full_name', 'Destreza'),
    t('ability-scores', 'dex', 'desc', 'Mide la agilidad, reflejos y equilibrio.'),

    t('ability-scores', 'con', 'name', 'CON'),
    t('ability-scores', 'con', 'full_name', 'Constitución'),
    t('ability-scores', 'con', 'desc', 'Mide la salud, resistencia y fuerza vital.'),

    t('ability-scores', 'int', 'name', 'INT'),
    t('ability-scores', 'int', 'full_name', 'Inteligencia'),
    t('ability-scores', 'int', 'desc', 'Mide la agudeza mental, precisión de memoria y capacidad de razonamiento.'),

    t('ability-scores', 'wis', 'name', 'SAB'),
    t('ability-scores', 'wis', 'full_name', 'Sabiduría'),
    t('ability-scores', 'wis', 'desc', 'Mide la percepción, intuición y perspicacia.'),

    t('ability-scores', 'cha', 'name', 'CAR'),
    t('ability-scores', 'cha', 'full_name', 'Carisma'),
    t('ability-scores', 'cha', 'desc', 'Mide la fuerza de personalidad, elocuencia y liderazgo.'),
  ];
}

// ─── Alignments ────────────────────────────────────────────

function alignments(): Translation[] {
  return [
    t('alignments', 'lawful-good', 'name', 'Legal Bueno'),
    t('alignments', 'lawful-good', 'desc', 'Se puede contar con que estas criaturas hagan lo correcto según lo esperado por la sociedad.'),

    t('alignments', 'neutral-good', 'name', 'Neutral Bueno'),
    t('alignments', 'neutral-good', 'desc', 'Hacen lo mejor que pueden para ayudar a otros según sus necesidades.'),

    t('alignments', 'chaotic-good', 'name', 'Caótico Bueno'),
    t('alignments', 'chaotic-good', 'desc', 'Actúan según su conciencia, sin importar las expectativas de otros.'),

    t('alignments', 'lawful-neutral', 'name', 'Legal Neutral'),
    t('alignments', 'lawful-neutral', 'desc', 'Actúan de acuerdo con la ley, tradición o códigos personales.'),

    t('alignments', 'neutral', 'name', 'Neutral'),
    t('alignments', 'neutral', 'desc', 'Prefieren mantenerse al margen de cuestiones morales y no tomar partido.'),

    t('alignments', 'chaotic-neutral', 'name', 'Caótico Neutral'),
    t('alignments', 'chaotic-neutral', 'desc', 'Siguen sus caprichos, valorando su libertad personal por encima de todo.'),

    t('alignments', 'lawful-evil', 'name', 'Legal Malvado'),
    t('alignments', 'lawful-evil', 'desc', 'Toman metódicamente lo que quieren, dentro de los límites de un código de tradición o lealtad.'),

    t('alignments', 'neutral-evil', 'name', 'Neutral Malvado'),
    t('alignments', 'neutral-evil', 'desc', 'Hacen lo que sea para salirse con la suya, sin compasión ni escrúpulos.'),

    t('alignments', 'chaotic-evil', 'name', 'Caótico Malvado'),
    t('alignments', 'chaotic-evil', 'desc', 'Actúan con violencia arbitraria, estimulados por su codicia, odio o sed de sangre.'),
  ];
}

// ─── Races ─────────────────────────────────────────────────

function races(): Translation[] {
  return [
    t('races', 'human', 'name', 'Humano'),
    t('races', 'human', 'desc', 'Los humanos son los más adaptables y ambiciosos entre las razas comunes. Sus gustos, morales y costumbres varían enormemente.'),

    t('races', 'elf', 'name', 'Elfo'),
    t('races', 'elf', 'desc', 'Los elfos son un pueblo mágico de gracia sobrenatural, que viven en el mundo pero no son completamente parte de él.'),

    t('races', 'dwarf', 'name', 'Enano'),
    t('races', 'dwarf', 'desc', 'Los enanos son gente robusta y resistente. Valoran el honor de sus clanes por encima de todo.'),

    t('races', 'halfling', 'name', 'Mediano'),
    t('races', 'halfling', 'desc', 'Los medianos son un pueblo afable, pequeño y práctico que valora la comodidad del hogar.'),

    t('races', 'dragonborn', 'name', 'Dracónido'),
    t('races', 'dragonborn', 'desc', 'Nacidos de dragones, los dracónidos caminan orgullosamente por un mundo que los recibe con temor.'),

    t('races', 'gnome', 'name', 'Gnomo'),
    t('races', 'gnome', 'desc', 'Los gnomos son seres curiosos y energéticos, entusiastas de la vida y de todo lo que la rodea.'),

    t('races', 'half-elf', 'name', 'Semielfo'),
    t('races', 'half-elf', 'desc', 'Los semielfos combinan las mejores cualidades de sus padres humanos y elfos.'),

    t('races', 'half-orc', 'name', 'Semiorco'),
    t('races', 'half-orc', 'desc', 'Los semiorcos heredan una tendencia hacia el caos de sus padres orcos y no se inclinan fuertemente hacia el bien.'),

    t('races', 'tiefling', 'name', 'Tiefling'),
    t('races', 'tiefling', 'desc', 'Los tieflings descienden de humanos y llevan la marca de su herencia infernal en su apariencia.'),
  ];
}

// ─── Subraces ──────────────────────────────────────────────

function subraces(): Translation[] {
  return [
    t('subraces', 'high-elf', 'name', 'Alto Elfo'),
    t('subraces', 'high-elf', 'desc', 'Los altos elfos tienen una mente aguda y un dominio de la magia básica.'),

    t('subraces', 'wood-elf', 'name', 'Elfo del Bosque'),
    t('subraces', 'wood-elf', 'desc', 'Los elfos del bosque tienen sentidos agudos e intuición, y sus pies rápidos los llevan velozmente a través de sus bosques nativos.'),

    t('subraces', 'hill-dwarf', 'name', 'Enano de las Colinas'),
    t('subraces', 'hill-dwarf', 'desc', 'Los enanos de las colinas tienen sentidos agudos, intuición profunda y una resistencia notable.'),

    t('subraces', 'mountain-dwarf', 'name', 'Enano de las Montañas'),
    t('subraces', 'mountain-dwarf', 'desc', 'Los enanos de las montañas son fuertes y resistentes, acostumbrados a la vida difícil en terreno escarpado.'),

    t('subraces', 'lightfoot-halfling', 'name', 'Mediano Piesligeros'),
    t('subraces', 'lightfoot-halfling', 'desc', 'Los piesligeros son adeptos a esconderse, incluso usando a otras criaturas como cobertura.'),

    t('subraces', 'stout-halfling', 'name', 'Mediano Fornido'),
    t('subraces', 'stout-halfling', 'desc', 'Los medianos fornidos son más duros que el promedio y tienen cierta resistencia al veneno.'),

    t('subraces', 'rock-gnome', 'name', 'Gnomo de las Rocas'),
    t('subraces', 'rock-gnome', 'desc', 'Los gnomos de las rocas tienen una inventiva natural y resistencia por encima de otros gnomos.'),

    t('subraces', 'forest-gnome', 'name', 'Gnomo del Bosque'),
    t('subraces', 'forest-gnome', 'desc', 'Los gnomos del bosque tienen un don natural para la ilusión y una afinidad innata con los animales pequeños.'),
  ];
}

// ─── Classes ───────────────────────────────────────────────

function classes(): Translation[] {
  return [
    t('classes', 'barbarian', 'name', 'Bárbaro'),
    t('classes', 'barbarian', 'desc', 'Un feroz guerrero primitivo que puede entrar en furia de batalla.'),
    t('classes', 'barbarian', 'hit_die_label', 'Dado de golpe: d12'),

    t('classes', 'bard', 'name', 'Bardo'),
    t('classes', 'bard', 'desc', 'Un artista inspirador cuyo poder hace eco de la música de la creación.'),
    t('classes', 'bard', 'hit_die_label', 'Dado de golpe: d8'),

    t('classes', 'cleric', 'name', 'Clérigo'),
    t('classes', 'cleric', 'desc', 'Un campeón sacerdotal que esgrime magia divina al servicio de un poder superior.'),
    t('classes', 'cleric', 'hit_die_label', 'Dado de golpe: d8'),

    t('classes', 'druid', 'name', 'Druida'),
    t('classes', 'druid', 'desc', 'Un sacerdote de la Antigua Fe, que ejerce los poderes de la naturaleza y adopta formas animales.'),
    t('classes', 'druid', 'hit_die_label', 'Dado de golpe: d8'),

    t('classes', 'fighter', 'name', 'Guerrero'),
    t('classes', 'fighter', 'desc', 'Un maestro del combate marcial, competente con una variedad de armas y armaduras.'),
    t('classes', 'fighter', 'hit_die_label', 'Dado de golpe: d10'),

    t('classes', 'monk', 'name', 'Monje'),
    t('classes', 'monk', 'desc', 'Un maestro de las artes marciales, aprovechando el poder del cuerpo en busca de la perfección física y espiritual.'),
    t('classes', 'monk', 'hit_die_label', 'Dado de golpe: d8'),

    t('classes', 'paladin', 'name', 'Paladín'),
    t('classes', 'paladin', 'desc', 'Un guerrero sagrado ligado a un juramento sagrado.'),
    t('classes', 'paladin', 'hit_die_label', 'Dado de golpe: d10'),

    t('classes', 'ranger', 'name', 'Explorador'),
    t('classes', 'ranger', 'desc', 'Un guerrero que usa la magia marcial para combatir amenazas en los bordes de la civilización.'),
    t('classes', 'ranger', 'hit_die_label', 'Dado de golpe: d10'),

    t('classes', 'rogue', 'name', 'Pícaro'),
    t('classes', 'rogue', 'desc', 'Un sinvergüenza que usa el sigilo y la astucia para superar obstáculos y enemigos.'),
    t('classes', 'rogue', 'hit_die_label', 'Dado de golpe: d8'),

    t('classes', 'sorcerer', 'name', 'Hechicero'),
    t('classes', 'sorcerer', 'desc', 'Un lanzador de conjuros que extrae la magia inherente de un don o linaje.'),
    t('classes', 'sorcerer', 'hit_die_label', 'Dado de golpe: d6'),

    t('classes', 'warlock', 'name', 'Brujo'),
    t('classes', 'warlock', 'desc', 'Un portador de magia derivada de un pacto con una entidad extraplanar.'),
    t('classes', 'warlock', 'hit_die_label', 'Dado de golpe: d8'),

    t('classes', 'wizard', 'name', 'Mago'),
    t('classes', 'wizard', 'desc', 'Un usuario de magia erudito capaz de manipular las estructuras de la realidad.'),
    t('classes', 'wizard', 'hit_die_label', 'Dado de golpe: d6'),
  ];
}

// ─── Subclasses ────────────────────────────────────────────

function subclasses(): Translation[] {
  return [
    // ── SRD subclasses (from API) ──────────────────────────
    t('subclasses', 'berserker', 'name', 'Berserker'),
    t('subclasses', 'berserker', 'desc', 'Para algunos bárbaros, la ira es un medio para un fin — un furor desatado que los convierte en máquinas de destrucción imparables.'),

    t('subclasses', 'lore', 'name', 'Colegio del Saber'),
    t('subclasses', 'lore', 'desc', 'Bardos que recopilan conocimiento de todas las fuentes, tejiendo magia a través de sus palabras y música para manipular las mentes de otros.'),

    t('subclasses', 'life', 'name', 'Dominio de la Vida'),
    t('subclasses', 'life', 'desc', 'Clérigos dedicados a la sanación y protección de la vida. Canalizan energía divina positiva para curar heridas y proteger a los vivos.'),

    t('subclasses', 'land', 'name', 'Círculo de la Tierra'),
    t('subclasses', 'land', 'desc', 'Druidas guardianes de la sabiduría ancestral de la tierra. Obtienen hechizos adicionales según el terreno que protegen.'),

    t('subclasses', 'champion', 'name', 'Campeón'),
    t('subclasses', 'champion', 'desc', 'Guerreros que perfeccionan sus habilidades físicas hasta el límite. Destacan por golpes críticos devastadores y resistencia atlética superior.'),

    t('subclasses', 'open-hand', 'name', 'Camino de la Mano Abierta'),
    t('subclasses', 'open-hand', 'desc', 'Monjes maestros del combate marcial sin armas. Usan el ki para derribar, empujar y aturdir a sus enemigos con técnicas de mano abierta.'),

    t('subclasses', 'devotion', 'name', 'Juramento de Devoción'),
    t('subclasses', 'devotion', 'desc', 'Paladines consagrados a los más altos ideales de justicia, virtud y orden. Canalizan poder divino para proteger a los inocentes y castigar a los malvados.'),

    t('subclasses', 'hunter', 'name', 'Cazador'),
    t('subclasses', 'hunter', 'desc', 'Exploradores que aceptan el desafío de ser el depredador de los depredadores. Se especializan en técnicas para abatir todo tipo de presas.'),

    t('subclasses', 'thief', 'name', 'Ladrón'),
    t('subclasses', 'thief', 'desc', 'Pícaros ágiles y versátiles que perfeccionan las artes del sigilo, el robo y la infiltración con habilidad sobrenatural.'),

    t('subclasses', 'draconic', 'name', 'Linaje Dracónico'),
    t('subclasses', 'draconic', 'desc', 'Hechiceros cuya magia innata proviene de sangre de dragón en su linaje. Ganan resistencia elemental y escamas protectoras.'),

    t('subclasses', 'fiend', 'name', 'El Infernal'),
    t('subclasses', 'fiend', 'desc', 'Brujos que han pactado con un señor infernal. Obtienen poder oscuro para destruir a sus enemigos y resistencia sobrenatural al daño.'),

    t('subclasses', 'evocation', 'name', 'Escuela de Evocación'),
    t('subclasses', 'evocation', 'desc', 'Magos especializados en magia destructiva y elemental. Pueden moldear sus hechizos para proteger a los aliados del daño colateral.'),

    // ── Custom subclasses (TORRE additions) ────────────────
    t('subclasses', 'totem-warrior', 'name', 'Guerrero Totémico'),
    t('subclasses', 'totem-warrior', 'desc', 'Un guerrero espiritual que obtiene poderes de espíritus animales guía. El tótem elegido — Oso, Águila o Lobo — potencia su ira y otorga percepción sobrenatural.'),

    t('subclasses', 'valor', 'name', 'Colegio del Valor'),
    t('subclasses', 'valor', 'desc', 'Bardos de batalla que entrelazan magia y proeza marcial. Inspiran a sus aliados con relatos heroicos y pueden combinar ataques con hechicería.'),

    t('subclasses', 'war', 'name', 'Dominio de la Guerra'),
    t('subclasses', 'war', 'desc', 'Clérigos de dioses de la guerra que sobresalen en combate marcial. Obtienen competencia con armadura pesada y armas marciales, y golpean guiados por favor divino.'),

    t('subclasses', 'moon', 'name', 'Círculo de la Luna'),
    t('subclasses', 'moon', 'desc', 'Druidas especializados en Forma Salvaje para combate. Pueden transformarse en bestias más poderosas y eventualmente adoptar formas elementales.'),

    t('subclasses', 'battle-master', 'name', 'Maestro de Batalla'),
    t('subclasses', 'battle-master', 'desc', 'Guerreros tácticos que emplean maniobras de combate alimentadas por dados de superioridad. Pueden desarmar, derribar y contraatacar con técnica refinada.'),

    t('subclasses', 'shadow', 'name', 'Camino de la Sombra'),
    t('subclasses', 'shadow', 'desc', 'Monjes que siguen la tradición de las artes de la sombra, usando ki para duplicar efectos de magia oscura. Pueden teletransportarse entre sombras y volverse invisibles.'),

    t('subclasses', 'vengeance', 'name', 'Juramento de Venganza'),
    t('subclasses', 'vengeance', 'desc', 'Paladines juramentados para castigar a quienes cometen pecados graves. Canalizan divinidad para obtener ventaja contra enemigos jurados y persiguen la justicia sin descanso.'),

    t('subclasses', 'beast-master', 'name', 'Maestro de Bestias'),
    t('subclasses', 'beast-master', 'desc', 'Exploradores que forjan un vínculo profundo con un compañero bestia. El compañero lucha a su lado y crece en poder junto al explorador.'),

    t('subclasses', 'assassin', 'name', 'Asesino'),
    t('subclasses', 'assassin', 'desc', 'Pícaros especializados en el arte de matar rápida y silenciosamente. Infligen daño devastador a objetivos sorprendidos y pueden asumir identidades falsas.'),

    t('subclasses', 'wild-magic', 'name', 'Magia Salvaje'),
    t('subclasses', 'wild-magic', 'desc', 'Hechiceros cuya magia innata proviene de fuerzas caóticas e impredecibles. Sus conjuros pueden desatar oleadas de magia salvaje con efectos inesperados.'),

    t('subclasses', 'great-old-one', 'name', 'El Gran Antiguo'),
    t('subclasses', 'great-old-one', 'desc', 'Brujos que sirven a una entidad ancestral de más allá de las estrellas. Obtienen habilidades telepáticas, pueden proyectar terror psíquico y crear esclavos mentales.'),

    t('subclasses', 'abjuration', 'name', 'Escuela de Abjuración'),
    t('subclasses', 'abjuration', 'desc', 'Magos especializados en magia protectora y de sala. Crean un escudo arcano que absorbe daño y pueden fortalecer hechizos de abjuración.'),
  ];
}

// ─── Skills ────────────────────────────────────────────────

function skills(): Translation[] {
  return [
    t('skills', 'acrobatics', 'name', 'Acrobacias'),
    t('skills', 'animal-handling', 'name', 'Trato con Animales'),
    t('skills', 'arcana', 'name', 'Arcanos'),
    t('skills', 'athletics', 'name', 'Atletismo'),
    t('skills', 'deception', 'name', 'Engaño'),
    t('skills', 'history', 'name', 'Historia'),
    t('skills', 'insight', 'name', 'Perspicacia'),
    t('skills', 'intimidation', 'name', 'Intimidación'),
    t('skills', 'investigation', 'name', 'Investigación'),
    t('skills', 'medicine', 'name', 'Medicina'),
    t('skills', 'nature', 'name', 'Naturaleza'),
    t('skills', 'perception', 'name', 'Percepción'),
    t('skills', 'performance', 'name', 'Interpretación'),
    t('skills', 'persuasion', 'name', 'Persuasión'),
    t('skills', 'religion', 'name', 'Religión'),
    t('skills', 'sleight-of-hand', 'name', 'Juego de Manos'),
    t('skills', 'stealth', 'name', 'Sigilo'),
    t('skills', 'survival', 'name', 'Supervivencia'),
  ];
}

// ─── Conditions ────────────────────────────────────────────

function conditions(): Translation[] {
  return [
    t('conditions', 'blinded', 'name', 'Cegado'),
    t('conditions', 'blinded', 'desc', 'Una criatura cegada no puede ver y falla automáticamente cualquier prueba de característica que requiera visión.'),

    t('conditions', 'charmed', 'name', 'Hechizado'),
    t('conditions', 'charmed', 'desc', 'Una criatura hechizada no puede atacar al encantador ni dirigirle efectos dañinos.'),

    t('conditions', 'deafened', 'name', 'Ensordecido'),
    t('conditions', 'deafened', 'desc', 'Una criatura ensordecida no puede oír y falla automáticamente cualquier prueba que requiera oído.'),

    t('conditions', 'exhaustion', 'name', 'Agotamiento'),
    t('conditions', 'exhaustion', 'desc', 'El agotamiento se mide en seis niveles. Cada nivel impone efectos cada vez más severos.'),

    t('conditions', 'frightened', 'name', 'Asustado'),
    t('conditions', 'frightened', 'desc', 'Una criatura asustada tiene desventaja en pruebas de característica y tiradas de ataque mientras la fuente de su miedo esté visible.'),

    t('conditions', 'grappled', 'name', 'Agarrado'),
    t('conditions', 'grappled', 'desc', 'La velocidad de una criatura agarrada se reduce a 0 y no puede beneficiarse de bonificadores de velocidad.'),

    t('conditions', 'incapacitated', 'name', 'Incapacitado'),
    t('conditions', 'incapacitated', 'desc', 'Una criatura incapacitada no puede realizar acciones ni reacciones.'),

    t('conditions', 'invisible', 'name', 'Invisible'),
    t('conditions', 'invisible', 'desc', 'Una criatura invisible no puede ser vista sin el uso de magia o un sentido especial.'),

    t('conditions', 'paralyzed', 'name', 'Paralizado'),
    t('conditions', 'paralyzed', 'desc', 'Una criatura paralizada está incapacitada y no puede moverse ni hablar.'),

    t('conditions', 'petrified', 'name', 'Petrificado'),
    t('conditions', 'petrified', 'desc', 'Una criatura petrificada es transformada en una sustancia sólida inanimada.'),

    t('conditions', 'poisoned', 'name', 'Envenenado'),
    t('conditions', 'poisoned', 'desc', 'Una criatura envenenada tiene desventaja en tiradas de ataque y pruebas de característica.'),

    t('conditions', 'prone', 'name', 'Derribado'),
    t('conditions', 'prone', 'desc', 'Una criatura derribada solo puede arrastrarse o ponerse de pie.'),

    t('conditions', 'restrained', 'name', 'Apresado'),
    t('conditions', 'restrained', 'desc', 'La velocidad de una criatura apresada se reduce a 0 y no puede beneficiarse de bonificadores de velocidad.'),

    t('conditions', 'stunned', 'name', 'Aturdido'),
    t('conditions', 'stunned', 'desc', 'Una criatura aturdida está incapacitada, no puede moverse y solo puede hablar con titubeos.'),

    t('conditions', 'unconscious', 'name', 'Inconsciente'),
    t('conditions', 'unconscious', 'desc', 'Una criatura inconsciente está incapacitada, no puede moverse ni hablar, y no es consciente de su entorno.'),
  ];
}

// ─── Damage Types ──────────────────────────────────────────

function damageTypes(): Translation[] {
  return [
    t('damage-types', 'acid', 'name', 'Ácido'),
    t('damage-types', 'bludgeoning', 'name', 'Contundente'),
    t('damage-types', 'cold', 'name', 'Frío'),
    t('damage-types', 'fire', 'name', 'Fuego'),
    t('damage-types', 'force', 'name', 'Fuerza'),
    t('damage-types', 'lightning', 'name', 'Relámpago'),
    t('damage-types', 'necrotic', 'name', 'Necrótico'),
    t('damage-types', 'piercing', 'name', 'Perforante'),
    t('damage-types', 'poison', 'name', 'Veneno'),
    t('damage-types', 'psychic', 'name', 'Psíquico'),
    t('damage-types', 'radiant', 'name', 'Radiante'),
    t('damage-types', 'slashing', 'name', 'Cortante'),
    t('damage-types', 'thunder', 'name', 'Trueno'),
  ];
}

// ─── Magic Schools ─────────────────────────────────────────

function magicSchools(): Translation[] {
  return [
    t('magic-schools', 'abjuration', 'name', 'Abjuración'),
    t('magic-schools', 'conjuration', 'name', 'Conjuración'),
    t('magic-schools', 'divination', 'name', 'Adivinación'),
    t('magic-schools', 'enchantment', 'name', 'Encantamiento'),
    t('magic-schools', 'evocation', 'name', 'Evocación'),
    t('magic-schools', 'illusion', 'name', 'Ilusión'),
    t('magic-schools', 'necromancy', 'name', 'Nigromancia'),
    t('magic-schools', 'transmutation', 'name', 'Transmutación'),
  ];
}

// ─── Languages ─────────────────────────────────────────────

function languages(): Translation[] {
  return [
    t('languages', 'common', 'name', 'Común'),
    t('languages', 'dwarvish', 'name', 'Enano'),
    t('languages', 'elvish', 'name', 'Élfico'),
    t('languages', 'giant', 'name', 'Gigante'),
    t('languages', 'gnomish', 'name', 'Gnomo'),
    t('languages', 'goblin', 'name', 'Goblin'),
    t('languages', 'halfling', 'name', 'Mediano'),
    t('languages', 'orc', 'name', 'Orco'),
    t('languages', 'abyssal', 'name', 'Abisal'),
    t('languages', 'celestial', 'name', 'Celestial'),
    t('languages', 'draconic', 'name', 'Dracónico'),
    t('languages', 'deep-speech', 'name', 'Habla Profunda'),
    t('languages', 'infernal', 'name', 'Infernal'),
    t('languages', 'primordial', 'name', 'Primordial'),
    t('languages', 'sylvan', 'name', 'Silvano'),
    t('languages', 'undercommon', 'name', 'Infracomún'),
  ];
}

// ─── Backgrounds ───────────────────────────────────────────

function backgrounds(): Translation[] {
  return [
    t('backgrounds', 'acolyte', 'name', 'Acólito'),
    t('backgrounds', 'acolyte', 'desc', 'Has pasado tu vida al servicio de un templo de un dios específico o panteón de dioses.'),

    t('backgrounds', 'soldier', 'name', 'Soldado'),
    t('backgrounds', 'soldier', 'desc', 'Has combatido en guerras y conoces la disciplina militar. Los soldados aún reconocen tu rango y autoridad.'),

    t('backgrounds', 'criminal', 'name', 'Criminal'),
    t('backgrounds', 'criminal', 'desc', 'Tienes un historial de infringir la ley y un contacto confiable en una red de otros criminales.'),

    t('backgrounds', 'sage', 'name', 'Sabio'),
    t('backgrounds', 'sage', 'desc', 'Has dedicado años al estudio del conocimiento. Cuando no sabes algo, sabes dónde y de quién obtener la información.'),

    t('backgrounds', 'outlander', 'name', 'Forastero'),
    t('backgrounds', 'outlander', 'desc', 'Creciste en los páramos, lejos de la civilización. Tienes excelente memoria para mapas y geografía.'),

    t('backgrounds', 'noble', 'name', 'Noble'),
    t('backgrounds', 'noble', 'desc', 'Naciste en la nobleza. La gente se inclina a pensar lo mejor de ti y eres bienvenido en la alta sociedad.'),

    t('backgrounds', 'hermit', 'name', 'Ermitaño'),
    t('backgrounds', 'hermit', 'desc', 'Has vivido en reclusión por un período formativo de tu vida. En tu aislamiento, descubriste una verdad única y poderosa.'),
  ];
}

// ─── Weapon Properties ─────────────────────────────────────

function weaponProperties(): Translation[] {
  return [
    t('weapon-properties', 'ammunition', 'name', 'Munición'),
    t('weapon-properties', 'finesse', 'name', 'Sutil'),
    t('weapon-properties', 'heavy', 'name', 'Pesada'),
    t('weapon-properties', 'light', 'name', 'Ligera'),
    t('weapon-properties', 'loading', 'name', 'Recarga'),
    t('weapon-properties', 'reach', 'name', 'Alcance'),
    t('weapon-properties', 'special', 'name', 'Especial'),
    t('weapon-properties', 'thrown', 'name', 'Arrojadiza'),
    t('weapon-properties', 'two-handed', 'name', 'A Dos Manos'),
    t('weapon-properties', 'versatile', 'name', 'Versátil'),
  ];
}
