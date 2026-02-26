import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';

const RAZAS = ["HUMAN", "CYBORG", "SYNTH", "MUTANT"];
const MODULES = ["AGRESIVO", "PARANOIDE", "ESTOICO", "ANALÍTICO"];

export const PartyScreen = ({ navigation }: any) => {
  const [raza, setRaza] = useState(0);
  const [stats, setStats] = useState({ STR: 10, DEX: 12, INT: 8, VIT: 15, SPD: 10 });

  return (
    <View className="flex-1 bg-background p-4">
      <CRTOverlay />
      
      <View className="flex-row justify-between mb-4 border-b border-primary pb-2">
        <Text className="text-primary font-robotomono text-xs">[ ENAMBLAJE_ALFA ]</Text>
        <Text className="text-primary font-robotomono text-xs">UNIT_ID: PX-089</Text>
      </View>

      <View className="flex-1 flex-row">
        {/* Left: Biometric Visor */}
        <View className="w-1/3 border border-primary/40 p-2 items-center justify-center">
          <View className="w-full h-48 bg-muted border border-primary/20 items-center justify-center">
             {/* Placeholder for Character Sprite */}
             <View className="w-20 h-32 border border-primary/60 border-dashed" />
             <View className="absolute top-0 left-0 p-1">
                <Text className="text-[8px] text-primary/60 font-robotomono">SCAN_ACTIVE</Text>
             </View>
          </View>
          <View className="mt-4 w-full">
            <Text className="text-[10px] text-primary font-robotomono">BIO_DATA:</Text>
            <Text className="text-[10px] text-primary/60 font-robotomono">STATUS: NOMINAL</Text>
          </View>
        </View>

        {/* Center: Attribute Pentagon (Simplified for now) */}
        <View className="flex-1 px-4 items-center">
           <Text className="text-primary font-robotomono text-xs mb-4">ATTRIBUTE_RADAR</Text>
           <View className="w-32 h-32 border border-primary/40 rounded-full items-center justify-center">
              {Object.entries(stats).map(([key, val], i) => (
                <View key={key} className="absolute overflow-visible" style={{ 
                  transform: [{ rotate: `${i * 72}deg` }, { translateY: -50 }] 
                }}>
                  <Text className="text-[10px] text-secondary font-robotomono">{key}:{val}</Text>
                </View>
              ))}
              <View className="w-16 h-16 bg-primary/20 rounded-full" />
           </View>
        </View>

        {/* Right: Modules & Race */}
        <View className="w-1/3 space-y-4">
          <View>
            <Text className="text-primary font-robotomono text-[10px] mb-1">RAZA_TYPE:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {RAZAS.map((r, i) => (
                <TouchableOpacity 
                  key={r} 
                  onPress={() => setRaza(i)}
                  className={`mr-2 px-2 py-1 border ${raza === i ? 'bg-primary border-primary' : 'border-primary/40'}`}
                >
                  <Text className={`text-[10px] font-robotomono ${raza === i ? 'text-background' : 'text-primary'}`}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View className="flex-1 border border-primary/40 p-2">
            <Text className="text-primary font-robotomono text-[10px] mb-2">PSYCH_MODULES:</Text>
            {MODULES.map((m) => (
              <View key={m} className="mb-2 p-2 bg-muted border border-primary/20 flex-row justify-between items-center">
                <Text className="text-[8px] text-primary/80 font-robotomono">{m}</Text>
                <View className="w-2 h-2 bg-primary/40" />
              </View>
            ))}
          </View>
        </View>
      </View>

      <TouchableOpacity 
        onPress={() => navigation.navigate('Village')}
        className="mt-4 bg-primary p-3 items-center"
      >
        <Text className="text-background font-bold font-robotomono">CONFIRMAR_SUJETO</Text>
      </TouchableOpacity>
    </View>
  );
};
