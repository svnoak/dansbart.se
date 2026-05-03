import {
  createRoutesFromChildren,
  matchRoutes,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import {
  initializeFaro,
  getWebInstrumentations,
  ReactIntegration,
  createReactRouterV7Options,
} from '@grafana/faro-react';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

declare global {
  interface Window {
    __ENV__?: {
      FARO_COLLECTOR_URL?: string;
      FARO_APP_NAME?: string;
    };
  }
}

export function initFaro() {
  const url = window.__ENV__?.FARO_COLLECTOR_URL;
  if (!url) return;

  initializeFaro({
    url,
    app: {
      name: window.__ENV__?.FARO_APP_NAME ?? 'dansbart-frontend',
      environment: 'production',
    },
    instrumentations: [
      ...getWebInstrumentations(),
      new TracingInstrumentation(),
      new ReactIntegration({
        router: createReactRouterV7Options({
          createRoutesFromChildren,
          matchRoutes,
          Routes,
          useLocation,
          useNavigationType,
        }),
      }),
    ],
  });
}
