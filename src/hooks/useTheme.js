import { useCallback, useEffect, useState } from 'react'

const THEME_KEY = 'icf-clinic-theme'
const THEME_EVENT = 'icf-theme-change'
let cachedTheme = null

function readStoredTheme() {
  if (cachedTheme) return cachedTheme
  try {
    cachedTheme = localStorage.getItem(THEME_KEY) || 'light'
    return cachedTheme
  } catch {
    return 'light'
  }
}

/**
 * Shared dark/light theme state.
 * Keeps every component that renders the nurse avatar (Sidebar, Topbar,
 * Nurse Profile page, etc.) in sync so they all switch portraits together.
 */
export default function useTheme() {
  const [theme, setThemeState] = useState(readStoredTheme)

  useEffect(() => {
    document.body.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    function handleThemeChange(event) {
      setThemeState(event.detail)
    }

    window.addEventListener(THEME_EVENT, handleThemeChange)
    return () => window.removeEventListener(THEME_EVENT, handleThemeChange)
  }, [])

  const setTheme = useCallback((value) => {
    setThemeState((current) => {
      const next = typeof value === 'function' ? value(current) : value

      // Update DOM immediately for instant visual feedback
      document.body.dataset.theme = next
      cachedTheme = next

      // Async localStorage to avoid blocking
      setTimeout(() => {
        try {
          localStorage.setItem(THEME_KEY, next)
        } catch {
          // Storage can be unavailable in strict browser contexts.
        }
      }, 0)

      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }))
      return next
    })
  }, [])

  return [theme, setTheme]
}
