import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFonts, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Icon-only mark. Paths match lmew/brand/mark.svg. */
export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="14" fill="#0B4F6C" />
      <Path d="M8 52q8-6 16 0t16 0 16 0" fill="none" stroke="#01BAEF" strokeWidth="3.2" strokeLinecap="round" />
      <Path d="M8 58q8-4 16 0t16 0 16 0" fill="none" stroke="#7DD3FC" strokeWidth="2.6" strokeLinecap="round" />
      <Path fill="#F8FAFC" d="M11 34h42l-7 13H18L11 34z" />
      <Circle cx="32" cy="24" r="4.5" fill="#F59E0B" />
    </Svg>
  );
}

export function BrandInline() {
  return (
    <View style={styles.inline}>
      <BrandMark size={36} />
      <Text style={styles.inlineName}>Lakeview Marine</Text>
    </View>
  );
}

export function BrandLockup({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const [loaded] = useFonts({ Outfit_600SemiBold, Outfit_700Bold });
  const light = tone === 'light';
  return (
    <View style={styles.row}>
      <BrandMark size={56} />
      <View style={styles.words}>
        <Text style={[styles.name, light ? styles.nameLight : styles.nameDark, loaded ? styles.outfitBold : null]}>Lakeview Marine</Text>
        <Text style={[styles.kicker, light ? styles.kickerLight : styles.kickerDark, loaded ? styles.outfitSemi : null]}>Engineering Works</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  words: { flexShrink: 1 },
  name: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  nameLight: { color: '#FFFFFF' },
  nameDark: { color: '#0F172A' },
  kicker: { marginTop: 2, fontSize: 11, fontWeight: '600', letterSpacing: 2.2, textTransform: 'uppercase' },
  kickerLight: { color: '#7DD3FC' },
  kickerDark: { color: '#0B4F6C' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineName: { color: '#0F172A', fontSize: 18, fontWeight: '700', flexShrink: 1 },
  outfitBold: { fontFamily: 'Outfit_700Bold' },
  outfitSemi: { fontFamily: 'Outfit_600SemiBold' },
});
