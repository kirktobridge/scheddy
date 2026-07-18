import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initMockMode } from './api/mock'
import { evictOlderThan, hydrate } from './api/eventCache'

// Honor ?mock=1 / ?mock=0 before the first render so settings are swapped in.
initMockMode()

const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// Load the persisted event cache first so a warm start paints from it, then drop
// anything past the evictable TTL. Never let a cache hiccup block the app.
hydrate()
  .then(() => evictOlderThan())
  .catch(() => {})
  .finally(render)
