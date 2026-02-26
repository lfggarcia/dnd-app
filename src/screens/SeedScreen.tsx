import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat,
  withSequence,
  runOnJS
} from 'react-native-reanimated';
import { CRTOverlay } from '../components/CRTOverlay';

const { width, height } = Dimensions.get('window');

// Matrix-style data column
const DataColumn = ({ index }: { index: number }) => {
  const [chars, setChars] = useState("");
  const opacity = useSharedValue(0.1);

  useEffect(() => {
    const charsList = "0123456789ABCDEF#!@$%&*";
    const updateChars = () => {
      let result = "";
      for(let i=0; i<20; i++) {
        result += charsList.charAt(Math.floor(Math.random() * charsList.length)) + "\n";
      }
      setChars(result);
    };

    const interval = setInterval(updateChars, 100 + Math.random() * 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <View className="mx-1">
      <Text className="text-[10px] text-secondary/40 font-robotomono">
        {chars}
      </Text>
    </View>
  );
};

export const SeedScreen = ({ navigation }: any) => {
  const [seed, setSeed] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const processingAnim = useSharedValue(0);

  const onExecute = () => {
    setIsProcessing(true);
    processingAnim.value = withTiming(1, { duration: 2000 }, () => {
      runOnJS(navigation.navigate)('Party');
    });
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: processingAnim.value,
    backgroundColor: '#FFB000', // Amber color from prompt
  }));

  return (
    <View className="flex-1 bg-background p-6">
      <CRTOverlay />
      
      {/* Background Matrix/Data Effect */}
      <View className="absolute inset-0 flex-row justify-center opacity-20" pointerEvents="none">
        {Array.from({ length: 15 }).map((_, i) => (
          <DataColumn key={i} index={i} />
        ))}
      </View>

      <View className="flex-1 justify-center">
        <Text className="text-secondary font-robotomono text-sm mb-2">
          [!] INPUT_SEED_REDUX
        </Text>
        
        <View className="border-2 border-secondary p-4 bg-muted">
          <TextInput
            className="text-3xl text-secondary font-robotomono h-12"
            value={seed}
            onChangeText={setSeed}
            placeholder="XXXX-XXXX"
            placeholderTextColor="#FFB00040"
            autoCapitalize="characters"
            maxLength={12}
          />
        </View>
        
        <Text className="text-secondary/60 font-robotomono text-[10px] mt-2">
          HASH: {seed ? "SYNCED" : "AWAITING_INPUT"} | BUFFER: 256kb
        </Text>

        <TouchableOpacity 
          onPress={onExecute}
          disabled={!seed || isProcessing}
          className={`mt-12 border-2 border-secondary p-4 items-center ${!seed ? 'opacity-30' : ''}`}
        >
          <Text className="text-secondary font-bold text-xl font-robotomono">
            [ EJECUTAR_DESTINO ]
          </Text>
        </TouchableOpacity>
      </View>

      {/* Completion Overlay */}
      <Animated.View 
        style={[overlayStyle, { position: 'absolute', inset: 0 }]} 
        pointerEvents="none" 
      />
    </View>
  );
};
