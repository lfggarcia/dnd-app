import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  Modal, StyleSheet, ActivityIndicator,
} from 'react-native';
import { AppImage } from '../AppImage';
import type { Lang } from '../../i18n';
import {
  getCatalogPortraits,
  requireCatalogPortrait,
  type CatalogEntry,
} from '../../services/characterCatalogService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = {
  visible:      boolean;
  charClass:    string;
  race?:        string;
  lang:         Lang;
  onSelect:     (entry: CatalogEntry) => void;
  onClose:      () => void;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const THUMB_SIZE = 80;

type ThumbProps = {
  entry:       CatalogEntry;
  selected:    boolean;
  onPress:     (e: CatalogEntry) => void;
};

const PortraitThumb = memo(({ entry, selected, onPress }: ThumbProps) => {
  const source = requireCatalogPortrait(entry);

  return (
    <TouchableOpacity
      onPress={() => onPress(entry)}
      style={[
        S.thumb,
        selected && S.thumbSelected,
      ]}
      activeOpacity={0.75}
    >
      {source ? (
        <AppImage
          source={source}
          style={S.thumbImg}
          resizeMode="cover"
        />
      ) : (
        <View style={S.thumbPlaceholder}>
          <Text style={S.thumbPlaceholderText}>
            {entry.charClass.slice(0, 3).toUpperCase()}
          </Text>
          <Text style={S.thumbPlaceholderSub}>
            {entry.race.slice(0, 3).toUpperCase()}
          </Text>
        </View>
      )}
      {selected && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={S.thumbSelectedOverlay} />
          <Text style={S.thumbSelectedCheck}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const CatalogPortraitPicker = memo(({
  visible, charClass, race, lang, onSelect, onClose,
}: Props) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Exact class+race matches first, then class-only
  const entries = useMemo<CatalogEntry[]>(() => {
    const exact   = race  ? getCatalogPortraits(charClass, race)  : [];
    const byClass = getCatalogPortraits(charClass);
    // Deduplicate: exact first, then remaining entries not in exact
    const exactKeys = new Set(exact.map(e => e.key));
    const others    = byClass.filter(e => !exactKeys.has(e.key));
    return [...exact, ...others];
  }, [charClass, race]);

  const handleConfirm = useCallback(() => {
    const found = entries.find(e => e.key === selectedKey);
    if (found) onSelect(found);
  }, [selectedKey, entries, onSelect]);

  const handleClose = useCallback(() => {
    setSelectedKey(null);
    onClose();
  }, [onClose]);

  const isEmpty = entries.length === 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={S.overlay}>
        <View style={S.container}>
          {/* Header */}
          <View style={S.header}>
            <Text style={S.headerTitle}>
              {lang === 'es' ? '— SELECCIONAR RETRATO —' : '— SELECT PORTRAIT —'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={S.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={S.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Subtitle */}
          <Text style={S.subtitle}>
            {lang === 'es'
              ? `${charClass.toUpperCase()}${race ? ` · ${race.toUpperCase()}` : ''}`
              : `${charClass.toUpperCase()}${race ? ` · ${race.toUpperCase()}` : ''}`}
          </Text>

          {/* Grid */}
          {isEmpty ? (
            <View style={S.emptyState}>
              <ActivityIndicator color="rgba(0,255,65,0.5)" />
              <Text style={S.emptyText}>
                {lang === 'es'
                  ? 'Catálogo no generado. Ejecuta:\nnpm run generate-catalog'
                  : 'Catalog not generated yet. Run:\nnpm run generate-catalog'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={item => item.key}
              numColumns={3}
              contentContainerStyle={S.grid}
              renderItem={({ item }) => (
                <PortraitThumb
                  entry={item}
                  selected={selectedKey === item.key}
                  onPress={e => setSelectedKey(e.key)}
                />
              )}
              showsVerticalScrollIndicator={false}
              // CR-065: layout hints to avoid measuring all items on first render
              getItemLayout={(_, index) => ({
                length: THUMB_SIZE + 8,
                offset: (THUMB_SIZE + 8) * Math.floor(index / 3),
                index,
              })}
              windowSize={5}
              maxToRenderPerBatch={12}
              initialNumToRender={12}
            />
          )}

          {/* Footer */}
          <View style={S.footer}>
            <TouchableOpacity onPress={handleClose} style={S.cancelBtn}>
              <Text style={S.cancelText}>
                {lang === 'es' ? 'CANCELAR' : 'CANCEL'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!selectedKey}
              style={[S.confirmBtn, !selectedKey && S.confirmBtnDisabled]}
            >
              <Text style={[S.confirmText, !selectedKey && S.confirmTextDisabled]}>
                {lang === 'es' ? 'SELECCIONAR' : 'SELECT'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  container: {
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.3)',
    backgroundColor: '#060A06',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent:'space-between',
    padding:        12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,65,0.15)',
  },
  headerTitle: {
    fontFamily: 'RobotoMono-Bold',
    fontSize:   11,
    color:      'rgba(0,255,65,0.9)',
    letterSpacing: 1,
  },
  closeBtn:  {},
  closeText: { fontFamily: 'RobotoMono-Regular', fontSize: 14, color: 'rgba(0,255,65,0.6)' },
  subtitle: {
    fontFamily:   'RobotoMono-Regular',
    fontSize:      9,
    color:         'rgba(0,255,65,0.4)',
    paddingHorizontal: 12,
    paddingTop:      8,
    letterSpacing:   0.5,
  },
  grid: {
    padding:    8,
    paddingBottom: 4,
  },
  thumb: {
    width:          THUMB_SIZE,
    height:         THUMB_SIZE,
    margin:         4,
    borderWidth:    1,
    borderColor:   'rgba(0,255,65,0.2)',
    borderRadius:   2,
    overflow:      'hidden',
    backgroundColor:'rgba(0,255,65,0.04)',
  },
  thumbSelected: {
    borderColor:   '#00FF41',
    borderWidth:    2,
  },
  thumbImg: {
    width:  THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumbPlaceholder: {
    flex:           1,
    alignItems:    'center',
    justifyContent:'center',
  },
  thumbPlaceholderText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize:   12,
    color:      'rgba(0,255,65,0.4)',
  },
  thumbPlaceholderSub: {
    fontFamily: 'RobotoMono-Regular',
    fontSize:   8,
    color:      'rgba(0,255,65,0.25)',
    marginTop:  2,
  },
  thumbSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,255,65,0.15)',
  },
  thumbSelectedCheck: {
    position:   'absolute',
    bottom:      4,
    right:       6,
    fontFamily: 'RobotoMono-Bold',
    fontSize:   14,
    color:      '#00FF41',
  },
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    padding:         32,
    gap:              12,
  },
  emptyText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize:    9,
    color:      'rgba(0,255,65,0.4)',
    textAlign:  'center',
    lineHeight:  14,
  },
  footer: {
    flexDirection:  'row',
    borderTopWidth:  1,
    borderTopColor: 'rgba(0,255,65,0.15)',
    padding:         12,
    gap:              8,
  },
  cancelBtn: {
    flex:            1,
    paddingVertical: 10,
    borderWidth:     1,
    borderColor:    'rgba(0,255,65,0.25)',
    alignItems:     'center',
  },
  cancelText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize:    10,
    color:      'rgba(0,255,65,0.5)',
  },
  confirmBtn: {
    flex:            2,
    paddingVertical: 10,
    borderWidth:     1,
    borderColor:    '#00FF41',
    backgroundColor:'rgba(0,255,65,0.08)',
    alignItems:     'center',
  },
  confirmBtnDisabled: {
    borderColor:    'rgba(0,255,65,0.2)',
    backgroundColor:'transparent',
  },
  confirmText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize:    11,
    color:      '#00FF41',
  },
  confirmTextDisabled: {
    color: 'rgba(0,255,65,0.3)',
  },
});
