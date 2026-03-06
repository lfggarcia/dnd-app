import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { ScreenProps } from '../navigation/types';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';
import { GlossaryModal, GlossaryButton } from '../components/GlossaryModal';
import { useGlossary } from '../hooks/useGlossary';
import { useI18n } from '../i18n';

type NodeType = 'COMBAT' | 'EVENT' | 'SAFE_ZONE' | 'BOSS' | 'UNKNOWN';

type MapNode = {
  id: number;
  type: NodeType;
  pos: { x: number; y: number };
  status: 'CLEAR' | 'CURRENT' | 'LOCKED' | 'AVAILABLE';
  label?: string;
  connections: number[];
};

const NODE_STYLES: Record<NodeType, { border: string; bg: string; icon: string }> = {
  COMBAT: { border: 'border-destructive', bg: 'bg-destructive/15', icon: '⚔' },
  EVENT: { border: 'border-accent', bg: 'bg-accent/15', icon: '?' },
  SAFE_ZONE: { border: 'border-primary', bg: 'bg-primary/15', icon: '◆' },
  BOSS: { border: 'border-secondary', bg: 'bg-secondary/20', icon: '☠' },
  UNKNOWN: { border: 'border-primary/30', bg: 'bg-muted/20', icon: '·' },
};

const FLOOR_NODES: MapNode[] = [
  { id: 1, type: 'SAFE_ZONE', pos: { x: 15, y: 85 }, status: 'CURRENT', label: 'ENTRANCE', connections: [2, 3] },
  { id: 2, type: 'COMBAT', pos: { x: 35, y: 65 }, status: 'AVAILABLE', label: 'UNDEAD_PATROL', connections: [4, 5] },
  { id: 3, type: 'EVENT', pos: { x: 35, y: 105 }, status: 'AVAILABLE', label: 'STRANGE_ALTAR', connections: [5] },
  { id: 4, type: 'COMBAT', pos: { x: 55, y: 45 }, status: 'LOCKED', label: 'AMBUSH_POINT', connections: [6] },
  { id: 5, type: 'UNKNOWN', pos: { x: 55, y: 85 }, status: 'LOCKED', connections: [6, 7] },
  { id: 6, type: 'SAFE_ZONE', pos: { x: 75, y: 60 }, status: 'LOCKED', label: 'CAMP', connections: [8] },
  { id: 7, type: 'COMBAT', pos: { x: 75, y: 105 }, status: 'LOCKED', connections: [8] },
  { id: 8, type: 'BOSS', pos: { x: 90, y: 80 }, status: 'LOCKED', label: 'FLOOR_GUARDIAN', connections: [] },
];

export const MapScreen = ({ navigation }: ScreenProps<'Map'>) => {
  const { t } = useI18n();
  const glossary = useGlossary();
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(0.3);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
  }, []);

  const radarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const handleNodePress = (node: MapNode) => {
    if (node.status === 'LOCKED') return;
    if (node.type === 'COMBAT' || node.type === 'BOSS') {
      navigation.navigate('Battle');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />
      <GlossaryModal visible={glossary.visible} onClose={glossary.close} />

      {/* Top Bar */}
      <View className="bg-primary/10 px-4 py-2 flex-row justify-between items-center border-b border-primary/30">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary font-robotomono text-xs">{'<'} {t('map.village')}</Text>
        </TouchableOpacity>
        <Text className="text-primary font-bold font-robotomono text-xs">{t('common.floor')} 01 · {t('map.title')}</Text>
        <Text className="text-secondary font-robotomono text-[9px]">{t('common.cycle')}: 01/60</Text>
      </View>

      {/* Day/Night + Floor Info */}
      <View className="flex-row px-4 py-1 bg-muted/20 border-b border-primary/10">
        <Text className="text-secondary font-robotomono text-[8px]">☀ {t('common.dayPhase')}</Text>
        <Text className="text-primary/30 font-robotomono text-[8px] mx-2">|</Text>
        <Text className="text-primary/50 font-robotomono text-[8px]">{t('map.enemies')}: UNDEAD · ABERRATION</Text>
        <Text className="text-primary/30 font-robotomono text-[8px] mx-2">|</Text>
        <Text className="text-primary/50 font-robotomono text-[8px]">{t('map.threat')}: {t('map.moderate')}</Text>
      </View>

      {/* Map Area */}
      <View className="flex-1 p-4">
        <View className="flex-1 relative">
          {/* Radar Background */}
          <Animated.View
            style={[radarStyle, { position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%', borderRadius: 999 }]}
            className="border border-primary/5 items-center justify-center"
            pointerEvents="none"
          >
            <View className="w-full h-[1px] bg-primary/10 absolute" />
            <View className="h-full w-[1px] bg-primary/10 absolute" />
          </Animated.View>

          {/* Connection Lines */}
          <View className="absolute inset-0" pointerEvents="none">
            {FLOOR_NODES.map(node =>
              node.connections.map(targetId => {
                const target = FLOOR_NODES.find(n => n.id === targetId);
                if (!target) return null;
                return (
                  <View
                    key={`${node.id}-${targetId}`}
                    className="absolute bg-primary/10"
                    style={{
                      left: `${Math.min(node.pos.x, target.pos.x) + 3}%`,
                      top: `${Math.min(node.pos.y, target.pos.y) + 3}%`,
                      width: `${Math.abs(target.pos.x - node.pos.x)}%`,
                      height: 1,
                    }}
                  />
                );
              })
            )}
          </View>

          {/* Nodes */}
          {FLOOR_NODES.map(node => {
            const style = NODE_STYLES[node.type];
            const isAccessible = node.status === 'AVAILABLE' || node.status === 'CURRENT';

            return (
              <TouchableOpacity
                key={node.id}
                onPress={() => handleNodePress(node)}
                disabled={!isAccessible}
                className={`absolute items-center justify-center ${
                  isAccessible ? '' : 'opacity-40'
                }`}
                style={{
                  left: `${node.pos.x}%`,
                  top: `${node.pos.y}%`,
                  transform: [{ translateX: -28 }, { translateY: -28 }],
                }}
              >
                <View className={`w-14 h-14 border-2 items-center justify-center ${style.border} ${style.bg}`}>
                  <Text className="text-lg">{style.icon}</Text>
                  <Text className={`text-[6px] font-robotomono ${
                    node.type === 'BOSS' ? 'text-secondary' :
                    node.type === 'COMBAT' ? 'text-destructive' :
                    node.type === 'EVENT' ? 'text-accent' : 'text-primary'
                  }`}>
                    {t(`map.nodeTypes.${node.type}`)}
                  </Text>
                </View>
                {node.status === 'CURRENT' && (
                  <Animated.View style={pulseStyle} className="absolute -inset-1 border border-primary" />
                )}
                {node.label && (
                  <Text className="text-primary/50 font-robotomono text-[6px] mt-[2px]">{node.label}</Text>
                )}
                {node.status === 'LOCKED' && (
                  <View className="absolute inset-0 bg-background/70 items-center justify-center">
                    <Text className="text-primary/20 font-robotomono text-xs">?</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Bottom Info Panel */}
      <View className="border-t border-primary/30 p-3 bg-muted/10">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-primary font-robotomono text-[8px]">{t('map.scannerResults')}</Text>
            <Text className="text-primary/60 font-robotomono text-[8px]">
              {t('map.nodes')}: {FLOOR_NODES.length} · {t('map.combats')}: {FLOOR_NODES.filter(n => n.type === 'COMBAT').length} · {t('map.boss')}: 1
            </Text>
          </View>
          <View className="flex-row">
            <View className="flex-row items-center mr-3">
              <View className="w-2 h-2 bg-destructive mr-1" />
              <Text className="text-[7px] text-primary/40 font-robotomono">{t('map.nodeTypes.COMBAT')}</Text>
            </View>
            <View className="flex-row items-center mr-3">
              <View className="w-2 h-2 bg-accent mr-1" />
              <Text className="text-[7px] text-primary/40 font-robotomono">{t('map.nodeTypes.EVENT')}</Text>
            </View>
            <View className="flex-row items-center mr-3">
              <View className="w-2 h-2 bg-primary mr-1" />
              <Text className="text-[7px] text-primary/40 font-robotomono">{t('map.nodeTypes.SAFE_ZONE')}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-2 h-2 bg-secondary mr-1" />
              <Text className="text-[7px] text-primary/40 font-robotomono">{t('map.nodeTypes.BOSS')}</Text>
            </View>
          </View>
        </View>
      </View>

      <GlossaryButton onPress={glossary.open} />
    </View>
  );
};
