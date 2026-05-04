import { useMemo } from 'react';
import { getAccessState } from '../utils/subscription';

// Reactive wrapper around getAccessState — re-derives whenever the barber
// doc changes. The dashboard already has barber state from onSnapshot, so
// access state stays live without extra subscriptions.
export function useSubscription(barber) {
  return useMemo(() => getAccessState(barber), [barber]);
}
