import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
};

export const ConfirmModal = React.memo(({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
}: Props) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={S.backdrop}>
      <View style={S.card}>
        <Text style={S.title}>{title}</Text>
        <Text style={S.message}>{message}</Text>

        <View style={S.row}>
          <TouchableOpacity style={S.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={S.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.confirmBtn, destructive && { borderColor: '#FF3E3E' }]}
            onPress={onConfirm}
            activeOpacity={0.7}
          >
            <Text style={[S.confirmText, destructive && { color: '#FF3E3E' }]}>
              {confirmLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
));

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.3)',
    backgroundColor: '#0A0E0A',
    padding: 20,
  },
  title: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 13,
    color: '#00FF41',
    marginBottom: 12,
  },
  message: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: 'rgba(0,255,65,0.6)',
    lineHeight: 18,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.2)',
  },
  cancelText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: 'rgba(0,255,65,0.5)',
  },
  confirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#00FF41',
  },
  confirmText: {
    fontFamily: 'RobotoMono-Bold',
    fontSize: 10,
    color: '#00FF41',
  },
});
