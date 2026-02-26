import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';

export const ExtractionScreen = ({ navigation }: any) => {
  const [gold, setGold] = useState(0);

  useEffect(() => {
    let current = 0;
    const target = 15400;
    const interval = setInterval(() => {
      current += 154;
      if (current >= target) {
        setGold(target);
        clearInterval(interval);
      } else {
        setGold(current);
      }
    }, 10);
    return () => clearInterval(interval);
  }, []);

  return (
    <View className="flex-1 bg-background p-10 justify-center">
      <CRTOverlay />
      
      <View className="border-4 border-primary p-8 bg-muted">
         <Text className="text-primary font-robotomono text-xl mb-4 text-center">--- LIQUIDACIÓN_TEMPORAL ---</Text>
         
         <View className="space-y-2 mb-8">
            <View className="flex-row justify-between">
               <Text className="text-primary font-robotomono">MAT_HIERRO_NEGRO</Text>
               <Text className="text-primary font-robotomono">x45</Text>
            </View>
            <View className="flex-row justify-between">
               <Text className="text-primary font-robotomono">PULSO_ESTELAR</Text>
               <Text className="text-primary font-robotomono">x12</Text>
            </View>
            <View className="flex-row justify-between">
               <Text className="text-primary font-robotomono">NUCLEO_IA_DAÑADO</Text>
               <Text className="text-primary font-robotomono">x1</Text>
            </View>
         </View>

         <View className="border-t border-primary/40 pt-4 items-center">
            <Text className="text-primary font-robotomono text-xs mb-2">GOLD_EXTRACTION_SUCCESSFUL:</Text>
            <Text className="text-primary font-robotomono text-5xl font-bold">{gold}G</Text>
         </View>
      </View>

      <TouchableOpacity 
        onPress={() => navigation.navigate('Main')}
        className="mt-12 border-2 border-primary p-4 items-center"
      >
        <Text className="text-primary font-bold font-robotomono">VOLVER AL PUEBLO (7 DÍAS DE REPOSO)</Text>
      </TouchableOpacity>
    </View>
  );
};
