import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OpenFeatureProvider } from '@openfeature/react-sdk'
import './index.css'
import App from './App.tsx'
import { initFeatureFlags } from './featureFlags.ts'

initFeatureFlags();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OpenFeatureProvider>
      <App />
    </OpenFeatureProvider>
  </StrictMode>,
)
