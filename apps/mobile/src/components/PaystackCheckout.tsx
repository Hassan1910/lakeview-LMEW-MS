import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { classifyPaystackNavigation } from '@lmew/shared-types';
import { palette } from '../theme';

type CloseReason = 'callback' | 'cancel' | 'close';

export function PaystackCheckout({
  url,
  onDone,
  onPartnerReturn,
}: {
  url: string;
  onDone: (reason: CloseReason) => void;
  onPartnerReturn: () => void;
}) {
  const webRef = useRef<WebView>(null);
  const handled = useRef(false);
  const handedOff = useRef(false);
  const partnerReturnRef = useRef(onPartnerReturn);
  partnerReturnRef.current = onPartnerReturn;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !handedOff.current) return;
      handedOff.current = false;
      partnerReturnRef.current();
    });
    return () => subscription.remove();
  }, []);

  const finish = (reason: CloseReason) => {
    if (handled.current) return;
    handled.current = true;
    onDone(reason);
  };

  const allow = (nextUrl: string) => {
    const kind = classifyPaystackNavigation(nextUrl);
    if (kind === 'partner') {
      handedOff.current = true;
      void Linking.openURL(nextUrl);
      return false;
    }
    if (kind === 'checkout') return true;
    finish(kind);
    return false;
  };

  const openInPlace = (event: Parameters<NonNullable<WebViewProps['onOpenWindow']>>[0]) => {
    const target = event.nativeEvent.targetUrl;
    if (!target || !allow(target)) return;
    webRef.current?.injectJavaScript(`window.location.assign(${JSON.stringify(target)}); true;`);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => finish('close')} presentationStyle="fullScreen">
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.bar}>
          <Text style={styles.title}>Pay with Paystack</Text>
          <Pressable accessibilityRole="button" onPress={() => finish('close')} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <WebView
          ref={webRef}
          source={{ uri: url }}
          style={styles.web}
          originWhitelist={['http://*', 'https://*', 'about:blank', 'lmew://*']}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          setSupportMultipleWindows={false}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.primary} />
            </View>
          )}
          onShouldStartLoadWithRequest={(request) => allow(request.url)}
          onNavigationStateChange={(nav) => {
            const kind = classifyPaystackNavigation(nav.url);
            if (kind === 'callback' || kind === 'cancel' || kind === 'close') finish(kind);
          }}
          onOpenWindow={openInPlace}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.primary },
  bar: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.primary,
  },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  close: { paddingVertical: 8, paddingHorizontal: 4 },
  closeText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  web: { flex: 1, backgroundColor: '#FFFFFF' },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
