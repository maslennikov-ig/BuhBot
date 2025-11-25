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
    <footer className="bg-[var(--buh-background)] border-t border-[var(--buh-border)] pt-16 pb-8">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Branding */}
          <div className="flex flex-col gap-4">
            <span className="text-2xl font-bold tracking-tight text-[var(--buh-foreground)]">
              BuhBot
            </span>
            <p className="text-[var(--buh-foreground-muted)] max-w-xs">
              Автоматизация коммуникаций для бухгалтерских фирм.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-[var(--buh-foreground)]">Навигация</h3>
            <nav className="flex flex-col gap-2">
              <button onClick={() => scrollToSection('features')} className="text-left text-[var(--buh-foreground-muted)] hover:text-[var(--buh-primary)] transition-colors">
                Возможности
              </button>
              <button onClick={() => scrollToSection('how-it-works')} className="text-left text-[var(--buh-foreground-muted)] hover:text-[var(--buh-primary)] transition-colors">
                Как это работает
              </button>
              <button onClick={() => scrollToSection('contact')} className="text-left text-[var(--buh-foreground-muted)] hover:text-[var(--buh-primary)] transition-colors">
                Контакты
              </button>
              <Link href="/login" className="text-[var(--buh-foreground-muted)] hover:text-[var(--buh-primary)] transition-colors">
                Войти
              </Link>
            </nav>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-[var(--buh-foreground)]">Контакты</h3>
            <div className="flex flex-col gap-2 text-[var(--buh-foreground-muted)]">
              <a href="https://t.me/buhbot_support" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--buh-primary)] transition-colors">
                Telegram: @buhbot_support
              </a>
              <a href="mailto:contact@aidevteam.ru" className="hover:text-[var(--buh-primary)] transition-colors">
                Email: contact@aidevteam.ru
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--buh-border)] flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[var(--buh-foreground-subtle)]">
          <p>© 2025 AIDevTeam. Все права защищены.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[var(--buh-foreground)] transition-colors">
              Политика конфиденциальности
            </Link>
            <Link href="/terms" className="hover:text-[var(--buh-foreground)] transition-colors">
              Пользовательское соглашение
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
