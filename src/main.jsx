import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import PublicLoyaltyPage from './components/pages/PublicLoyaltyPage.jsx'

if (/Chrome|CriOS/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-chrome-mobile')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {window.location.pathname.startsWith('/club/') ? <PublicLoyaltyPage /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {scope: '/'}).catch((error) => {
      console.error('Service Worker registration failed:', error)
    })
  })
}
