import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTelemetry } from './lib/telemetry'

initTelemetry()

// Migração de segurança (2026-06): a config de provider de IA no cliente foi
// removida — chaves de API nunca devem persistir em localStorage. Purga o que
// usuários antigos ainda tiverem salvo.
localStorage.removeItem('stocks-ai-provider-config')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
