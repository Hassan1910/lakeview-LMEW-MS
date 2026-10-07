import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBody } from '../components/ScreenBody';
import { paystackReferenceFromParams, verifyPaystackPayment } from '../lib/paystack';
import { useAuthStore } from '../store/authStore';
import { palette, ui } from '../theme';

export function PaystackReturn() {
  const params = useLocalSearchParams<{ reference?: string | string[]; trxref?: string | string[] }>();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const authLoading = useAuthStore((s) => s.isLoading);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setError('Sign in to finish checking this payment.');
      return;
    }
    let cancelled = false;
    const reference = paystackReferenceFromParams(params.reference, params.trxref);
    if (!reference) {
      setError('This payment link is missing a reference.');
      return;
    }
    void verifyPaystackPayment(reference).then((result) => {
      if (cancelled) return;
      if (result.invoice_id) {
        router.replace(`/(customer)/pay/${result.invoice_id}?paystackReference=${encodeURIComponent(result.reference)}`);
        return;
      }
      setError(result.message ?? 'This payment could not be opened.');
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, session, params.reference, params.trxref, router]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Button mode="contained" onPress={() => router.replace(session ? '/(customer)/invoices' : '/(auth)/login')}>
          {session ? 'Back to invoices' : 'Sign in'}
        </Button>
      </View>
    );
  }

  return (
    <ScreenBody loading>
      <Text style={ui.muted}>Checking payment…</Text>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: palette.bg,
  },
  error: { color: palette.danger, textAlign: 'center', fontSize: 15, lineHeight: 22 },
});
