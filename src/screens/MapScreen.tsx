import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler, Dimensions, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { ScreenProps } from '../navigation/types';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryButton } from '../components/GlossaryModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useI18n } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import {
  generateDungeonFloor,
  applyExplorationState,
  revealAdjacentRooms,
  applyFloorMutations,
  serializeExplorationState,
  type DungeonFloor,
  type DungeonRoom,
  type FloorExplorationState,
  type RoomType,
} from '../services/dungeonGraphService';

// ─── Canvas dimensions (computed once at module load) ────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CANVAS_W = Math.max(SCREEN_W, 460);   // ensure enough horizontal room
const CANVAS_H = Math.max(SCREEN_H - 160, 800); // dynamic: leave space for bars
const NODE_SIZE = 56;
const NODE_HALF = NODE_SIZE / 2;

// ─── Room visual styles ───────────────────────────────────────────────────────
const ROOM_STYLES: Record<RoomType, { borderColor: string; bgColor: string; icon: string; textColor: string }> = {
  START:    { borderColor: '#00FF41', bgColor: 'rgba(0,255,65,0.12)',   icon: '▼', textColor: '#00FF41' },
  NORMAL:   { borderColor: '#FF3B30', bgColor: 'rgba(255,59,48,0.10)',  icon: '⚔', textColor: '#FF3B30' },
  ELITE:    { borderColor: '#FF9F0A', bgColor: 'rgba(255,159,10,0.12)', icon: '⚡', textColor: '#FF9F0A' },
  EVENT:    { borderColor: '#00E5FF', bgColor: 'rgba(0,229,255,0.10)',  icon: '?',  textColor: '#00E5FF' },
  TREASURE: { borderColor: '#FFD60A', bgColor: 'rgba(255,214,10,0.10)', icon: '◆', textColor: '#FFD60A' },
  BOSS:     { borderColor: '#FF453A', bgColor: 'rgba(255,69,58,0.18)',  icon: '☠', textColor: '#FF453A' },
  SECRET:   { borderColor: '#BF5AF2', bgColor: 'rgba(191,90,242,0.10)', icon: '✦', textColor: '#BF5AF2' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isExplorationState(parsed: unknown): parsed is FloorExplorationState {
  return (
    typeof parsed === 'object' && parsed !== null &&
    'floorIndex' in parsed && 'visitedRoomIds' in parsed &&
    'revealedRoomIds' in parsed && 'currentRoomId' in parsed
  );
}

function parseExplorationState(raw: string | null | undefined): FloorExplorationState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isExplorationState(parsed)) return parsed;
  } catch { /* ignore */ }
  return null;
}

export const MapScreen = ({ navigation }: ScreenProps<'Map'>) => {
  const { t } = useI18n();
  const activeGame = useGameStore(s => s.activeGame);
  const updateProgress = useGameStore(s => s.updateProgress);

  const floorIndex = activeGame?.floor ?? 1;
  const cycle = activeGame?.cycle ?? 1;

  const [saveExitVisible, setSaveExitVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<DungeonRoom | null>(null);

  // ─── Floor state — built from dungeonGraphService ──────────────────────────
  const [floor, setFloor] = useState<DungeonFloor>(() => {
    let base = generateDungeonFloor(activeGame?.seedHash ?? '0', floorIndex);
    base = applyFloorMutations(base, cycle);

    const explores = parseExplorationState(activeGame?.mapState);
    if (explores && explores.floorIndex === floorIndex) {
      return applyExplorationState(base, explores);
    }
    // Fresh floor: reveal start room's immediate neighbours
    return revealAdjacentRooms(base, base.startRoomId);
  });

  const [currentRoomId, setCurrentRoomId] = useState<number>(() => {
    const explores = parseExplorationState(activeGame?.mapState);
    if (explores && explores.floorIndex === floorIndex) return explores.currentRoomId;
    return floor.startRoomId;
  });

  useEffect(() => {
    updateProgress({ location: 'map' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setSaveExitVisible(true);
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const pulse = useSharedValue(0.3);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // ─── Accessibility ─────────────────────────────────────────────────────────
  const currentRoom = floor.rooms.find(r => r.id === currentRoomId);
  // Reverse connections: visited rooms that connect TO the current room (backtracking)
  const reverseIds = new Set<number>(
    floor.rooms
      .filter(r => r.visited && r.connections.includes(currentRoomId))
      .map(r => r.id)
  );
  const accessibleIds = new Set<number>([
    ...(currentRoom?.connections ?? []),
    ...reverseIds,
  ]);

  // ─── Floor advancement ────────────────────────────────────────────────────
  const isBossCleared = currentRoom?.type === 'BOSS' && currentRoom.visited;

  // ─── Room press ─────────────────────────────────────────────────────────────
  const handleRoomPress = useCallback((room: DungeonRoom) => {
    if (room.id === currentRoomId || !accessibleIds.has(room.id)) return;

    const afterVisit: DungeonFloor = {
      ...floor,
      rooms: floor.rooms.map(r => r.id === room.id ? { ...r, visited: true } : r),
    };
    const afterReveal = revealAdjacentRooms(afterVisit, room.id);
    setFloor(afterReveal);
    setCurrentRoomId(room.id);
    setSelectedRoom(null);

    // Persist exploration state BEFORE navigating away — so MapScreen
    // correctly restores the visited room + revealed neighbours on remount.
    const savedState = serializeExplorationState(afterReveal, room.id);
    updateProgress({ location: 'map', mapState: JSON.stringify(savedState) });

    if (!room.visited && (room.type === 'NORMAL' || room.type === 'ELITE' || room.type === 'BOSS')) {
      navigation.navigate('Battle');
    } else if (!room.visited) {
      // Unvisited non-combat room: show action panel
      setSelectedRoom(room);
    }
    // Visited rooms (backtracking): just move there silently — no panel
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor, currentRoomId, navigation, updateProgress]);

  const handleNextFloor = useCallback(() => {
    const newFloorIndex = floorIndex + 1;
    const base = generateDungeonFloor(activeGame?.seedHash ?? '0', newFloorIndex);
    const withMutations = applyFloorMutations(base, cycle);
    const withReveal = revealAdjacentRooms(withMutations, withMutations.startRoomId);
    const newState = serializeExplorationState(withReveal, withMutations.startRoomId);
    updateProgress({ floor: newFloorIndex, mapState: JSON.stringify(newState) });
    setFloor(withReveal);
    setCurrentRoomId(withMutations.startRoomId);
    setSelectedRoom(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorIndex, activeGame, cycle, updateProgress]);

  // ─── Save & exit ───────────────────────────────────────────────────────────
  const handleSaveAndExit = useCallback(() => {
    const state = serializeExplorationState(floor, currentRoomId);
    updateProgress({ location: 'map', mapState: JSON.stringify(state) });
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }, [floor, currentRoomId, updateProgress, navigation]);

  const handleReturnToVillage = useCallback(() => {
    const state = serializeExplorationState(floor, currentRoomId);
    updateProgress({ location: 'village', mapState: JSON.stringify(state) });
    navigation.reset({ index: 0, routes: [{ name: 'Village' }] });
  }, [floor, currentRoomId, updateProgress, navigation]);

  const combatCount = floor.rooms.filter(r => r.type === 'NORMAL' || r.type === 'ELITE').length;
  const revealedCount = floor.rooms.filter(r => r.revealed).length;

  return (
    <View style={styles.container}>
      <CRTOverlay />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setSaveExitVisible(true)} style={styles.exitBtn}>
          <Text style={styles.exitText}>✕ {t('map.exit')}</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.titleText}>
            {t('common.floor')} {String(floorIndex).padStart(2, '0')} · {t('map.title')}
          </Text>
          {currentRoom && (
            <Text style={styles.currentRoomHint}>
              {ROOM_STYLES[currentRoom.type].icon} {currentRoom.label}
            </Text>
          )}
        </View>
        <Text style={styles.cycleText}>{t('common.cycle')}: {String(cycle).padStart(2, '0')}/60</Text>
      </View>

      {/* Day/Night bar */}
      <View style={styles.metaBar}>
        <Text style={styles.metaText}>☀ {t('common.dayPhase')}</Text>
        <Text style={styles.separator}>|</Text>
        <Text style={styles.metaText}>{t('map.enemies')}: UNDEAD · ABERRATION</Text>
        <Text style={styles.separator}>|</Text>
        <Text style={styles.metaText}>{t('map.threat')}: {t('map.moderate')}</Text>
        <Text style={styles.separator}>|</Text>
        <Text style={[styles.metaText, { color: 'rgba(0,229,255,0.6)' }]}>
          {revealedCount}/{floor.rooms.length} ROOMS
        </Text>
      </View>

      {/* Scrollable Map Canvas — pan through the dungeon */}
      <ScrollView
        style={styles.mapScroll}
        contentContainerStyle={{ width: CANVAS_W, height: CANVAS_H }}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        maximumZoomScale={2}
        minimumZoomScale={0.6}
        bouncesZoom
      >
        {/* Diagonal connection lines */}
        {floor.rooms.map(room =>
          room.connections.map(targetId => {
            const target = floor.rooms.find(r => r.id === targetId);
            if (!target || (!room.revealed && !target.revealed)) return null;

            const x1 = room.pos.x * CANVAS_W;
            const y1 = room.pos.y * CANVAS_H;
            const x2 = target.pos.x * CANVAS_W;
            const y2 = target.pos.y * CANVAS_H;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length < 1) return null;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            // Centre the line at the midpoint between the two nodes, then rotate
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const isActivePath =
              (room.id === currentRoomId && accessibleIds.has(targetId)) ||
              (targetId === currentRoomId && reverseIds.has(room.id));

            return (
              <View
                key={`line-${room.id}-${targetId}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: cx - length / 2,
                  top: cy,
                  width: length,
                  height: 1,
                  backgroundColor: isActivePath
                    ? 'rgba(0,255,65,0.55)'
                    : 'rgba(0,255,65,0.13)',
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            );
          })
        )}

        {/* Room nodes */}
        {floor.rooms.map(room => {
          const rs = ROOM_STYLES[room.type];
          const isCurrent = room.id === currentRoomId;
          const isAccessible = accessibleIds.has(room.id);
          const posLeft = room.pos.x * CANVAS_W - NODE_HALF;
          const posTop  = room.pos.y * CANVAS_H - NODE_HALF;

          if (!room.revealed) {
            return (
              <View
                key={room.id}
                pointerEvents="none"
                style={[styles.fogNode, { left: posLeft, top: posTop }]}
              >
                <Text style={styles.fogIcon}>?</Text>
              </View>
            );
          }

          const isBacktrack = reverseIds.has(room.id);
          const opacity = isCurrent ? 1 : room.visited ? (isAccessible ? 0.7 : 0.4) : isAccessible ? 1 : 0.2;

          return (
            <TouchableOpacity
              key={room.id}
              onPress={() => handleRoomPress(room)}
              disabled={isCurrent || !isAccessible}
              activeOpacity={0.7}
              style={[styles.nodeWrapper, { left: posLeft, top: posTop, opacity }]}
            >
              <View style={{
                width: NODE_SIZE,
                height: NODE_SIZE,
                borderWidth: isCurrent ? 2 : 1,
                borderColor: rs.borderColor,
                backgroundColor: rs.bgColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 16, color: rs.textColor }}>{rs.icon}</Text>
                <Text style={[styles.roomLabel, { color: rs.textColor }]}>
                  {room.label.split('_')[0]}
                </Text>
                {isBacktrack && (
                  <View style={styles.backDot} />
                )}
              </View>

              {isCurrent && (
                <Animated.View
                  pointerEvents="none"
                  style={[pulseStyle, {
                    position: 'absolute',
                    top: -4, left: -4, right: -4, bottom: -4,
                    borderWidth: 1,
                    borderColor: rs.borderColor,
                  }]}
                />
              )}

              {room.mutated && !room.visited && (
                <View style={styles.mutationDot} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Boss cleared — advance floor (takes priority over room panel) */}
      {isBossCleared && (
        <View style={styles.bossPanel}>
          <Text style={styles.bossPanelTitle}>☠  PISO {floorIndex} CONQUISTADO</Text>
          <Text style={styles.bossPanelDesc}>El guardián del piso ha caído. El próximo descenso aguarda.</Text>
          <TouchableOpacity onPress={handleNextFloor} style={styles.nextFloorBtn}>
            <Text style={styles.nextFloorBtnText}>▶  DESCENDER AL PISO {floorIndex + 1}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Non-combat room panel */}
      {selectedRoom && (
        <View style={styles.roomPanel}>
          <Text style={styles.roomPanelTitle}>
            {ROOM_STYLES[selectedRoom.type].icon}{'  '}{selectedRoom.label}
            {selectedRoom.mutated ? '  [MUTADO]' : ''}
            {selectedRoom.visited ? '  ✓' : ''}
          </Text>
          <Text style={styles.roomPanelDesc}>
            {selectedRoom.visited
              ? `Sala ya explorada · Tipo: ${selectedRoom.type}`
              : t('map.safeZoneDesc')}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            {(selectedRoom.type === 'START' || selectedRoom.type === 'TREASURE' || selectedRoom.type === 'SECRET') && (
              <TouchableOpacity onPress={handleReturnToVillage} style={styles.returnBtn}>
                <Text style={styles.returnBtnText}>{t('extraction.returnVillage')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setSelectedRoom(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Info Panel */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.scannerLabel}>{t('map.scannerResults')}</Text>
          <Text style={styles.scannerValues}>
            {t('map.nodes')}: {floor.rooms.length} · {t('map.combats')}: {combatCount} · {t('map.boss')}: 1
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {([
            { color: '#FF3B30', label: t('map.nodeTypes.COMBAT') },
            { color: '#00E5FF', label: t('map.nodeTypes.EVENT') },
            { color: '#FFD60A', label: 'TREASURE' },
            { color: '#FF453A', label: t('map.nodeTypes.BOSS') },
          ] as const).map(({ color, label }) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
              <View style={{ width: 6, height: 6, backgroundColor: color, marginRight: 3 }} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <GlossaryButton />

      <ConfirmModal
        visible={saveExitVisible}
        title={t('map.saveExitTitle')}
        message={t('map.saveExitMsg')}
        confirmLabel={t('map.saveExit')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleSaveAndExit}
        onCancel={() => setSaveExitVisible(false)}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  topBar:         { backgroundColor: 'rgba(0,255,65,0.08)', paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.2)' },
  exitBtn:        { width: 60 },
  exitText:       { fontFamily: 'RobotoMono-Regular', fontSize: 9, color: 'rgba(0,255,65,0.6)' },
  titleText:      { fontFamily: 'RobotoMono-Bold', fontSize: 11, color: '#00FF41' },
  currentRoomHint:{ fontFamily: 'RobotoMono-Regular', fontSize: 8, color: 'rgba(0,255,65,0.55)', marginTop: 1 },
  cycleText:      { fontFamily: 'RobotoMono-Regular', fontSize: 9, color: '#FF9F0A' },
  metaBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.02)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,65,0.06)' },
  metaText:       { fontFamily: 'RobotoMono-Regular', fontSize: 7, color: 'rgba(0,255,65,0.5)' },
  separator:      { fontFamily: 'RobotoMono-Regular', fontSize: 7, color: 'rgba(0,255,65,0.2)', marginHorizontal: 6 },
  mapScroll:      { flex: 1 },
  fogNode:        { position: 'absolute', width: NODE_SIZE, height: NODE_SIZE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,255,65,0.08)', backgroundColor: 'rgba(0,0,0,0.5)' },
  fogIcon:        { fontSize: 10, color: 'rgba(0,255,65,0.15)', fontFamily: 'RobotoMono-Regular' },
  nodeWrapper:    { position: 'absolute', width: NODE_SIZE, height: NODE_SIZE, alignItems: 'center', justifyContent: 'center' },
  roomLabel:      { fontSize: 7, fontFamily: 'RobotoMono-Regular', marginTop: 1 },
  mutationDot:    { position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF453A' },
  roomPanel:      { borderTopWidth: 1, borderTopColor: 'rgba(0,255,65,0.4)', padding: 12, backgroundColor: 'rgba(0,255,65,0.04)' },
  roomPanelTitle: { fontFamily: 'RobotoMono-Bold', fontSize: 9, color: '#00FF41', marginBottom: 4 },
  roomPanelDesc:  { fontFamily: 'RobotoMono-Regular', fontSize: 8, color: 'rgba(0,255,65,0.6)', marginBottom: 8 },
  bossPanel:      { borderTopWidth: 1, borderTopColor: '#FF453A', padding: 14, backgroundColor: 'rgba(255,69,58,0.08)' },
  bossPanelTitle: { fontFamily: 'RobotoMono-Bold', fontSize: 11, color: '#FF453A', marginBottom: 4 },
  bossPanelDesc:  { fontFamily: 'RobotoMono-Regular', fontSize: 8, color: 'rgba(255,69,58,0.7)', marginBottom: 10 },
  nextFloorBtn:   { borderWidth: 1, borderColor: '#FF453A', paddingVertical: 10, alignItems: 'center' },
  nextFloorBtnText: { fontFamily: 'RobotoMono-Bold', fontSize: 13, color: '#FF453A' },
  backDot:        { position: 'absolute', top: -4, left: -4, width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(0,229,255,0.8)' },
  returnBtn:      { flex: 1, borderWidth: 1, borderColor: '#00E5FF', padding: 8, alignItems: 'center', marginRight: 8 },
  returnBtnText:  { fontFamily: 'RobotoMono-Regular', fontSize: 11, color: '#00E5FF' },
  cancelBtn:      { borderWidth: 1, borderColor: 'rgba(0,255,65,0.3)', padding: 8, alignItems: 'center', width: 80 },
  cancelBtnText:  { fontFamily: 'RobotoMono-Regular', fontSize: 11, color: 'rgba(0,255,65,0.5)' },
  bottomBar:      { borderTopWidth: 1, borderTopColor: 'rgba(0,255,65,0.2)', padding: 10, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scannerLabel:   { fontFamily: 'RobotoMono-Regular', fontSize: 8, color: '#00FF41' },
  scannerValues:  { fontFamily: 'RobotoMono-Regular', fontSize: 8, color: 'rgba(0,255,65,0.6)' },
  legendLabel:    { fontSize: 6, color: 'rgba(0,255,65,0.5)', fontFamily: 'RobotoMono-Regular' },
});
