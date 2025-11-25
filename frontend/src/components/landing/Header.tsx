'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const navLinks = [
  { name: 'Возможности', href: '#features' },
  { name: 'Как это работает', href: '#how-it-works' },
  { name: 'Результаты', href: '#benefits' },
  { name: 'Контакты', href: '#contact' },
];

import { ThemeToggle } from '../ThemeToggle';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-[1100] transition-all duration-300',
        isScrolled
          ? 'h-[64px] bg-[var(--buh-header-background)] backdrop-blur-xl border-b border-[var(--buh-border)]'
          : 'h-[80px] bg-transparent border-transparent'
      )}
    >
      <div className="container h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl font-bold tracking-tight text-[var(--buh-foreground)] group-hover:text-[var(--buh-primary)] transition-colors duration-300">
            BuhBot
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) => scrollToSection(e, link.href)}
              aria-label={`Перейти к разделу: ${link.name}`}
              className="text-sm font-medium text-[var(--buh-foreground-muted)] hover:text-[var(--buh-primary)] transition-colors duration-200"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Actions Area */}
        <div className="flex items-center gap-3">
          {/* Desktop CTA */}
          <div className="hidden md:flex items-center">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-[var(--buh-radius-md)] bg-[var(--buh-surface-elevated)] border border-[var(--buh-border)] text-sm font-semibold text-[var(--buh-foreground)] hover:border-[var(--buh-primary)] hover:text-[var(--buh-primary)] transition-all duration-300"
            >
              Войти
            </Link>
          </div>

          <ThemeToggle />

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-[var(--buh-foreground)]"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-[100%] left-0 right-0 bg-[var(--buh-surface)] border-b border-[var(--buh-border)] shadow-lg md:hidden"
          >
            <div className="flex flex-col p-4 gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="text-base font-medium text-[var(--buh-foreground)] py-2 border-b border-[var(--buh-border-subtle)]"
                >
                  {link.name}
                </a>
              ))}
              <Link
                href="/login"
                className="mt-2 w-full text-center py-3 rounded-[var(--buh-radius-md)] bg-[var(--buh-primary)] text-white font-semibold"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Войти
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
