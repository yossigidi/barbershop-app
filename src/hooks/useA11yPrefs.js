import { useSyncExternalStore } from 'react';
import { a11yStore } from '../utils/a11yPrefs';

export function useA11yPrefs() {
  return useSyncExternalStore(
    a11yStore.subscribe,
    a11yStore.getSnapshot,
    a11yStore.getServerSnapshot,
  );
}
