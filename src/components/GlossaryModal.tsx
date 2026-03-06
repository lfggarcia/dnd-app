import React, { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Pressable,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useI18n } from '../i18n';
import type { Lang } from '../i18n';
import { getResourcesByEndpoint, getResourceCount } from '../database';
import { getTranslatedName, getTranslatedField } from '../services/translationBridge';
import { syncEndpoint } from '../services/syncService';
import type { ApiEndpoint } from '../services/api5e';
import {
  StatsIcon,
  DnaIcon,
  SwordIcon,
  SkullIcon,
  GearIcon,
  ScaleIcon,
  BookIcon,
  SearchIcon,
} from './Icons';

type GlossaryCategory =
  | 'stats'
  | 'races'
  | 'classes'
  | 'monsters'
  | 'mechanics'
  | 'alignments';

type GlossaryEntry = { key: string; name: string; desc: string };

const CATEGORY_ICONS: Record<GlossaryCategory, (active: boolean) => ReactNode> = {
  stats: (a) => <StatsIcon size={12} color={a ? '#00FF41' : 'rgba(0,255,65,0.5)'} />,
  races: (a) => <DnaIcon size={12} color={a ? '#00FF41' : 'rgba(0,255,65,0.5)'} />,
  classes: (a) => <SwordIcon size={12} color={a ? '#00FF41' : 'rgba(0,255,65,0.5)'} />,
  monsters: (a) => <SkullIcon size={12} color={a ? '#FF3E3E' : 'rgba(255,62,62,0.5)'} />,
  mechanics: (a) => <GearIcon size={12} color={a ? '#00FF41' : 'rgba(0,255,65,0.5)'} />,
  alignments: (a) => <ScaleIcon size={12} color={a ? '#00FF41' : 'rgba(0,255,65,0.5)'} />,
};

const CATEGORIES: GlossaryCategory[] = [
  'stats',
  'races',
  'classes',
  'monsters',
  'mechanics',
  'alignments',
];

const DB_ENDPOINTS: Partial<Record<GlossaryCategory, ApiEndpoint>> = {
  races: 'races',
  classes: 'classes',
  monsters: 'monsters',
  alignments: 'alignments',
};

const I18N_KEYS: Partial<Record<GlossaryCategory, string[]>> = {
  stats: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
  mechanics: [
    'seed',
    'cycle',
    'floor',
    'ac',
    'd20',
    'modifier',
    'hp',
    'xp',
    'rivalry',
    'rarity',
  ],
};

// ─── Description builders for DB-backed categories ───────────

function buildRaceDesc(raw: Record<string, unknown>, lang: Lang): string {
  const size = (raw.size as string) ?? '';
  const speed = (raw.speed as number) ?? 30;
  const bonuses = ((raw.ability_bonuses as any[]) ?? [])
    .map((b: any) => `+${b.bonus} ${b.ability_score?.name ?? ''}`)
    .join(', ');
  const traitNames = ((raw.traits as any[]) ?? [])
    .map((t: any) => t.name)
    .join(', ');
  const lb =
    lang === 'es'
      ? { size: 'Tamaño', speed: 'Velocidad', traits: 'Rasgos' }
      : { size: 'Size', speed: 'Speed', traits: 'Traits' };
  let d = `${lb.size}: ${size} · ${lb.speed}: ${speed}ft`;
  if (bonuses) d += ` · ${bonuses}`;
  if (traitNames) d += `\n${lb.traits}: ${traitNames}`;
  return d;
}

function buildClassDesc(raw: Record<string, unknown>, lang: Lang): string {
  const hitDie = raw.hit_die as number | undefined;
  if (!hitDie) return '';
  const saves = ((raw.saving_throws as any[]) ?? [])
    .map((s: any) => s.name)
    .join(', ');
  const lb =
    lang === 'es'
      ? { hd: 'Dado de golpe', sv: 'Salvaciones' }
      : { hd: 'Hit Die', sv: 'Saving Throws' };
  let d = `${lb.hd}: d${hitDie}`;
  if (saves) d += ` · ${lb.sv}: ${saves}`;
  return d;
}

function buildMonsterDesc(raw: Record<string, unknown>): string {
  if (!raw.hit_points) return '';
  const type = (raw.type as string) ?? '';
  const size = (raw.size as string) ?? '';
  const cr = raw.challenge_rating;
  const hp = raw.hit_points as number;
  const acArr = raw.armor_class as any[];
  const ac = acArr?.[0]?.value ?? '?';
  return `CR ${cr ?? '?'} · ${size} ${type} · HP ${hp} · AC ${ac}`;
}

function buildAlignmentDesc(
  raw: Record<string, unknown>,
  lang: Lang,
  indexKey: string,
): string {
  const translated = getTranslatedField('alignments', indexKey, 'desc', lang);
  if (translated) return translated;
  return (raw.desc as string) ?? '';
}

type DescBuilder = (
  raw: Record<string, unknown>,
  lang: Lang,
  indexKey: string,
) => string;

const DESC_BUILDERS: Record<string, DescBuilder> = {
  races: (raw, lang) => buildRaceDesc(raw, lang),
  classes: (raw, lang) => buildClassDesc(raw, lang),
  monsters: (raw) => buildMonsterDesc(raw),
  alignments: (raw, lang, idx) => buildAlignmentDesc(raw, lang, idx),
};

// ─── Detect if a resource has full detail data ───────────────

function hasFullData(endpoint: ApiEndpoint): boolean {
  const resources = getResourcesByEndpoint(endpoint);
  if (resources.length === 0) return false;
  const first = JSON.parse(resources[0].data) as Record<string, unknown>;
  // list-only data has only {index, name, url}
  const keys = Object.keys(first);
  return keys.length > 3;
}

// ─── Component ───────────────────────────────────────────────

export const GlossaryModal = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) => {
  const { t, lang, setLang } = useI18n();
  const [activeCategory, setActiveCategory] =
    useState<GlossaryCategory>('stats');
  const [search, setSearch] = useState('');
  const [dbEntries, setDbEntries] = useState<GlossaryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Load DB entries when category or lang changes
  useEffect(() => {
    const endpoint = DB_ENDPOINTS[activeCategory];
    if (!endpoint) {
      setDbEntries([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      let count = getResourceCount(endpoint);

      // If no data at all, full sync
      if (count === 0) {
        try {
          await syncEndpoint(endpoint);
        } catch {
          /* sync error — show empty */
        }
      } else if (!hasFullData(endpoint)) {
        // Has list data only — fetch full details
        try {
          await syncEndpoint(endpoint, { force: true });
        } catch {
          /* continue with list data */
        }
      }

      if (cancelled) return;

      const resources = getResourcesByEndpoint(endpoint);
      const builder = DESC_BUILDERS[activeCategory];

      const entries: GlossaryEntry[] = resources.map((r) => {
        const raw = JSON.parse(r.data) as Record<string, unknown>;
        const name = getTranslatedName(endpoint, r.index_key, lang);
        const desc = builder
          ? builder(raw, lang, r.index_key)
          : '';
        return { key: r.index_key, name, desc };
      });

      entries.sort((a, b) => a.name.localeCompare(b.name));

      if (!cancelled) {
        setDbEntries(entries);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, lang]);

  // Merge i18n and DB entries, apply search filter
  const entries = useMemo(() => {
    let items: GlossaryEntry[];
    const i18nKeys = I18N_KEYS[activeCategory];

    if (i18nKeys) {
      items = i18nKeys.map((key) => ({
        key,
        name: t(`glossary.${activeCategory}.${key}.name`),
        desc: t(`glossary.${activeCategory}.${key}.desc`),
      }));
    } else {
      items = dbEntries;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      return items.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.desc.toLowerCase().includes(q) ||
          e.key.toLowerCase().includes(q),
      );
    }

    return items;
  }, [activeCategory, dbEntries, search, t]);

  if (!visible) return null;

  const { height: screenHeight } = Dimensions.get('window');

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: screenHeight,
        backgroundColor: '#0A0E0A',
        zIndex: 999999,
        elevation: 999999,
      }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0,255,65,0.4)',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: '#00FF41', fontFamily: 'RobotoMono', fontSize: 14 }}>
              ✕ {t('common.close')}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <BookIcon size={14} color="#00FF41" />
            <Text style={{ color: '#00FF41', fontFamily: 'RobotoMono', fontSize: 14, fontWeight: 'bold', marginLeft: 6 }}>
              {t('glossary.title')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setLang(lang === 'es' ? 'en' : 'es')}
            style={{
              borderWidth: 1,
              borderColor: 'rgba(0,229,255,0.5)',
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: '#00E5FF', fontFamily: 'RobotoMono', fontSize: 12, fontWeight: 'bold' }}>
              {lang === 'es' ? 'EN' : 'ES'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0,255,65,0.2)',
          }}
        >
          <View
            style={{
              borderWidth: 1,
              borderColor: 'rgba(0,255,65,0.3)',
              backgroundColor: 'rgba(26,46,26,0.2)',
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <SearchIcon size={14} color="rgba(0,255,65,0.4)" />
            <TextInput
              style={{
                flex: 1,
                color: '#00FF41',
                fontFamily: 'RobotoMono',
                fontSize: 14,
                height: 24,
                padding: 0,
              }}
              value={search}
              onChangeText={setSearch}
              placeholder={t('glossary.searchPlaceholder')}
              placeholderTextColor="rgba(0,255,65,0.3)"
            />
          </View>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.2)', maxHeight: 48 }}
          contentContainerStyle={{ paddingHorizontal: 8 }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  marginRight: 4,
                  borderBottomWidth: isActive ? 2 : 0,
                  borderBottomColor: '#00FF41',
                  backgroundColor: isActive ? 'rgba(0,255,65,0.1)' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'RobotoMono',
                    fontSize: 12,
                    color: isActive ? '#00FF41' : 'rgba(0,255,65,0.5)',
                    fontWeight: isActive ? 'bold' : 'normal',
                  }}
                >
                  {t(`glossary.categories.${cat}`)}
                </Text>
                <View style={{ marginRight: 5 }}>
                  {CATEGORY_ICONS[cat](isActive)}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Entries */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {loading && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator color="#00FF41" size="small" />
              <Text
                style={{
                  color: 'rgba(0,255,65,0.5)',
                  fontFamily: 'RobotoMono',
                  fontSize: 12,
                  marginTop: 8,
                }}
              >
                {t('glossary.loading')}
              </Text>
            </View>
          )}
          {!loading &&
            entries.map((entry) => (
            <View
              key={entry.key}
              style={{
                borderWidth: 1,
                borderColor: 'rgba(0,255,65,0.2)',
                padding: 12,
                marginBottom: 8,
                backgroundColor: 'rgba(26,46,26,0.1)',
              }}
            >
              <Text
                style={{
                  color: '#00FF41',
                  fontFamily: 'RobotoMono',
                  fontSize: 14,
                  fontWeight: 'bold',
                  marginBottom: 4,
                }}
              >
                {entry.name}
              </Text>
              <Text
                style={{
                  color: 'rgba(0,255,65,0.7)',
                  fontFamily: 'RobotoMono',
                  fontSize: 12,
                  lineHeight: 20,
                }}
              >
                {entry.desc}
              </Text>
            </View>
          ))}
          {!loading && entries.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ color: 'rgba(0,255,65,0.3)', fontFamily: 'RobotoMono', fontSize: 14 }}>
                —
              </Text>
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

/** Self-contained glossary floating button — manages its own modal */
export const GlossaryButton = ({ onPress, bottomOffset }: { onPress?: () => void; bottomOffset?: number }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {showModal && (
        <GlossaryModal visible={true} onClose={() => setShowModal(false)} />
      )}
      <Pressable
        onPress={() => {
          setShowModal(true);
          onPress?.();
        }}
        style={{
          position: 'absolute',
          bottom: bottomOffset ?? 56,
          right: 16,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: 'rgba(0,255,65,0.25)',
          borderWidth: 1.5,
          borderColor: 'rgba(0,255,65,0.7)',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          elevation: 99999,
        }}
      >
        <BookIcon size={20} color="#00FF41" />
      </Pressable>
    </>
  );
};
