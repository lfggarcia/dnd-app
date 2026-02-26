import { View, Text, TouchableOpacity } from 'react-native';
import { TypewriterText } from '../components/TypewriterText';
import { CRTOverlay } from '../components/CRTOverlay';

const LOGS = [
  "[KERNEL_OK]",
  "[TEMP_PISO_01: 22°C]",
  "[ALMAS_DETECTADAS: 30]",
  "[MEM_LINK: SECURE]",
  "[UPLINK: ACTIVE]",
];

export const MainScreen = ({ navigation }: any) => {
  return (
    <View className="flex-1 bg-background p-6">
      <CRTOverlay />
      
      {/* Background System Logs */}
      <View className="absolute top-4 left-4 opacity-30">
        {LOGS.map((log, i) => (
          <Text key={i} className="text-[10px] text-primary font-robotomono">
            {log}
          </Text>
        ))}
      </View>

      <View className="flex-1 items-center justify-center">
        <Text className="text-primary font-robotomono text-xs mb-8 text-center leading-3">
          {`
 ██████╗██╗   ██╗██████╗ ███████╗██████╗ 
██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗
██║      ╚████╔╝ ██████╔╝█████╗  ██████╔╝
██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██╗
╚██████╗   ██║   ██████╔╝███████╗██║  ██║
 ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝
          `}
        </Text>

        <View className="space-y-6 w-full max-w-xs">
          <TouchableOpacity 
            onPress={() => navigation.navigate('Seed')}
            className="flex-row items-center"
          >
            <TypewriterText 
              text="NEW_REPLICATION" 
              className="text-xl text-primary font-bold" 
            />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center opacity-50">
            <Text className="text-xl text-primary font-robotomono">LOAD_STATE</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center opacity-50">
            <Text className="text-xl text-primary font-robotomono">SYSTEM_CONFIG</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="absolute bottom-4 right-4">
        <Text className="text-[10px] text-primary/50 font-robotomono">
          v1.0.4-BETA | PROTOCOL_DND
        </Text>
      </View>
    </View>
  );
};
