import React, { memo, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Share,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import { AppImage } from '../AppImage';
import { useI18n } from '../../i18n';
import { resolvePortraitSource, type PortraitSource } from '../../utils/mapState';

const { width: SCREEN_W } = Dimensions.get('window');

// Responsive portrait size — leaves margin on all sides
const IMG_W = Math.min(SCREEN_W - 64, 300);
const IMG_H = Math.round(IMG_W * 1.47); // ~2:3 portrait ratio

type Props = {
  uri: string | null;
  onClose: () => void;
  title?: string;
};

const GREEN     = '#00FF41';
const GREEN_DIM = 'rgba(0,255,65,0.45)';
const GREEN_SUB = 'rgba(0,255,65,0.25)';
const MONO      = 'RobotoMono-Regular';
const MONO_BOLD = 'RobotoMono-Bold';

// ─── Inner component (needs hooks) ────────────────────────
function PortraitDetailModalInner({ uri, onClose, title }: Props) {
  const { t } = useI18n();

  const handleShare = useCallback(async () => {
    if (!uri) return;
    try {
      const label = title ?? t('party.portrait');
      if (Platform.OS === 'ios') {
        // On iOS, pass the data URI as url — iOS share sheet can handle it
        await Share.share({ title: label, url: uri });
      } else {
        // Android: pass as message (opens share sheet; image save depends on target app)
        await Share.share({ title: label, message: uri });
      }
    } catch (_) {
      // User cancelled or share failed — no-op
    }
  }, [uri, title, t]);

	const portraitSource = useMemo<PortraitSource | null>(() => {
		return resolvePortraitSource(uri);
	}, [uri]);

  const displayTitle = (title ?? t('party.portrait')).toUpperCase();

  return (
    <Modal
      visible={uri !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={S.backdrop}>
        {/* Backdrop tap area — behind the card */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          activeOpacity={1}
        />

        {uri && (
          <View style={S.card}>
            {/* ── Top frame ── */}
            <View style={S.frameRow}>
              <Text style={S.frameGlyph}>╔══</Text>
              <Text style={S.frameTitle} numberOfLines={1}>{displayTitle}</Text>
              <Text style={S.frameGlyph}>══╗</Text>
            </View>

            {/* ── Portrait ── */}
            <View style={S.imageOuter}>
              {/* Corner decorations */}
              <Text style={[S.cornerGlyph, S.cornerTL]}>◆</Text>
              <Text style={[S.cornerGlyph, S.cornerTR]}>◆</Text>
              <Text style={[S.cornerGlyph, S.cornerBL]}>◆</Text>
              <Text style={[S.cornerGlyph, S.cornerBR]}>◆</Text>

              {portraitSource != null ? (
                <AppImage
                  source={portraitSource}
                  style={S.image}
                  resizeMode="cover"
                />
              ) : null}
            </View>

            {/* ── Bottom frame ── */}
            <View style={S.frameRow}>
              <Text style={S.frameGlyph}>╚══</Text>
              <View style={S.frameCenter} />
              <Text style={S.frameGlyph}>══╝</Text>
            </View>

            {/* ── Action buttons ── */}
            <View style={S.actions}>
              <TouchableOpacity
                style={S.actionBtn}
                onPress={handleShare}
                activeOpacity={0.65}
              >
                <Text style={S.actionIcon}>↓</Text>
                <Text style={S.actionLabel}>{t('party.sharePortrait').toUpperCase()}</Text>
              </TouchableOpacity>

              <View style={S.actionDivider} />

              <TouchableOpacity
                style={S.actionBtn}
                onPress={onClose}
                activeOpacity={0.65}
              >
                <Text style={S.actionIcon}>✕</Text>
                <Text style={S.actionLabel}>{t('common.close').toUpperCase()}</Text>
              </TouchableOpacity>
            </View>

            {/* ── Hint ── */}
            <Text style={S.hint}>— {t('party.tapToClose')} —</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

export const PortraitDetailModal = memo(PortraitDetailModalInner);

// ─── Styles ───────────────────────────────────────────────

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    // card itself doesn't consume backdrop touches
  },

  // Frame rows
  frameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: IMG_W + 4,
  },
  frameGlyph: {
    color: GREEN_DIM,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 1,
  },
  frameTitle: {
    flex: 1,
    color: GREEN,
    fontFamily: MONO_BOLD,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
  },
  frameCenter: {
    flex: 1,
  },

  // Portrait container
  imageOuter: {
    width: IMG_W,
    height: IMG_H,
    borderWidth: 1,
    borderColor: GREEN_DIM,
    borderRadius: 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },

  // Corner glyphs (decorative, overlaid on image)
  cornerGlyph: {
    position: 'absolute',
    color: GREEN,
    fontFamily: MONO_BOLD,
    fontSize: 10,
    zIndex: 2,
  },
  cornerTL: { top: 4,  left:  4 },
  cornerTR: { top: 4,  right: 4 },
  cornerBL: { bottom: 4, left:  4 },
  cornerBR: { bottom: 4, right: 4 },

  // Action bar
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: GREEN_SUB,
    borderRadius: 2,
    overflow: 'hidden',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  actionIcon: {
    color: GREEN,
    fontFamily: MONO_BOLD,
    fontSize: 13,
  },
  actionLabel: {
    color: GREEN_DIM,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1,
  },
  actionDivider: {
    width: 1,
    height: 36,
    backgroundColor: GREEN_SUB,
  },

  // Hint text
  hint: {
    marginTop: 10,
    color: 'rgba(0,255,65,0.2)',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1.5,
  },
});
