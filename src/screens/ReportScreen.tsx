import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CRTOverlay } from '../components/CRTOverlay';
import { TypewriterText } from '../components/TypewriterText';

const REPORT_LINES = [
  "--- AUDITORÍA_DIARIA_COMPLETADA ---",
  "FECHA: CICLO_30 | SECTOR: TORRE_B",
  "XP_TOTAL_RECOLECTADA: 4500",
  "INTEGRIDAD_SQUAD: 88%",
  "MATERIALES_BRUTOS: 12 unidades",
  "-----------------------------------",
];

export const ReportScreen = ({ navigation }: any) => {
  const [showButton, setShowButton] = useState(false);

  return (
    <View className="flex-1 bg-background p-8">
      <CRTOverlay />
      
      <View className="flex-1 bg-primary/5 border border-primary/20 p-4">
         <ScrollView>
            {REPORT_LINES.map((line, i) => (
               <TypewriterText 
                 key={i} 
                 text={line} 
                 delay={30} 
                 className="text-primary text-sm mb-2" 
                 showCursor={false}
               />
            ))}

            <View className="mt-8 p-4 border-2 border-primary/40 bg-primary/10">
               <Text className="text-primary font-bold font-robotomono text-xs mb-2">PERFORMANCE_GRAPH:</Text>
               <View className="h-24 flex-row items-end space-x-2">
                  <View className="w-4 h-full bg-primary" />
                  <View className="w-4 h-3/4 bg-primary" />
                  <View className="w-4 h-1/2 bg-primary" />
                  <View className="w-4 h-2/3 bg-primary" />
               </View>
            </View>

            <View className="mt-8">
               <Text className="text-secondary font-bold font-robotomono text-xs animate-pulse">
                  [ALERTA: PARTY_IA_LOBOS HA CAÍDO EN PISO 3]
               </Text>
            </View>
            
            <View className="h-20" />
         </ScrollView>
      </View>

      <TouchableOpacity 
        onPress={() => navigation.navigate('Extraction')}
        className="mt-6 bg-primary p-4 items-center"
      >
        <Text className="text-background font-bold font-robotomono">CONFIRMAR_LECTURA</Text>
      </TouchableOpacity>
    </View>
  );
};
