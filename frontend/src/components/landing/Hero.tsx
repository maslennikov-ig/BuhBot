'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  yOffset: number;
  duration: number;
  delay: number;
}

export function Hero() {
  const scrollToNext = () => {
    const element = document.getElementById('pain-points');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const ctaRef = useRef<HTMLButtonElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);

  // Generate particles only on client to avoid hydration mismatch
  useEffect(() => {
    setParticles(
      [...Array(20)].map(() => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        yOffset: Math.random() * -100 - 50,
        duration: Math.random() * 10 + 10,
        delay: Math.random() * 5,
      }))
    );
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ctaRef.current) return;
    const rect = ctaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setMousePosition({ x: x * 0.15, y: y * 0.15 });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] as const },
    },
  };

  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center overflow-hidden pt-20 pb-10">
      {/* Aurora Background */}
      <div className="absolute inset-0 buh-aurora z-0" />
      
      {/* Grid/Noise overlay for texture */}
      <div className="absolute inset-0 buh-noise z-0 pointer-events-none" />

      {/* Floating particles - rendered only on client */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[var(--buh-accent)] rounded-full opacity-30"
            initial={{ x: particle.x, y: particle.y }}
            animate={{
              y: [null, particle.yOffset],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-8 flex justify-center">
            <span className="inline-flex items-center px-4 py-1.5 rounded-full border border-[var(--buh-accent-glow)] bg-[rgba(0,212,170,0.05)] text-[var(--buh-accent)] text-xs md:text-sm font-bold uppercase tracking-wider shadow-[0_0_20px_-5px_var(--buh-accent-glow)]">
              Для бухгалтерских фирм
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[var(--buh-foreground)] leading-[1.1] mb-6"
          >
            Клиенты ждут ответа.
            <br />
            <span className="relative">
              <span className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-[var(--buh-accent)] via-[var(--buh-primary)] to-[var(--buh-accent-secondary)] blur-lg opacity-50 animate-pulse" />
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[var(--buh-accent)] via-[var(--buh-primary)] to-[var(--buh-accent-secondary)]">
                Вы контролируете время.
              </span>
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-[var(--buh-foreground-muted)] max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            BuhBot автоматически отслеживает время ответа бухгалтеров
            и уведомляет о приближении дедлайна — прежде чем клиент
            успеет пожаловаться.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.button
              ref={ctaRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              animate={{ x: mousePosition.x, y: mousePosition.y }}
              transition={{ type: 'spring', stiffness: 150, damping: 15 }}
              onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white transition-all duration-200 bg-[var(--buh-primary)] rounded-full hover:bg-[var(--buh-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--buh-primary)] shadow-[0_0_20px_-5px_var(--buh-primary-muted)] hover:shadow-[0_0_40px_-5px_var(--buh-primary),0_0_60px_-10px_var(--buh-accent)] overflow-hidden"
            >
              {/* Shimmer effect */}
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

              {/* Ripple effect */}
              <span className="absolute inset-0 rounded-full bg-white/30 scale-0 group-active:scale-100 transition-transform duration-500" />

              <span>Запросить демо</span>
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <button
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-[var(--buh-foreground)] transition-all duration-200 bg-[var(--buh-surface)] border border-[var(--buh-border)] rounded-full hover:bg-[var(--buh-surface-elevated)] hover:border-[var(--buh-foreground-subtle)] focus:outline-none hover:-translate-y-1"
            >
              Узнать как это работает
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 1, type: 'spring' }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.button
          onClick={scrollToNext}
          className="flex flex-col items-center gap-2 text-[var(--buh-foreground-subtle)] hover:text-[var(--buh-primary)] transition-colors group"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.span
            className="text-xs font-medium uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
            initial={{ y: 10 }}
            whileHover={{ y: 0 }}
          >
            Листайте вниз
          </motion.span>
          <div className="relative w-6 h-10 border-2 border-[var(--buh-border)] rounded-full flex justify-center pt-2 group-hover:border-[var(--buh-primary)] transition-colors overflow-hidden">
            <motion.div
              animate={{ y: [0, 14, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              className="w-1.5 h-1.5 bg-[var(--buh-foreground-subtle)] rounded-full group-hover:bg-[var(--buh-primary)] group-hover:shadow-[0_0_8px_var(--buh-primary)]"
            />
          </div>
        </motion.button>
      </motion.div>
    </section>
  );
}