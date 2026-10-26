import { useEffect, useState } from 'react'

const THEME_KEY = 'dryout.theme.v2'

function loadValue(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

/** 三套主题：写 data-theme 与 colorScheme，并持久化到 localStorage */
export function useTheme() {
  const [theme, setTheme] = useState(() => loadValue(THEME_KEY, 'primary'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light'
    window.localStorage.setItem(THEME_KEY, JSON.stringify(theme))
  }, [theme])

  return { theme, setTheme }
}
