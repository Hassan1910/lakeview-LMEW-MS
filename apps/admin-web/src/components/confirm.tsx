import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Button } from './ui';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}

interface Request extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setRequest({ ...options, resolve });
  }), []);

  const close = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Dismiss" onClick={() => close(false)} />
          <div className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900 dark:text-slate-50">{request.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{request.description}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
              <Button variant={request.tone === 'primary' ? 'primary' : 'danger'} onClick={() => close(true)} autoFocus>
                {request.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
