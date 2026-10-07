import { ActivityIndicator, View } from 'react-native';
import { BrandMark } from '../src/components/BrandMark';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#062140' }}>
      <BrandMark size={88} />
      <ActivityIndicator color="#01BAEF" style={{ marginTop: 28 }} />
    </View>
  );
}
