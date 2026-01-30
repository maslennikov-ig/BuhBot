'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  LogOut, 
  Settings, 
  LayoutDashboard, 
  ChevronDown,
  HelpCircle
} from 'lucide-react';
import { supabase, isDevMode } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface ProfileMenuProps {
  email: string | null;
}

export function ProfileMenu({ email }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setIsOpen(false);
    // In dev mode, just reload the page
    if (isDevMode) {
      window.location.reload();
    } else {
      router.push('/login');
    }
  };

  const menuItems = [
    { 
      icon: LayoutDashboard, 
      label: 'Панель управления', 
      href: '/dashboard',
      primary: true
    },
    { 
      icon: User, 
      label: 'Профиль', 
      href: '/settings/profile' 
    },
    { 
      icon: Settings, 
      label: 'Настройки системы', 
      href: '/settings' 
    },
    { 
      icon: HelpCircle, 
      label: 'Помощь', 
      href: '/help' 
    },
  ];

  return (
    <div className="relative z-50" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          group flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full transition-all duration-300 border
          ${isOpen 
            ? 'bg-[var(--buh-surface-elevated)] border-[var(--buh-primary)] shadow-[0_0_0_2px_rgba(var(--buh-primary-rgb),0.2)]' 
            : 'bg-[var(--buh-surface)] border-[var(--buh-border)] hover:border-[var(--buh-primary-muted)] hover:bg-[var(--buh-surface-elevated)]'
          }
        `}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--buh-accent)] to-[var(--buh-primary)] shadow-sm group-hover:shadow-md transition-shadow">
          <User className="h-4 w-4 text-white" />
        </div>
        
        <div className="flex flex-col items-start mr-1">
            <span className="text-xs font-medium text-[var(--buh-foreground)] max-w-[100px] truncate">
                {email?.split('@')[0]}
            </span>
        </div>

        <ChevronDown 
          className={`w-4 h-4 text-[var(--buh-foreground-muted)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
            className="absolute right-0 top-full mt-3 w-64 origin-top-right rounded-2xl bg-[var(--buh-surface-elevated)]/95 backdrop-blur-xl border border-[var(--buh-border)] shadow-2xl overflow-hidden ring-1 ring-black/5"
          >
            {/* User Info Header */}
            <div className="p-4 border-b border-[var(--buh-border)] bg-[var(--buh-surface)]/50">
              <p className="text-sm font-medium text-[var(--buh-foreground)] truncate">
                {email}
              </p>
              <p className="text-xs text-[var(--buh-foreground-muted)] mt-0.5">
                Личный аккаунт
              </p>
            </div>

            {/* Menu Items */}
            <div className="p-2 flex flex-col gap-1">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                    ${item.primary 
                        ? 'bg-[var(--buh-primary)]/10 text-[var(--buh-primary)] hover:bg-[var(--buh-primary)]/20' 
                        : 'text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)] hover:bg-[var(--buh-surface)]'
                    }
                  `}
                >
                  <item.icon className={`w-4 h-4 ${item.primary ? 'text-[var(--buh-primary)]' : ''}`} />
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Footer / Logout */}
            <div className="p-2 border-t border-[var(--buh-border)] bg-[var(--buh-surface)]/30">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
