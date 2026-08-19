import React, {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';

const NotificationContext = createContext(null);

// In-memory, per-session only — there is no backend table for these yet, so
// nothing here survives a reload. The provider lives inside the signed-in
// Shell tree (see App.jsx), not at the top of the app, specifically so it
// unmounts and resets on sign-out rather than leaking one account's
// notifications into the next session in the same tab.
const MAX_NOTIFICATIONS = 20;

// Module-scoped, not state: an id only needs to be unique within this tab's
// lifetime, and a counter can't collide the way Date.now() could for two
// notifications fired in the same millisecond.
let nextId = 1;

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback(({ title, message }) => {
    setNotifications((prev) => [
      { id: nextId++, title, message, read: false },
      ...prev,
    ].slice(0, MAX_NOTIFICATIONS));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => (
      prev.some((n) => !n.read) ? prev.map((n) => ({ ...n, read: true })) : prev
    ));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo(
    () => ({
      notifications, addNotification, markAllRead, unreadCount,
    }),
    [notifications, addNotification, markAllRead, unreadCount],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}
