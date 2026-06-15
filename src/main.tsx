import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initMockMode } from './api/mock'

// Honor ?mock=1 / ?mock=0 before the first render so settings are swapped in.
initMockMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
