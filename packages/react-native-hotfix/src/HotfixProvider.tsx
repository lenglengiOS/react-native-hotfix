import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { Hotfix } from './Hotfix';
import type {
  HotfixCheckResult,
  HotfixHookResult,
  HotfixState,
} from './types';

const HotfixContext = createContext<HotfixHookResult | null>(null);

function errorFrom(value: unknown) {
  return value instanceof Error ? value : new Error(String(value));
}

export function HotfixProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<HotfixState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const nextState = await Hotfix.getState();
        if (active) {
          setState(nextState);
        }
        await Hotfix.markReady();
        const confirmedState = await Hotfix.getState();
        if (active) {
          setState(confirmedState);
          setReady(true);
          setError(null);
        }
      } catch (caught) {
        if (active) {
          setReady(true);
          setError(errorFrom(caught));
        }
      }
    }
    initialize();
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const nextState = await Hotfix.getState();
    setState(nextState);
    return nextState;
  }, []);

  const checkForUpdate = useCallback(async (): Promise<HotfixCheckResult> => {
    setChecking(true);
    try {
      const result = await Hotfix.checkForUpdate();
      await refresh();
      setError(null);
      return result;
    } catch (caught) {
      const nextError = errorFrom(caught);
      setError(nextError);
      throw nextError;
    } finally {
      setChecking(false);
    }
  }, [refresh]);

  const value = useMemo<HotfixHookResult>(
    () => ({
      ready,
      state,
      error,
      checking,
      checkForUpdate,
      refresh,
    }),
    [checking, checkForUpdate, error, ready, refresh, state],
  );

  return (
    <HotfixContext.Provider value={value}>{children}</HotfixContext.Provider>
  );
}

export function useHotfix(): HotfixHookResult {
  const value = useContext(HotfixContext);
  if (!value) {
    throw new Error('useHotfix must be used below HotfixProvider');
  }
  return value;
}
