'use client';

import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { Tooltip } from '@/components/arc/tooltip/tooltip';
import styles from './theme-toggle.module.css';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }

  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const label = `Use ${nextTheme} theme`;

  return (
    <Tooltip content={label} side="bottom">
      <Button aria-label={label} aria-pressed={theme === 'dark'} className={styles.button} onClick={toggleTheme} size="sm" variant="ghost">
        {theme === 'light' ? <Moon aria-hidden="true" size={18} /> : <Sun aria-hidden="true" size={18} />}
      </Button>
    </Tooltip>
  );
}
