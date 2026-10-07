import type { UserRole } from '@lmew/shared-types';

declare module 'vue-router' {
  interface RouteMeta {
    auth?: boolean;
    roles?: UserRole[];
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
