'use client';

import React from 'react';
import Link from 'next/link';

export function Footer() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[var(--buh-background)] border-t border-[var(--buh-border)] py-6">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[var(--buh-foreground-muted)]">
          {/* Left: Branding + Copyright */}
          <div className="flex items-center gap-4">
            <span className="font-bold text-[var(--buh-foreground)]">BuhBot</span>
            <span className="text-[var(--buh-foreground-subtle)]">© 2025 AIDevTeam</span>
          </div>

          {/* Center: Navigation */}
          <nav className="flex items-center gap-6">
            <button onClick={() => scrollToSection('features')} className="hover:text-[var(--buh-primary)] transition-colors">
              Возможности
            </button>
            <button onClick={() => scrollToSection('contact')} className="hover:text-[var(--buh-primary)] transition-colors">
              Контакты
            </button>
            <a href="https://t.me/buhbot_support" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--buh-primary)] transition-colors">
              Telegram
            </a>
          </nav>

          {/* Right: Legal */}
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[var(--buh-foreground)] transition-colors">
              Конфиденциальность
            </Link>
            <Link href="/terms" className="hover:text-[var(--buh-foreground)] transition-colors">
              Соглашение
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
