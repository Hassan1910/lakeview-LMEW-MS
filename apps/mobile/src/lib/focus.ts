import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

export function useRefreshOnFocus(refetch: () => void) {
  const refetchRef = useRef(refetch);
  const firstFocus = useRef(true);
  refetchRef.current = refetch;

  useFocusEffect(useCallback(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    refetchRef.current();
  }, []));
}
