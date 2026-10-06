import { ActivityIndicator, View } from 'react-native';
import { palette } from '../src/theme';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }}>
      <ActivityIndicator color={palette.primary} />
    </View>
  );
}
