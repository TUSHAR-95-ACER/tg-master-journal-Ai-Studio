import { useEffect, useState } from 'react';

/** Tracks navigator.onLine and fires callbacks when connectivity changes. */
export function useOnlineStatus(): { online: boolean; wasOffline: boolean } {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const on = () => {
      setOnline(true);
    };
    const off = () => {
      setOnline(false);
      setWasOffline(true);
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return { online, wasOffline };
}
