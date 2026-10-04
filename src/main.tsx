import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { appStore } from './state/appStore'
import { documentStore } from './state/documentStore'
import { detectionStore } from './pdf/detect'
import './index.css'

// Development only: lets automated tests inspect state. Stripped from production builds.
if (import.meta.env.DEV) Object.assign(window, { __lamina: { appStore, documentStore, detectionStore } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
