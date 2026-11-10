import { type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useColorScheme, type TextInputProps } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const light = { background: '#F3F6F4', surface: '#FFFFFF', text: '#142B23', muted: '#4A6359',
  border: '#D5E2DB', accent: '#00624D', onAccent: '#FFFFFF', danger: '#A12E38' };
const dark: typeof light = { background: '#101A17', surface: '#192823', text: '#EAF5EE',
  muted: '#ADCCC0', border: '#365046', accent: '#88E1C3', onAccent: '#08291E', danger: '#FFB2B8' };

export const usePalette = () => useColorScheme() === 'dark' ? dark : light;

export function Screen({ children }: PropsWithChildren) {
  const colors = usePalette();
  const { top, left, right } = useSafeAreaInsets();
  return <ScrollView style={{ backgroundColor: colors.background, flex: 1 }}
    keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.screen, { paddingTop: top + 24, paddingLeft: left + 24, paddingRight: right + 24 }]}>
    <View style={styles.column}>{children}</View>
  </ScrollView>;
}

export function Copy({ children, tone = 'text' }: PropsWithChildren<{ tone?: 'text' | 'muted' | 'danger' }>) {
  const colors = usePalette();
  return <Text style={[styles.copy, { color: colors[tone] }]}
    accessibilityLiveRegion={tone === 'danger' ? 'polite' : 'none'}>{children}</Text>;
}

export function Heading({ title, description }: { title: string; description: string }) {
  const colors = usePalette();
  return <View style={{ gap: 6 }}>
    <Text style={[styles.eyebrow, { color: colors.accent }]}>FAMILY BUDGET  /  EUR</Text>
    <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{title}</Text>
    <Copy tone="muted">{description}</Copy>
  </View>;
}

export function Card({ children }: PropsWithChildren) {
  const colors = usePalette();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const colors = usePalette();
  return <View style={{ gap: 6 }}>
    <Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted}
      style={[styles.input, { borderColor: error ? colors.danger : colors.border, color: colors.text }]} {...props} />
    {error ? <Copy tone="danger">{error}</Copy> : null}
  </View>;
}

export function Button({ title, onPress, secondary = false, busy = false, disabled = false }:
  { title: string; onPress: () => void; secondary?: boolean; busy?: boolean; disabled?: boolean }) {
  const colors = usePalette();
  return <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy || disabled }}
    disabled={busy || disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.surface : colors.accent,
      borderColor: colors.accent, opacity: pressed || busy || disabled ? 0.65 : 1 }]}>
    {busy ? <ActivityIndicator color={secondary ? colors.accent : colors.onAccent} /> :
      <Text style={{ color: secondary ? colors.accent : colors.onAccent, fontWeight: '700' }}>{title}</Text>}
  </Pressable>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  const colors = usePalette();
  return <Screen><Card><ActivityIndicator color={colors.accent} /><Copy>{label}</Copy></Card></Screen>;
}

const styles = StyleSheet.create({
  screen: { padding: 24, paddingBottom: 40, alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, gap: 20 },
  heading: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  copy: { fontSize: 15, lineHeight: 22 },
  card: { padding: 18, gap: 14, borderWidth: 1, borderRadius: 16 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 48, fontSize: 16 },
  button: { borderWidth: 1, borderRadius: 10, minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 10 },
});
