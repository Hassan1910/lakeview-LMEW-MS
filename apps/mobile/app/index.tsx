import { ActivityIndicator, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { BrandMark } from '../src/components/BrandMark';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const isLoading = useAuthStore((state) => state.isLoading);
  const profileError = useAuthStore((state) => state.profileError);
  const loadProfile = useAuthStore((state) => state.loadProfile);
  const waiting = Boolean(session && !profile && !isLoading && profileError);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#062140', padding: 24 }}>
      <BrandMark size={88} />
      {waiting ? (
        <>
          <Text style={{ color: '#F8FAFC', textAlign: 'center', marginTop: 28 }}>{profileError}</Text>
          <Button mode="contained" style={{ marginTop: 16 }} onPress={() => { void loadProfile(); }}>Try again</Button>
        </>
      ) : (
        <ActivityIndicator color="#01BAEF" style={{ marginTop: 28 }} />
      )}
    </View>
  );
}
