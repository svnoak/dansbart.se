import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { faro, LogLevel } from '@grafana/faro-web-sdk';

export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    faro.api?.pushLog(['page_view'], {
      level: LogLevel.INFO,
      context: { page: location.pathname },
    });
  }, [location.pathname]);

  return null;
}
