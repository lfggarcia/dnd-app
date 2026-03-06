import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Pressable,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useI18n } from '../i18n';

type GlossaryCategory = 'stats' | 'races' | 'classes' | 'mechanics' | 'alignments';

const CATEGORY_ICONS: Record<GlossaryCategory, string> = {
  stats: '📊',
  races: '🧬',
  classes: '⚔',
  mechanics: '⚙',
  alignments: '⚖',
};

export const GlossaryModal = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) => {
  const { t, lang, setLang } = useI18n();
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory>('stats');
  const [search, setSearch] = useState('');

  const categories: GlossaryCategory[] = [
    'stats',
    'races',
    'classes',
    'mechanics',
    'alignments',
  ];

  const getEntries = (): { key: string; name: string; desc: string }[] => {
    const entries: { key: string; name: string; desc: string }[] = [];

    const termKeys: Record<GlossaryCategory, string[]> = {
      stats: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
      races: ['HUMAN', 'ELF', 'DWARF', 'HALFLING', 'HALF-ORC', 'TIEFLING'],
      classes: ['FIGHTER', 'ROGUE', 'WIZARD', 'CLERIC', 'RANGER', 'WARLOCK'],
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
      alignments: ['LG', 'NG', 'CG', 'LN', 'TN', 'CN', 'LE', 'NE', 'CE'],
    };

    for (const key of termKeys[activeCategory]) {
      const name = t(`glossary.${activeCategory}.${key}.name`);
      const desc = t(`glossary.${activeCategory}.${key}.desc`);
      entries.push({ key, name, desc });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      return entries.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.desc.toLowerCase().includes(q) ||
          e.key.toLowerCase().includes(q),
      );
    }

    return entries;
  };

  if (!visible) return null;

  const entries = getEntries();
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
          <Text style={{ color: '#00FF41', fontFamily: 'RobotoMono', fontSize: 14, fontWeight: 'bold' }}>
            📖 {t('glossary.title')}
          </Text>
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
            <Text style={{ color: 'rgba(0,255,65,0.4)', marginRight: 8 }}>🔍</Text>
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
          {categories.map((cat) => {
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
                  {CATEGORY_ICONS[cat]} {t(`glossary.categories.${cat}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Entries */}
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {entries.map((entry) => (
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
          {entries.length === 0 && (
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
export const GlossaryButton = ({ onPress }: { onPress?: () => void }) => {
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
          bottom: 24,
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
        <Text style={{ fontSize: 20 }}>📖</Text>
      </Pressable>
    </>
  );
};
