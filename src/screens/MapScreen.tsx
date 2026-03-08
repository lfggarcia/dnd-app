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
import Svg, { Line as SvgLine, Circle as SvgCircle, G as SvgG } from 'react-native-svg';
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
const NODE_SIZE = 64;
const NODE_HALF = NODE_SIZE / 2;

// ─── Room visual styles ───────────────────────────────────────────────────────
const ROOM_STYLES: Record<RoomType, { borderColor: string; bgColor: string; icon: string; textColor: string }> = {
  START:    { borderColor: '#00FF41', bgColor: 'rgba(0,255,65,0.16)',   icon: '▼', textColor: '#00FF41' },
  NORMAL:   { borderColor: '#FF3B30', bgColor: 'rgba(255,59,48,0.15)',  icon: '⚔', textColor: '#FF6B63' },
  ELITE:    { borderColor: '#FF9F0A', bgColor: 'rgba(255,159,10,0.16)', icon: '⚡', textColor: '#FFBC45' },
  EVENT:    { borderColor: '#00E5FF', bgColor: 'rgba(0,229,255,0.13)',  icon: '?',  textColor: '#40EEFF' },
  TREASURE: { borderColor: '#FFD60A', bgColor: 'rgba(255,214,10,0.14)', icon: '◆', textColor: '#FFD60A' },
  BOSS:     { borderColor: '#FF453A', bgColor: 'rgba(255,69,58,0.24)',  icon: '☠', textColor: '#FF7070' },
  SECRET:   { borderColor: '#BF5AF2', bgColor: 'rgba(191,90,242,0.15)', icon: '✦', textColor: '#CF7AFF' },
};

// ─── Room action description helper ─────────────────────────────────────────
function getRoomActionDesc(type: RoomType): string {
  switch (type) {
    case 'NORMAL':   return 'Sala de combate · Los enemigos aguardan';
    case 'ELITE':    return 'Combate élite · Enemigos poderosos';
    case 'BOSS':     return '⚠ Jefe del piso · El guardián te espera';
    case 'TREASURE': return 'Sala de tesoro · Aquí descansan riquezas';
    case 'SECRET':   return 'Sala secreta · Algo oculto aguarda';
    case 'EVENT':    return 'Evento · Lo desconocido te aguarda';
    case 'START':    return 'Punto de inicio · Zona segura';
    default:         return 'Sala desconocida';
  }
}

// ─── Map background grid ──────────────────────────────────────────────────────
const MapBackground = React.memo(() => {
  const cols = Math.floor(CANVAS_W / 60) + 1;
  const rows = Math.floor(CANVAS_H / 60) + 1;
  return (
    <Svg style={StyleSheet.absoluteFill} width={CANVAS_W} height={CANVAS_H} pointerEvents="none">
      {Array.from({ length: cols }).map((_, i) => (
        <SvgLine key={`v${i}`} x1={i * 60} y1={0} x2={i * 60} y2={CANVAS_H}
          stroke="rgba(0,255,65,0.05)" strokeWidth={1} />
      ))}
      {Array.from({ length: rows }).map((_, i) => (
        <SvgLine key={`h${i}`} x1={0} y1={i * 60} x2={CANVAS_W} y2={i * 60}
          stroke="rgba(0,255,65,0.05)" strokeWidth={1} />
      ))}
    </Svg>
  );
});

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
  const [isDescending, setIsDescending] = useState(false);

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

  // ─── Reveal adjacent rooms after returning from Battle ────────────────────
  // When we enter a combat room we intentionally skip revealAdjacentRooms to
  // avoid showing neighbour rooms before the fight is resolved. On every focus
  // (which fires when coming back from Battle → Report → Extraction) we check
  // if the current combat room is visited but its neighbours aren't revealed
  // yet, and if so we apply the reveal now.
  useFocusEffect(
    useCallback(() => {
      const currentRoomInFloor = floor.rooms.find(r => r.id === currentRoomId);
      const isCombat =
        currentRoomInFloor?.type === 'NORMAL' ||
        currentRoomInFloor?.type === 'ELITE' ||
        currentRoomInFloor?.type === 'BOSS';
      if (!isCombat || !currentRoomInFloor?.visited) return;
      const needsReveal = currentRoomInFloor.connections.some(
        cid => !floor.rooms.find(r => r.id === cid)?.revealed,
      );
      if (!needsReveal) return;
      const afterReveal = revealAdjacentRooms(floor, currentRoomId);
      setFloor(afterReveal);
      const saved = serializeExplorationState(afterReveal, currentRoomId);
      updateProgress({ location: 'map', mapState: JSON.stringify(saved) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [floor, currentRoomId, updateProgress]),
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

  // ─── Room press — only selects the node, action happens in panel ────────────
  const handleRoomPress = useCallback((room: DungeonRoom) => {
    if (room.id === currentRoomId || !accessibleIds.has(room.id)) return;
    // Tap the already-selected room → deselect
    if (selectedRoom?.id === room.id) { setSelectedRoom(null); return; }
    // Already visited (backtrack): move silently, no panel
    if (room.visited) {
      setCurrentRoomId(room.id);
      setSelectedRoom(null);
      const saved = serializeExplorationState(floor, room.id);
      updateProgress({ location: 'map', mapState: JSON.stringify(saved) });
      return;
    }
    // Unvisited reachable room: select and show action panel
    setSelectedRoom(room);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId, accessibleIds, selectedRoom, floor, updateProgress]);

  // ─── Enter selected room ─────────────────────────────────────────────────────
  const handleEnterRoom = useCallback(() => {
    if (!selectedRoom) return;
    const room = selectedRoom;
    const afterVisit: DungeonFloor = {
      ...floor,
      rooms: floor.rooms.map(r => r.id === room.id ? { ...r, visited: true } : r),
    };
    const isCombat = room.type === 'NORMAL' || room.type === 'ELITE' || room.type === 'BOSS';
    if (isCombat) {
      setFloor(afterVisit);
      setCurrentRoomId(room.id);
      setSelectedRoom(null);
      const savedState = serializeExplorationState(afterVisit, room.id);
      updateProgress({ location: 'map', mapState: JSON.stringify(savedState) });
      navigation.navigate('Battle');
      return;
    }
    // Non-combat: move, reveal adjacent, keep panel open with post-entry info
    const afterReveal = revealAdjacentRooms(afterVisit, room.id);
    setFloor(afterReveal);
    setCurrentRoomId(room.id);
    setSelectedRoom({ ...room, visited: true });
    const savedState = serializeExplorationState(afterReveal, room.id);
    updateProgress({ location: 'map', mapState: JSON.stringify(savedState) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor, selectedRoom, navigation, updateProgress]);

  const handleNextFloor = useCallback(() => {
    setIsDescending(true);
    const newFloorIndex = floorIndex + 1;
    setTimeout(() => {
      const base = generateDungeonFloor(activeGame?.seedHash ?? '0', newFloorIndex);
      const withMutations = applyFloorMutations(base, cycle);
      const withReveal = revealAdjacentRooms(withMutations, withMutations.startRoomId);
      const newState = serializeExplorationState(withReveal, withMutations.startRoomId);
      updateProgress({ floor: newFloorIndex, mapState: JSON.stringify(newState) });
      setFloor(withReveal);
      setCurrentRoomId(withMutations.startRoomId);
      setSelectedRoom(null);
      setIsDescending(false);
    }, 900);
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
        {/* Background grid texture */}
        <MapBackground />

        {/* Connection lines — SVG for smooth anti-aliased rendering */}
        <Svg
          style={StyleSheet.absoluteFill}
          width={CANVAS_W}
          height={CANVAS_H}
          pointerEvents="none"
        >
          {floor.rooms.flatMap(room =>
            room.connections.map(targetId => {
              const target = floor.rooms.find(r => r.id === targetId);
              // Skip if source not revealed or target doesn't exist in graph.
              if (!target || !room.revealed) return null;
              const cx1 = room.pos.x * CANVAS_W;
              const cy1 = room.pos.y * CANVAS_H;
              const cx2 = target.pos.x * CANVAS_W;
              const cy2 = target.pos.y * CANVAS_H;
              const dx = cx2 - cx1, dy = cy2 - cy1;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 1) return null;
              const ux = dx / dist, uy = dy / dist;
              const gap = NODE_HALF + 3;
              const x1 = cx1 + ux * gap, y1 = cy1 + uy * gap;
              const x2 = cx2 - ux * gap, y2 = cy2 - uy * gap;
              // Connection into the fog — dashed dim line, no glow or endpoint dots.
              if (!target.revealed) {
                return (
                  <SvgLine key={`fog-conn-${room.id}-${targetId}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="rgba(0,255,65,0.18)" strokeWidth={1}
                    strokeDasharray="3 7"
                  />
                );
              }
              const isActivePath =
                (room.id === currentRoomId && accessibleIds.has(targetId)) ||
                (targetId === currentRoomId && reverseIds.has(room.id));
              const lineColor = isActivePath ? 'rgba(0,255,65,0.95)' : 'rgba(0,255,65,0.45)';
              const glowColor = isActivePath ? 'rgba(0,255,65,0.30)' : 'rgba(0,255,65,0.10)';
              const strokeW = isActivePath ? 2 : 1;
              return (
                <SvgG key={`conn-${room.id}-${targetId}`}>
                  <SvgLine x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={glowColor} strokeWidth={strokeW + 8} />
                  <SvgLine x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={lineColor} strokeWidth={strokeW} />
                  <SvgCircle cx={x1} cy={y1} r={2.5} fill={lineColor} opacity={0.9} />
                  <SvgCircle cx={x2} cy={y2} r={2.5} fill={lineColor} opacity={0.9} />
                </SvgG>
              );
            })
          )}
        </Svg>

        {/* Fog nodes — rendered underneath revealed nodes (lower z-order) */}
        {floor.rooms
          .filter(room => !room.revealed)
          .map(room => {
            const posLeft = room.pos.x * CANVAS_W - NODE_HALF;
            const posTop  = room.pos.y * CANVAS_H - NODE_HALF;
            return (
              <View
                key={`fog-${room.id}`}
                pointerEvents="none"
                style={[styles.nodeWrapper, { left: posLeft, top: posTop, opacity: 0.22 }]}
              >
                <View pointerEvents="none" style={[styles.nodeBracketTL, { borderColor: 'rgba(0,255,65,0.35)' }]} />
                <View pointerEvents="none" style={[styles.nodeBracketTR, { borderColor: 'rgba(0,255,65,0.35)' }]} />
                <View pointerEvents="none" style={[styles.nodeBracketBL, { borderColor: 'rgba(0,255,65,0.35)' }]} />
                <View pointerEvents="none" style={[styles.nodeBracketBR, { borderColor: 'rgba(0,255,65,0.35)' }]} />
                <View style={styles.fogNodeInner}>
                  <Text style={styles.fogNodeText}>?</Text>
                </View>
              </View>
            );
          })
        }

        {/* Revealed room nodes */}
        {floor.rooms
          .filter(room => room.revealed)
          .map(room => {
          const rs = ROOM_STYLES[room.type];
          const isCurrent = room.id === currentRoomId;
          const isAccessible = accessibleIds.has(room.id);
          const posLeft = room.pos.x * CANVAS_W - NODE_HALF;
          const posTop  = room.pos.y * CANVAS_H - NODE_HALF;

          const isBacktrack = reverseIds.has(room.id);
          const isSelected = selectedRoom?.id === room.id;
          const opacity = isCurrent ? 1 : room.visited ? (isAccessible ? 0.7 : 0.4) : isAccessible ? 1 : 0.2;

          return (
            <TouchableOpacity
              key={room.id}
              onPress={() => handleRoomPress(room)}
              disabled={isCurrent || !isAccessible}
              activeOpacity={0.7}
              style={[styles.nodeWrapper, { left: posLeft, top: posTop, opacity }]}
            >
              {/* Accessible room glow ring — brighter when selected */}
              {isAccessible && !isCurrent && (
                <View pointerEvents="none" style={{
                  position: 'absolute',
                  top: -6, left: -6, right: -6, bottom: -6,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? rs.borderColor : `${rs.borderColor}55`,
                }} />
              )}

              {/* Corner brackets — outer decoration */}
              <View pointerEvents="none" style={[styles.nodeBracketTL, { borderColor: `${rs.borderColor}90` }]} />
              <View pointerEvents="none" style={[styles.nodeBracketTR, { borderColor: `${rs.borderColor}90` }]} />
              <View pointerEvents="none" style={[styles.nodeBracketBL, { borderColor: `${rs.borderColor}90` }]} />
              <View pointerEvents="none" style={[styles.nodeBracketBR, { borderColor: `${rs.borderColor}90` }]} />

              {/* Main node */}
              <View style={{
                width: NODE_SIZE,
                height: NODE_SIZE,
                borderWidth: isCurrent ? 2 : room.type === 'BOSS' ? 2 : 1,
                borderColor: rs.borderColor,
                backgroundColor: rs.bgColor,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {/* Type color top strip */}
                <View style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, height: 3,
                  backgroundColor: rs.borderColor,
                  opacity: 0.65,
                }} />
                {/* Bottom accent */}
                <View style={{
                  position: 'absolute',
                  bottom: 0, left: 0, right: 0, height: 1.5,
                  backgroundColor: rs.borderColor,
                  opacity: 0.30,
                }} />
                <Text style={{ fontSize: room.type === 'BOSS' ? 22 : 20, color: rs.textColor }}>{rs.icon}</Text>
                <Text style={[styles.roomLabel, { color: rs.textColor }]}>
                  {room.label.split('_')[0]}
                </Text>
                {isBacktrack && (
                  <View style={styles.backDot} />
                )}
              </View>

              {/* Current room: inner pulsing ring + outer static ring */}
              {isCurrent && (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[pulseStyle, {
                      position: 'absolute',
                      top: -5, left: -5, right: -5, bottom: -5,
                      borderWidth: 2,
                      borderColor: rs.borderColor,
                    }]}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: -11, left: -11, right: -11, bottom: -11,
                      borderWidth: 1,
                      borderColor: `${rs.borderColor}28`,
                    }}
                  />
                </>
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

      {/* Room action panel */}
      {selectedRoom && (
        <View style={[styles.roomPanel, { borderTopColor: ROOM_STYLES[selectedRoom.type].borderColor + '66' }]}>
          <Text style={[styles.roomPanelTitle, { color: ROOM_STYLES[selectedRoom.type].textColor }]}>
            {ROOM_STYLES[selectedRoom.type].icon}{'  '}{selectedRoom.label}
            {selectedRoom.mutated ? '  [MUTADO]' : ''}
            {selectedRoom.visited ? '  ✓' : ''}
          </Text>
          <Text style={styles.roomPanelDesc}>
            {selectedRoom.visited
              ? `Sala explorada · ${selectedRoom.type}`
              : getRoomActionDesc(selectedRoom.type)}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            {!selectedRoom.visited && (
              <TouchableOpacity
                onPress={handleEnterRoom}
                style={[styles.enterBtn, { borderColor: ROOM_STYLES[selectedRoom.type].borderColor }]}
              >
                <Text style={[styles.enterBtnText, { color: ROOM_STYLES[selectedRoom.type].textColor }]}>
                  ▶ ENTRAR
                </Text>
              </TouchableOpacity>
            )}
            {selectedRoom.visited && (selectedRoom.type === 'START' || selectedRoom.type === 'TREASURE' || selectedRoom.type === 'SECRET') && (
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

      {/* Floor descent loading overlay */}
      {isDescending && (
        <View style={styles.descendOverlay}>
          <Text style={styles.descendTitle}>DESCENDIENDO</Text>
          <Text style={styles.descendFloor}>PISO {floorIndex + 1}</Text>
          <Text style={styles.descendSub}>Explorando territorio desconocido...</Text>
        </View>
      )}

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
  nodeBracketTL:  { position: 'absolute', top: -7, left: -7, width: 13, height: 13, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  nodeBracketTR:  { position: 'absolute', top: -7, right: -7, width: 13, height: 13, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  nodeBracketBL:  { position: 'absolute', bottom: -7, left: -7, width: 13, height: 13, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  nodeBracketBR:  { position: 'absolute', bottom: -7, right: -7, width: 13, height: 13, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  nodeWrapper:    { position: 'absolute', width: NODE_SIZE, height: NODE_SIZE, alignItems: 'center', justifyContent: 'center' },
  roomLabel:      { fontSize: 8, fontFamily: 'RobotoMono-Regular', marginTop: 2 },
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
  fogNodeInner:   { width: NODE_SIZE, height: NODE_SIZE, borderWidth: 1, borderColor: 'rgba(0,255,65,0.25)', backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  fogNodeText:    { fontSize: 13, color: 'rgba(0,255,65,0.40)', fontFamily: 'RobotoMono-Regular' },
  enterBtn:       { flex: 1, borderWidth: 1, padding: 8, alignItems: 'center', marginRight: 8 },
  enterBtnText:   { fontFamily: 'RobotoMono-Bold', fontSize: 11 },
  descendOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  descendTitle:   { fontFamily: 'RobotoMono-Bold', fontSize: 10, color: 'rgba(0,255,65,0.5)', letterSpacing: 4, marginBottom: 8 },
  descendFloor:   { fontFamily: 'RobotoMono-Bold', fontSize: 32, color: '#00FF41', letterSpacing: 6 },
  descendSub:     { fontFamily: 'RobotoMono-Regular', fontSize: 8, color: 'rgba(0,255,65,0.4)', marginTop: 12, letterSpacing: 2 },
});
