import { loadProjectEnv } from '@expo/env';
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  // Expo already loaded apps/mobile/.env (there is none). Force a second load of the monorepo root.
  loadProjectEnv(`${projectRoot}/../..`, { force: true, silent: true });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  return {
    ...config,
    name: config.name ?? 'Lakeview Marine',
    slug: config.slug ?? 'lakeview-marine',
    extra: {
      ...config.extra,
      ...(supabaseUrl ? { supabaseUrl } : {}),
      ...(supabaseAnonKey ? { supabaseAnonKey } : {}),
    },
  };
};
