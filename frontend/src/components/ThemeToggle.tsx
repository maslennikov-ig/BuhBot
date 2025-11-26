'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) return <div className="w-10 h-10" />; // Prevent hydration mismatch

  return (
    <button
      onClick={toggleTheme}
      className="relative w-10 h-10 rounded-full bg-[var(--buh-surface-elevated)] border border-[var(--buh-border)] flex items-center justify-center transition-colors duration-200 hover:border-[var(--buh-primary)] group"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait">
        {resolvedTheme === 'light' ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Moon className="w-5 h-5 text-[var(--buh-foreground-muted)] group-hover:text-[var(--buh-primary)] transition-colors" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Sun className="w-5 h-5 text-[var(--buh-foreground-muted)] group-hover:text-[var(--buh-primary)] transition-colors" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
