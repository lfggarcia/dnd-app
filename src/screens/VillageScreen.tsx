import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { SliderButton } from '../components/SliderButton';

const TOP_PARTIES = [
  { name: "SQUAD_VULCAN", rep: "98%" },
  { name: "SQUAD_VOID", rep: "85%" },
  { name: "SQUAD_LOBOS", rep: "72%" },
];

export const VillageScreen = ({ navigation }: any) => {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />
      
      {/* Header Info */}
      <View className="p-4 border-b border-secondary/40 flex-row justify-between">
        <Text className="text-secondary font-robotomono text-xs">{">"} SAFE_ZONE: ACTIVATED</Text>
        <Text className="text-secondary font-robotomono text-xs">PUEBLO_LOGISTICS [v4.2]</Text>
      </View>

      <View className="flex-1 flex-row">
        {/* Left: Blueprint Map View */}
        <View className="flex-1 p-4">
           <View className="flex-1 border-2 border-secondary/20 bg-muted/20 relative">
              {/* Grid Background */}
              <View className="absolute inset-0 opacity-10" style={styles.grid} />
              
              {/* "Buildings" as interactive blocks */}
              <TouchableOpacity 
                onPress={() => setSelectedZone("ARMERÍA")}
                className="absolute top-10 left-10 w-20 h-24 border border-secondary bg-secondary/10 items-center justify-center"
              >
                <Text className="text-[10px] text-secondary font-robotomono">ARMERÍA</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setSelectedZone("GREMIO")}
                className="absolute top-40 left-24 w-32 h-16 border border-secondary bg-secondary/10 items-center justify-center"
              >
                <Text className="text-[10px] text-secondary font-robotomono">EL GREMIO</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setSelectedZone("POSADA")}
                className="absolute bottom-10 left-12 w-20 h-20 border border-secondary bg-secondary/10 items-center justify-center"
              >
                <Text className="text-[10px] text-secondary font-robotomono">POSADA</Text>
              </TouchableOpacity>
           </View>
        </View>

        {/* Right: Sub-panels for zones and leaderboard */}
        <View className="w-1/3 border-l border-secondary/40 p-4">
           {selectedZone ? (
             <View className="flex-1">
                <Text className="text-secondary font-robotomono font-bold mb-2">[{selectedZone}]</Text>
                <View className="border border-secondary/40 p-2 bg-muted/40 mb-4">
                   <Text className="text-[10px] text-secondary font-robotomono">LOGISTIC_MODULES_ONLINE</Text>
                   <Text className="text-[8px] text-secondary/60 font-robotomono mt-4 italic">Select items to purchase or configure squad traits here.</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedZone(null)} className="border border-secondary/60 p-2">
                   <Text className="text-[10px] text-secondary text-center font-robotomono">CLOSE_PANEL</Text>
                </TouchableOpacity>
             </View>
           ) : (
             <View className="flex-1">
                <Text className="text-secondary font-robotomono text-xs mb-4">RIVALRY_MONITOR:</Text>
                {TOP_PARTIES.map((p, i) => (
                  <View key={p.name} className="mb-2 p-2 border border-secondary/20 flex-row justify-between">
                     <Text className="text-[10px] text-secondary font-robotomono">{i+1}. {p.name}</Text>
                     <Text className="text-[10px] text-secondary font-robotomono">{p.rep}</Text>
                  </View>
                ))}
             </View>
           )}

           <View className="mt-auto">
             <SliderButton 
               label="START_INCURSION" 
               onConfirm={() => navigation.navigate('Map')}
               width={160}
             />
           </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    backgroundColor: 'rgba(255, 176, 0, 0.05)',
  }
});
