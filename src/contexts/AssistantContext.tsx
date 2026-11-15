import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Ctx = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  subscribed: boolean;
  setSubscribed: (v: boolean) => void;
  lastSeenAt: string | null;
  markSeen: () => void;
  ready: boolean;
};

const KEY_ENABLED = 'assistant.enabled';
const KEY_SUBSCRIBED = 'assistant.subscribed';
const KEY_SEEN = 'assistant.lastSeenAt';

const AssistantContext = createContext<Ctx | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [subscribed, setSubscribedState] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [e, s, t] = await Promise.all([
          AsyncStorage.getItem(KEY_ENABLED),
          AsyncStorage.getItem(KEY_SUBSCRIBED),
          AsyncStorage.getItem(KEY_SEEN),
        ]);
        if (e !== null) setEnabledState(e === '1');
        if (s !== null) setSubscribedState(s === '1');
        setLastSeenAt(t);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    AsyncStorage.setItem(KEY_ENABLED, v ? '1' : '0').catch(() => {});
  }, []);

  const setSubscribed = useCallback((v: boolean) => {
    setSubscribedState(v);
    AsyncStorage.setItem(KEY_SUBSCRIBED, v ? '1' : '0').catch(() => {});
  }, []);

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    setLastSeenAt(now);
    AsyncStorage.setItem(KEY_SEEN, now).catch(() => {});
  }, []);

  return (
    <AssistantContext.Provider
      value={{ enabled, setEnabled, subscribed, setSubscribed, lastSeenAt, markSeen, ready }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within AssistantProvider');
  return ctx;
}
