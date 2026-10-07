import { reactive } from 'vue';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}

interface Pending extends Required<Pick<ConfirmOptions, 'title' | 'description' | 'confirmLabel' | 'tone'>> {
  resolve: (value: boolean) => void;
}

export const confirmState = reactive<{ pending: Pending | null }>({ pending: null });

export function confirm(options: ConfirmOptions) {
  return new Promise<boolean>((resolve) => {
    confirmState.pending = {
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? 'Confirm',
      tone: options.tone ?? 'danger',
      resolve,
    };
  });
}

export function closeConfirm(value: boolean) {
  confirmState.pending?.resolve(value);
  confirmState.pending = null;
}
