import React, { memo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { AppImage } from '../AppImage';
import type { Lang } from '../../i18n';

type Props = {
  lang: Lang;
  portrait: string | undefined;
  portraitRolls: number;
  generating: boolean;
  error: string | null;
  expanded: boolean;
  maxRolls: number;
  onToggleExpand: () => void;
  onGenerate: () => void;
  onView: () => void;
  // Catalog picker
  catalogAvailable?: boolean;
  onSelectFromCatalog?: () => void;
};

const S = StyleSheet.create({
  portraitBox: {
    width: 72, height: 72,
    borderWidth: 1, borderColor: 'rgba(0,255,65,0.3)',
    borderRadius: 4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,255,65,0.04)', overflow: 'hidden',
  },
  portraitImage: { width: 72, height: 72 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLabel: { color: 'rgba(0,255,65,0.45)', fontFamily: 'RobotoMono-Regular', fontSize: 9, letterSpacing: 1 },
  chevron: { color: 'rgba(0,255,65,0.45)', fontFamily: 'RobotoMono-Regular', fontSize: 11 },
  placeholderLabel: { color: 'rgba(0,255,65,0.3)', fontFamily: 'RobotoMono-Regular', fontSize: 7, textAlign: 'center' },
  genBtn: {
    borderWidth: 1, borderColor: 'rgba(0,255,65,0.4)', borderRadius: 4,
    paddingVertical: 10, paddingHorizontal: 10,
    backgroundColor: 'rgba(0,255,65,0.06)',
  },
  genBtnText: { color: 'rgba(0,255,65,0.9)', fontFamily: 'RobotoMono-Bold', fontSize: 11, textAlign: 'center' },
  viewBtn: {
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.4)', borderRadius: 4,
    paddingVertical: 7, paddingHorizontal: 10, backgroundColor: 'rgba(0,229,255,0.06)', marginBottom: 6,
  },
  viewBtnText: { color: 'rgba(0,229,255,0.9)', fontFamily: 'RobotoMono-Bold', fontSize: 11, textAlign: 'center' },
  regenBtn: {
    borderWidth: 1, borderColor: 'rgba(255,176,0,0.4)', borderRadius: 4,
    paddingVertical: 7, paddingHorizontal: 10, backgroundColor: 'rgba(255,176,0,0.06)',
  },
  regenBtnText: { color: 'rgba(255,176,0,0.9)', fontFamily: 'RobotoMono-Bold', fontSize: 11, textAlign: 'center' },
  maxLabel: { color: 'rgba(0,255,65,0.35)', fontFamily: 'RobotoMono-Regular', fontSize: 9, textAlign: 'center', marginTop: 2 },
  errorText: { color: 'rgba(255,62,62,0.75)', fontFamily: 'RobotoMono-Regular', fontSize: 8, marginTop: 4 },
  catalogBtn: {
    borderWidth: 1, borderColor: 'rgba(0,255,65,0.55)', borderRadius: 4,
    paddingVertical: 10, paddingHorizontal: 10,
    backgroundColor: 'rgba(0,255,65,0.08)',
    marginBottom: 5,
  },
  catalogBtnText: { color: 'rgba(0,255,65,0.95)', fontFamily: 'RobotoMono-Bold', fontSize: 11, textAlign: 'center' },
});

export const PortraitSection = memo(({
  lang, portrait, portraitRolls, generating, error,
  expanded, maxRolls, onToggleExpand, onGenerate, onView,
  catalogAvailable, onSelectFromCatalog,
}: Props) => (
  <>
    <TouchableOpacity onPress={onToggleExpand} activeOpacity={0.7} style={S.headerRow}>
      <Text style={S.headerLabel}>{lang === 'es' ? '— RETRATO —' : '— PORTRAIT —'}</Text>
      <Text style={S.chevron}>{expanded ? '▲' : '▼'}</Text>
    </TouchableOpacity>

    {expanded && (
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => portrait && onView()}
          disabled={!portrait}
          style={S.portraitBox}
        >
          {portrait ? (
            <AppImage source={{ uri: portrait }} style={S.portraitImage} resizeMode="cover" />
          ) : (
            <Text style={S.placeholderLabel}>PORTRAIT</Text>
          )}
        </TouchableOpacity>

        <View className="flex-1 ml-3">
          {!portrait ? (
            <View>
              {catalogAvailable && onSelectFromCatalog && (
                <TouchableOpacity
                  onPress={onSelectFromCatalog}
                  disabled={generating}
                  style={[S.catalogBtn, { opacity: generating ? 0.5 : 1 }]}
                >
                  <Text style={S.catalogBtnText}>
                    {lang === 'es' ? '🖼 SELECCIONAR RETRATO' : '🖼 SELECT PORTRAIT'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View>
              <TouchableOpacity onPress={onView} style={S.viewBtn}>
                <Text style={S.viewBtnText}>
                  {lang === 'es' ? '🔍 VER RETRATO' : '🔍 VIEW PORTRAIT'}
                </Text>
              </TouchableOpacity>
							{catalogAvailable && onSelectFromCatalog && (
                <TouchableOpacity
                  onPress={onSelectFromCatalog}
                  disabled={generating}
                  style={[S.catalogBtn, { opacity: generating ? 0.5 : 1 }]}
                >
                  <Text style={S.catalogBtnText}>
                    {lang === 'es' ? '🖼 SELECCIONAR RETRATO' : '🖼 SELECT PORTRAIT'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {error && <Text style={S.errorText}>⚠ {error}</Text>}
        </View>
      </View>
    )}
  </>
));
