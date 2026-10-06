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

declare module 'lucide-vue-next' {
  import type { FunctionalComponent } from 'vue';
  export const Anchor: FunctionalComponent<any>;
  export const Package: FunctionalComponent<any>;
  export const ArrowLeftRight: FunctionalComponent<any>;
  export const Truck: FunctionalComponent<any>;
  export const FileCheck2: FunctionalComponent<any>;
  export const UserPlus: FunctionalComponent<any>;
}
