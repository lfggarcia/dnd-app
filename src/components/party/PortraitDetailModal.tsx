import React, { memo } from 'react';
import { Modal, View, Text, Image, TouchableOpacity } from 'react-native';

type Props = {
  uri: string | null;
  onClose: () => void;
};

export const PortraitDetailModal = memo(({ uri, onClose }: Props) => (
  <Modal
    visible={uri !== null}
    transparent
    animationType="fade"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <TouchableOpacity
      style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}
      activeOpacity={1}
      onPress={onClose}
    >
      {uri && (
        <>
          <Image
            source={{ uri }}
            style={{ width: 300, height: 440, borderWidth: 1, borderColor: 'rgba(0,255,65,0.5)', borderRadius: 4 }}
            resizeMode="contain"
          />
          <Text style={{ color: 'rgba(0,255,65,0.4)', marginTop: 12, fontSize: 10, fontFamily: 'RobotoMono-Regular' }}>
            TAP TO CLOSE
          </Text>
        </>
      )}
    </TouchableOpacity>
  </Modal>
));
