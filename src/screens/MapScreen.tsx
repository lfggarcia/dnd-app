import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';

const NODES = [
  { id: 1, type: "START", pos: { x: 10, y: 80 }, status: "CLEAR" },
  { id: 2, type: "ENEMY", pos: { x: 40, y: 50 }, status: "LOCKED", info: "TIPO: NO-MUERTO, AMENAZA: MEDIA" },
  { id: 3, type: "LOOT", pos: { x: 40, y: 110 }, status: "LOCKED" },
  { id: 4, type: "BOSS", pos: { x: 80, y: 80 }, status: "LOCKED" },
];

export const MapScreen = ({ navigation }: any) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 10000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const radarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />
      
      {/* Dynamic Clock */}
      <View className="bg-primary/20 p-2 flex-row justify-between px-6 border-b border-primary">
         <Text className="text-primary font-robotomono text-xs">INCURSION_DAY: 12/30</Text>
         <Text className="text-primary font-bold font-robotomono text-xs">TIME: 18:45</Text>
      </View>

      <View className="flex-1 items-center justify-center p-4">
         {/* Rotating Radar Background */}
         <Animated.View 
           style={[radarStyle, { width: 400, height: 400, borderRadius: 200 }]} 
           className="absolute border border-primary/10 items-center justify-center"
         >
            <View className="w-full h-1 bg-primary/20 absolute" />
            <View className="h-full w-1 bg-primary/20 absolute" />
         </Animated.View>

         {/* Node Tree */}
         <View className="w-full h-full relative">
            {NODES.map((node) => (
              <TouchableOpacity 
                key={node.id}
                onPress={() => node.type === "ENEMY" && navigation.navigate('Battle')}
                className={`absolute w-12 h-12 border-2 items-center justify-center ${node.status === 'CLEAR' ? 'border-primary bg-primary/20' : 'border-primary/20 bg-muted/40'}`}
                style={{ left: `${node.pos.x}%`, top: `${node.pos.y}%`, transform: [{translateX: -24}, {translateY: -24}] }}
              >
                <Text className={`text-[8px] font-robotomono ${node.status === 'CLEAR' ? 'text-primary' : 'text-primary/40'}`}>
                  {node.type}
                </Text>
                {node.status === "LOCKED" && (
                   <View className="absolute inset-0 bg-black/60 items-center justify-center">
                      <Text className="text-primary/20 text-[10px]">?</Text>
                   </View>
                )}
              </TouchableOpacity>
            ))}

            {/* Scanning Info Overlay */}
            <View className="absolute bottom-4 left-4 border border-primary p-2 bg-muted/80">
               <Text className="text-[8px] text-primary font-robotomono">SCANNER_RESULT:</Text>
               <Text className="text-[10px] text-primary font-robotomono">TIPO: NO-MUERTO</Text>
               <Text className="text-[10px] text-primary font-robotomono">AMENAZA: MEDIA</Text>
            </View>
         </View>
      </View>

      <TouchableOpacity 
        onPress={() => navigation.goBack()}
        className="absolute top-12 left-4 border border-primary p-2"
      >
        <Text className="text-primary font-robotomono text-[10px]">RETROCEDER</Text>
      </TouchableOpacity>
    </View>
  );
};
