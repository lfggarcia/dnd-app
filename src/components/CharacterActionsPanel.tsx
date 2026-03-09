import React, { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  COMBAT_ACTIONS,
  CLASS_ACTIONS,
  RACE_ACTIONS,
  SUBCLASS_ACTIONS,
  type ActionEntry,
  type ActionChoice,
} from '../constants/dnd5eLevel1';
import type { Lang } from '../i18n';
import {
  SwordIcon,
  TargetIcon,
  DnaIcon,
  TridentIcon,
  ClipboardIcon,
  WarningIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
  RadioDotIcon,
} from './Icons';

// ─── Types ────────────────────────────────────────────────

type ActionCategory = {
  key: string;
  icon: ReactNode;
  labelEn: string;
  labelEs: string;
  actions: ActionEntry[];
  borderColor: string;
  textColor: string;
  badgeColor: string;
};

type Props = {
  race: string;
  charClass: string;
  subclass: string;
  lang: Lang;
  featureChoices: Record<string, string | string[]>;
  onChoiceSelect: (choiceKey: string, value: string | string[]) => void;
};

// ─── Type badge colors ────────────────────────────────────

const TYPE_COLORS: Record<ActionEntry['type'], { bg: string; text: string; labelEn: string; labelEs: string }> = {
  action:   { bg: 'rgba(0,255,65,0.15)',  text: 'rgba(0,255,65,0.8)',  labelEn: 'ACTION',   labelEs: 'ACCIÓN' },
  bonus:    { bg: 'rgba(255,176,0,0.15)',  text: 'rgba(255,176,0,0.8)', labelEn: 'BONUS',    labelEs: 'ADICIONAL' },
  reaction: { bg: 'rgba(255,62,62,0.15)',  text: 'rgba(255,62,62,0.8)', labelEn: 'REACTION', labelEs: 'REACCIÓN' },
  passive:  { bg: 'rgba(0,229,255,0.12)',  text: 'rgba(0,229,255,0.7)', labelEn: 'PASSIVE',  labelEs: 'PASIVA' },
  special:  { bg: 'rgba(178,102,255,0.15)', text: 'rgba(178,102,255,0.8)', labelEn: 'SPECIAL', labelEs: 'ESPECIAL' },
};

// ─── Stable Styles ────────────────────────────────────────

const S = StyleSheet.create({
  actionName: { fontFamily: 'RobotoMono-Bold', fontSize: 10 },
  actionDesc: { fontFamily: 'RobotoMono-Regular', fontSize: 9, lineHeight: 13 },
  categoryLabel: { fontFamily: 'RobotoMono-Bold', fontSize: 10 },
  badgeText: { fontFamily: 'RobotoMono-Bold', fontSize: 7 },
  countText: { fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,255,65,0.4)' },
  chevron: { fontFamily: 'RobotoMono-Bold', fontSize: 10 },
});

// ─── Choice Option ────────────────────────────────────────

const ChoiceOption = memo(({ choice, selected, lang, multi, onChoicePress }: {
  choice: ActionChoice;
  selected: boolean;
  lang: Lang;
  multi: boolean;
  onChoicePress: (id: string) => void;
}) => (
  <TouchableOpacity
    onPress={() => onChoicePress(choice.id)}
    style={[
      choiceStyles.option,
      selected && choiceStyles.optionSelected,
    ]}
  >
    <View className="flex-row items-center">
      <View style={[
        choiceStyles.radio,
        multi ? choiceStyles.checkbox : undefined,
        selected && choiceStyles.radioSelected,
      ]}>
        {selected && (
          multi
            ? <CheckIcon size={8} color="rgba(0,255,65,0.9)" />
            : <RadioDotIcon size={8} color="rgba(0,255,65,0.9)" />
        )}
      </View>
      <Text style={[S.actionName, { color: selected ? 'rgba(0,255,65,0.95)' : 'rgba(255,255,255,0.7)', flex: 1 }]}>
        {lang === 'es' ? choice.es : choice.en}
      </Text>
    </View>
    <Text style={[S.actionDesc, { color: selected ? 'rgba(0,255,65,0.5)' : 'rgba(255,255,255,0.35)', marginLeft: 22, marginTop: 2 }]}>
      {lang === 'es' ? choice.descEs : choice.descEn}
    </Text>
  </TouchableOpacity>
));

const choiceStyles = StyleSheet.create({
  option: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  optionSelected: {
    borderColor: 'rgba(0,255,65,0.5)',
    backgroundColor: 'rgba(0,255,65,0.07)',
  },
  radio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checkbox: {
    borderRadius: 3,
  },
  radioSelected: {
    borderColor: 'rgba(0,255,65,0.8)',
  },
  radioCheck: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 8,
    color: 'rgba(0,255,65,0.9)',
    marginTop: -1,
  },
});

// ─── Action Item ──────────────────────────────────────────

const ActionItem = memo(({ action, lang, featureChoices, onChoiceSelect }: {
  action: ActionEntry;
  lang: Lang;
  featureChoices: Record<string, string | string[]>;
  onChoiceSelect: (choiceKey: string, value: string | string[]) => void;
}) => {
  const typeInfo = TYPE_COLORS[action.type];
  const hasChoices = action.choices && action.choices.length > 0 && action.choiceKey;
  const isMulti = action.choiceKey === 'rogue-expertise';
  const maxSelections = isMulti ? 2 : 1;
  const currentSelection = hasChoices ? featureChoices[action.choiceKey!] : undefined;

  const handleChoicePress = useCallback((choiceId: string) => {
    if (!action.choiceKey) return;
    if (isMulti) {
      const arr = Array.isArray(currentSelection) ? [...currentSelection] : [];
      const idx = arr.indexOf(choiceId);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else if (arr.length < maxSelections) {
        arr.push(choiceId);
      }
      onChoiceSelect(action.choiceKey, arr);
    } else {
      const cur = typeof currentSelection === 'string' ? currentSelection : '';
      onChoiceSelect(action.choiceKey, cur === choiceId ? '' : choiceId);
    }
  }, [action.choiceKey, currentSelection, isMulti, maxSelections, onChoiceSelect]);

  const isSelected = useCallback((id: string) => {
    if (Array.isArray(currentSelection)) return currentSelection.includes(id);
    return currentSelection === id;
  }, [currentSelection]);

  const needsSelection = hasChoices && (
    isMulti
      ? !Array.isArray(currentSelection) || currentSelection.length < maxSelections
      : !currentSelection
  );

  return (
    <View className="mb-2 border border-primary/10 rounded-sm bg-background/40 p-2">
      <View className="flex-row items-center mb-1">
        <View style={{ backgroundColor: typeInfo.bg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2, marginRight: 6 }}>
          <Text style={[S.badgeText, { color: typeInfo.text }]}>
            {lang === 'es' ? typeInfo.labelEs : typeInfo.labelEn}
          </Text>
        </View>
        <Text style={[S.actionName, { color: typeInfo.text, flex: 1 }]}>
          {lang === 'es' ? action.es : action.en}
        </Text>
        {hasChoices && needsSelection && (
          <View style={{ backgroundColor: 'rgba(255,176,0,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2, flexDirection: 'row', alignItems: 'center' }}>
            <WarningIcon size={9} color="rgba(255,176,0,0.9)" />
            <Text style={[S.badgeText, { color: 'rgba(255,176,0,0.9)', marginLeft: 3 }]}>
              {lang === 'es' ? 'ELIGE' : 'PICK'}
            </Text>
          </View>
        )}
      </View>
      <Text style={[S.actionDesc, { color: 'rgba(255,255,255,0.5)' }]}>
        {lang === 'es' ? action.descEs : action.descEn}
      </Text>
      {hasChoices && (
        <View style={{ marginTop: 6 }}>
          {isMulti && (
            <Text style={[S.actionDesc, { color: 'rgba(255,176,0,0.6)', marginBottom: 4 }]}>
              {lang === 'es'
                ? `Selecciona ${maxSelections} (${Array.isArray(currentSelection) ? currentSelection.length : 0}/${maxSelections})`
                : `Select ${maxSelections} (${Array.isArray(currentSelection) ? currentSelection.length : 0}/${maxSelections})`}
            </Text>
          )}
          {action.choices!.map(c => (
            <ChoiceOption
              key={c.id}
              choice={c}
              selected={isSelected(c.id)}
              lang={lang}
              multi={isMulti}
              onChoicePress={handleChoicePress}
            />
          ))}
        </View>
      )}
    </View>
  );
});

// ─── Collapsible Category ─────────────────────────────────

const ActionCategorySection = memo(({ category, lang, defaultOpen, featureChoices, onChoiceSelect }: {
  category: ActionCategory;
  lang: Lang;
  defaultOpen: boolean;
  featureChoices: Record<string, string | string[]>;
  onChoiceSelect: (choiceKey: string, value: string | string[]) => void;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasUnresolved = category.actions.some(a => {
    if (!a.choices?.length || !a.choiceKey) return false;
    const sel = featureChoices[a.choiceKey];
    if (a.choiceKey === 'rogue-expertise') return !Array.isArray(sel) || sel.length < 2;
    return !sel;
  });

  return (
    <View className="mb-3">
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        className="flex-row items-center justify-between py-2 px-1"
        style={{ borderBottomWidth: 1, borderBottomColor: category.borderColor }}
      >
        <View className="flex-row items-center flex-1">
          <View style={{ marginRight: 6 }}>{category.icon}</View>
          <Text style={[S.categoryLabel, { color: category.textColor }]}>
            {lang === 'es' ? category.labelEs : category.labelEn}
          </Text>
          <Text style={[S.countText, { marginLeft: 6 }]}>
            ({category.actions.length})
          </Text>
          {hasUnresolved && (
            <View style={{ marginLeft: 6 }}><WarningIcon size={9} color="rgba(255,176,0,0.8)" /></View>
          )}
        </View>
        {open
          ? <ChevronDownIcon size={10} color={category.textColor} />
          : <ChevronRightIcon size={10} color={category.textColor} />}
      </TouchableOpacity>
      {open && (
        <View className="mt-2">
          {category.actions.map((a, i) => (
            <ActionItem
              key={`${a.en}-${i}`}
              action={a}
              lang={lang}
              featureChoices={featureChoices}
              onChoiceSelect={onChoiceSelect}
            />
          ))}
        </View>
      )}
    </View>
  );
});

// ─── Main Panel ───────────────────────────────────────────

export const CharacterActionsPanel = memo(({ race, charClass, subclass, lang, featureChoices, onChoiceSelect }: Props) => {
  const categories = useMemo<ActionCategory[]>(() => {
    const cats: ActionCategory[] = [];

    // 1. Combat (universal)
    cats.push({
      key: 'combat',
      icon: <SwordIcon size={12} color="rgba(0,255,65,0.9)" />,
      labelEn: 'COMBAT ACTIONS',
      labelEs: 'ACCIONES DE COMBATE',
      actions: COMBAT_ACTIONS,
      borderColor: 'rgba(0,255,65,0.3)',
      textColor: 'rgba(0,255,65,0.9)',
      badgeColor: 'rgba(0,255,65,0.15)',
    });

    // 2. Class
    const classActs = CLASS_ACTIONS[charClass];
    if (classActs?.length) {
      cats.push({
        key: 'class',
        icon: <TargetIcon size={12} color="rgba(255,176,0,0.9)" />,
        labelEn: 'CLASS ABILITIES',
        labelEs: 'HABILIDADES DE CLASE',
        actions: classActs,
        borderColor: 'rgba(255,176,0,0.3)',
        textColor: 'rgba(255,176,0,0.9)',
        badgeColor: 'rgba(255,176,0,0.15)',
      });
    }

    // 3. Racial
    const raceActs = RACE_ACTIONS[race];
    if (raceActs?.length) {
      cats.push({
        key: 'race',
        icon: <DnaIcon size={12} color="rgba(0,229,255,0.9)" />,
        labelEn: 'RACIAL ABILITIES',
        labelEs: 'HABILIDADES RACIALES',
        actions: raceActs,
        borderColor: 'rgba(0,229,255,0.3)',
        textColor: 'rgba(0,229,255,0.9)',
        badgeColor: 'rgba(0,229,255,0.15)',
      });
    }

    // 4. Subclass (only if has lv1 features)
    const subActs = SUBCLASS_ACTIONS[subclass];
    if (subActs?.length) {
      cats.push({
        key: 'subclass',
        icon: <TridentIcon size={12} color="rgba(178,102,255,0.9)" />,
        labelEn: 'SUBCLASS FEATURES',
        labelEs: 'RASGOS DE SUBCLASE',
        actions: subActs,
        borderColor: 'rgba(178,102,255,0.3)',
        textColor: 'rgba(178,102,255,0.9)',
        badgeColor: 'rgba(178,102,255,0.15)',
      });
    }

    return cats;
  }, [race, charClass, subclass]);

  const totalActions = useMemo(
    () => categories.reduce((sum, c) => sum + c.actions.length, 0),
    [categories],
  );

  return (
    <View className="mb-5 border border-primary/30 rounded-md bg-muted/10 p-4">
      <View className="flex-row items-center justify-between mb-1">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ClipboardIcon size={14} color="rgba(0,255,65,0.9)" />
          <Text style={{ marginLeft: 6 }} className="text-primary font-robotomono text-sm font-bold">
            {lang === 'es' ? 'ACCIONES DISPONIBLES' : 'AVAILABLE ACTIONS'}
          </Text>
        </View>
        <View style={{ backgroundColor: 'rgba(0,255,65,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 }}>
          <Text style={[S.countText, { color: 'rgba(0,255,65,0.7)' }]}>
            {totalActions} {lang === 'es' ? 'total' : 'total'}
          </Text>
        </View>
      </View>
      <Text className="text-primary/50 font-robotomono text-xs mb-3">
        {lang === 'es'
          ? 'Todas las acciones que tu personaje puede realizar en nivel 1'
          : 'All actions your character can perform at level 1'}
      </Text>

      {categories.map((cat, i) => (
        <ActionCategorySection
          key={cat.key}
          category={cat}
          lang={lang}
          defaultOpen={i !== 0}
          featureChoices={featureChoices}
          onChoiceSelect={onChoiceSelect}
        />
      ))}
    </View>
  );
});
