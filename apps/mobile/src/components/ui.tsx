import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, ui } from '../theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={ui.screen}>{children}</View>;
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <ScrollView contentContainerStyle={ui.pad} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </Screen>
  );
}

export function FormScreen({ children, topInset = false }: { children: React.ReactNode; topInset?: boolean }) {
  return (
    <SafeAreaView style={ui.screen} edges={topInset ? ['top', 'bottom'] : ['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[ui.pad, topInset ? { paddingTop: 32 } : null]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Notice({ tone, text }: { tone: 'error' | 'ok' | 'info'; text: string }) {
  return (
    <View style={[styles.notice, tone === 'error' ? styles.error : tone === 'ok' ? styles.ok : styles.info]}>
      <Text style={tone === 'error' ? styles.errorText : tone === 'ok' ? styles.okText : styles.infoText}>{text}</Text>
    </View>
  );
}

export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function FieldLine({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={ui.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  error: { backgroundColor: palette.dangerBg },
  ok: { backgroundColor: palette.successBg },
  info: { backgroundColor: '#F1F5F9' },
  errorText: { color: palette.danger, fontSize: 14 },
  okText: { color: palette.success, fontSize: 14 },
  infoText: { color: palette.muted, fontSize: 14 },
  choice: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  choiceText: { color: palette.text, fontSize: 13, fontWeight: '600' },
  choiceTextOn: { color: '#FFFFFF' },
  field: { gap: 2 },
  fieldLabel: { color: palette.muted, fontSize: 12, fontWeight: '600' },
});
