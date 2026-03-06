import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TypewriterText } from '../components/TypewriterText';
import { CRTOverlay } from '../components/CRTOverlay';
import type { ScreenProps } from '../navigation/types';

const BOOT_LOGS = [
  "[KERNEL_INIT] ............ OK",
  "[TOWER_PROTOCOL] ........ ACTIVE",
  "[SEED_ENGINE] ........... STANDBY",
  "[SOUL_REGISTRY] ......... 0 LOADED",
  "[CYCLE_CLOCK] ........... OFFLINE",
  "[DND_CORE v5e] .......... LINKED",
  "[UPLINK] ................ SECURE",
];

const MENU_ITEMS = [
  { key: 'continue', label: 'CONTINUE_EXPEDITION', enabled: false },
  { key: 'new', label: 'NEW_SEED', enabled: true },
  { key: 'load', label: 'LOAD_SEED', enabled: false },
  { key: 'settings', label: 'SYSTEM_CONFIG', enabled: false },
  { key: 'credits', label: 'CREDITS', enabled: false },
] as const;

export const MainScreen = ({ navigation }: ScreenProps<'Main'>) => {
  const [bootComplete, setBootComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBootComplete(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleMenuPress = (key: string) => {
    if (key === 'new') navigation.navigate('Seed');
  };

  return (
    <View className="flex-1 bg-background">
      <CRTOverlay />

      {/* Boot Logs */}
      <View className="absolute top-12 left-6 right-6 opacity-30">
        {BOOT_LOGS.map((log, i) => (
          <Text key={i} className="text-[9px] text-primary font-robotomono leading-4">
            {log}
          </Text>
        ))}
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {/* Tower ASCII Logo */}
        <Text className="text-primary font-robotomono text-[10px] mb-2 text-center leading-[12px]">
{`████████╗ ██████╗ ██████╗ ██████╗ ███████╗
╚══██╔══╝██╔═══██╗██╔══██╗██╔══██╗██╔════╝
   ██║   ██║   ██║██████╔╝██████╔╝█████╗  
   ██║   ██║   ██║██╔══██╗██╔══██╗██╔══╝  
   ██║   ╚██████╔╝██║  ██║██║  ██║███████╗
   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝`}
        </Text>

        <Text className="text-secondary font-robotomono text-[9px] mb-1">
          100 FLOORS · 60 CYCLES · 10 PARTIES · 1 TOWER
        </Text>
        <View className="w-48 h-[1px] bg-primary/30 mb-10" />

        {/* Menu */}
        <View className="w-full max-w-xs space-y-3">
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => handleMenuPress(item.key)}
              disabled={!item.enabled}
              className={`border border-primary/40 p-3 ${
                item.enabled ? 'bg-primary/5' : 'opacity-30'
              }`}
            >
              <View className="flex-row items-center">
                <Text className="text-primary font-robotomono text-[10px] mr-2 opacity-40">
                  {String(i).padStart(2, '0')}
                </Text>
                {item.key === 'new' && bootComplete ? (
                  <TypewriterText
                    text={item.label}
                    className="text-primary font-bold text-base"
                    delay={40}
                    showCursor={false}
                  />
                ) : (
                  <Text className={`font-robotomono text-base ${
                    item.enabled ? 'text-primary font-bold' : 'text-primary'
                  }`}>
                    {item.label}
                  </Text>
                )}
                {!item.enabled && item.key !== 'continue' && (
                  <Text className="text-primary/30 font-robotomono text-[8px] ml-auto">
                    [LOCKED]
                  </Text>
                )}
                {item.key === 'continue' && (
                  <Text className="text-primary/30 font-robotomono text-[8px] ml-auto">
                    [NO_SAVE]
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View className="px-6 pb-6 flex-row justify-between items-end">
        <Text className="text-[9px] text-primary/30 font-robotomono">
          TORRE_OS v2.0 | DND_5E_CORE
        </Text>
        <Text className="text-[9px] text-primary/30 font-robotomono">
          PROTOCOL_ACTIVE
        </Text>
      </View>
    </View>
  );
};
