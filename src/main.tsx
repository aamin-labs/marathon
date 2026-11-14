import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// Fonts ship with the app instead of loading from Google, so it opens offline and headings don't jump when a font arrives late.
// Variable fonts: one file holds every weight.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './ui.css'

// When the system flips between light and dark, switch every colour at once.
// Without this the buttons and fields, which ease their colours on hover, fade across while the rest of the page snaps.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const root = document.documentElement
  root.classList.add('no-transitions')
  // Two frames: the first paints the new colours, the second is safely after it.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-transitions')))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
