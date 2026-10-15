import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { worker } from './mocks/browser'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

async function bootstrap() {
  if (import.meta.env.DEV) {
    await worker.start({
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
      onUnhandledFrame: 'bypass',
    })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
