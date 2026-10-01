import { useCallback, useEffect, useState } from 'react'

const THEME_KEY = 'icf-clinic-theme'
const THEME_EVENT = 'icf-theme-change'
let cachedTheme = null

function normalizeTheme(value) {
  return value === 'dark' ? 'dark' : 'light'
}

function readStoredTheme() {
  if (cachedTheme) return cachedTheme
  try {
    cachedTheme = normalizeTheme(localStorage.getItem(THEME_KEY))
    return cachedTheme
  } catch {
    return 'light'
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage can be unavailable in strict browser contexts.
  }
}

function applyTheme(theme) {
  const next = normalizeTheme(theme)
  cachedTheme = next
  document.body.dataset.theme = next
  persistTheme(next)
  return next
}

/**
 * Shared dark/light theme state.
 * Keeps every component that renders the nurse avatar (Sidebar, Topbar,
 * Nurse Profile page, etc.) in sync so they all switch portraits together.
 */
export default function useTheme() {
  const [theme, setThemeState] = useState(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    function handleThemeChange(event) {
      setThemeState(normalizeTheme(event.detail))
    }

    window.addEventListener(THEME_EVENT, handleThemeChange)
    return () => window.removeEventListener(THEME_EVENT, handleThemeChange)
  }, [])

  const setTheme = useCallback((value, origin) => {
    const current = readStoredTheme()
    const next = normalizeTheme(typeof value === 'function' ? value(current) : value)

    const syncThemeState = () => {
      applyTheme(next)
      setThemeState(next)
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }))
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const canAnimate = Boolean(origin && document.startViewTransition && !reducedMotion)

    if (!canAnimate) {
      syncThemeState()
      return next
    }

    const x = Math.round(origin.x)
    const y = Math.round(origin.y)
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )
    document.documentElement.style.setProperty('--theme-wave-x', `${x}px`)
    document.documentElement.style.setProperty('--theme-wave-y', `${y}px`)
    document.documentElement.style.setProperty('--theme-wave-radius', `${radius}px`)

    const transition = document.startViewTransition(syncThemeState)
    transition.ready
      .then(() => document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at var(--theme-wave-x) var(--theme-wave-y))`,
            `circle(var(--theme-wave-radius) at var(--theme-wave-x) var(--theme-wave-y))`,
          ],
        },
        {
          duration: 680,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      ))
      .catch(() => {})

    return next
  }, [])

  return [theme, setTheme]
}
