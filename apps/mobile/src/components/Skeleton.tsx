import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { radius } from '../theme';

export function SkeletonBlock({ height = 88 }: { height?: number }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.block, { height, opacity }]} />;
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => <SkeletonBlock key={index} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: '#E2E8F0', borderRadius: radius.card, width: '100%' },
  list: { gap: 12 },
});
