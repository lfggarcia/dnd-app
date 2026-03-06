import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { useI18n } from '../i18n';
import type { Lang } from '../i18n';

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
    const raw = t(`glossary.${activeCategory}`) as any;
    // Since t() returns string for leaf nodes, we need to fetch manually
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

  const entries = getEntries();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background/95">
        {/* Header */}
        <View className="p-4 border-b border-primary/40 flex-row justify-between items-center">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-primary font-robotomono text-sm">✕ {t('common.close')}</Text>
          </TouchableOpacity>
          <Text className="text-primary font-robotomono text-sm font-bold">
            📖 {t('glossary.title')}
          </Text>
          {/* Language toggle */}
          <TouchableOpacity
            onPress={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="border border-accent/50 px-2 py-1"
          >
            <Text className="text-accent font-robotomono text-xs font-bold">
              {lang === 'es' ? 'EN' : 'ES'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="px-4 py-2 border-b border-primary/20">
          <View className="border border-primary/30 bg-muted/20 px-3 py-2 flex-row items-center">
            <Text className="text-primary/40 mr-2">🔍</Text>
            <TextInput
              className="flex-1 text-primary font-robotomono text-sm h-6 p-0"
              value={search}
              onChangeText={setSearch}
              placeholder={t('glossary.searchPlaceholder')}
              placeholderTextColor="#00FF4130"
            />
          </View>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-primary/20"
          contentContainerStyle={{ paddingHorizontal: 8 }}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat)}
                className={`px-4 py-3 mr-1 ${isActive ? 'border-b-2 border-primary bg-primary/10' : ''}`}
              >
                <Text
                  className={`font-robotomono text-xs ${isActive ? 'text-primary font-bold' : 'text-primary/50'}`}
                >
                  {CATEGORY_ICONS[cat]} {t(`glossary.categories.${cat}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Entries */}
        <ScrollView
          className="flex-1 px-4 py-2"
          showsVerticalScrollIndicator={false}
        >
          {entries.map((entry) => (
            <View
              key={entry.key}
              className="border border-primary/20 p-3 mb-2 bg-muted/10"
            >
              <Text className="text-primary font-robotomono text-sm font-bold mb-1">
                {entry.name}
              </Text>
              <Text className="text-primary/70 font-robotomono text-xs leading-5">
                {entry.desc}
              </Text>
            </View>
          ))}
          {entries.length === 0 && (
            <View className="items-center py-8">
              <Text className="text-primary/30 font-robotomono text-sm">
                —
              </Text>
            </View>
          )}
          <View className="h-8" />
        </ScrollView>
      </View>
    </Modal>
  );
};

/** Floating button to open glossary from any screen */
export const GlossaryButton = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute bottom-6 right-4 w-12 h-12 bg-primary/20 border border-primary/60 rounded-full items-center justify-center z-50"
      activeOpacity={0.7}
    >
      <Text className="text-primary text-lg">📖</Text>
    </TouchableOpacity>
  );
};
