import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// Fonts ship with the app instead of loading from Google, so it opens offline and headings don't jump when a font arrives late.
// Variable fonts: one file holds every weight.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './ui.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
