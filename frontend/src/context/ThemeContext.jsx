import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

function getInitialTheme() {
  const saved = localStorage.getItem('nh_theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [auto, setAuto] = useState(() => !localStorage.getItem('nh_theme'));

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // Follow system when in auto mode
  useEffect(() => {
    if (!auto) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = e => setTheme(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [auto]);

  function toggle() {
    setAuto(false);
    localStorage.setItem('nh_theme', theme === 'dark' ? 'light' : 'dark');
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  function enableAuto() {
    setAuto(true);
    localStorage.removeItem('nh_theme');
    setTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, auto, enableAuto }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
