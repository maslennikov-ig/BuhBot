'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CounterAnimation } from './CounterAnimation';

const stats = [
  {
    value: '4×',
    label: 'Быстрее ответы',
    sub: 'С шаблонами и напоминаниями',
  },
  {
    value: '90%+',
    label: 'SLA compliance',
    sub: 'После 1 месяца использования',
  },
  {
    value: '−60%',
    label: 'Просроченных обращений',
    sub: 'Среднее снижение',
  },
  {
    value: '0',
    label: 'Забытых сообщений',
    sub: 'При включенном мониторинге',
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="py-16 md:py-24 relative">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 buh-shimmer-text inline-block">
            Результаты наших клиентов
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="flex flex-col items-center text-center p-6 rounded-2xl bg-[var(--buh-surface-elevated)]/50 border border-[var(--buh-border)] hover:border-[var(--buh-accent)] transition-colors"
            >
              <span className="text-5xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-br from-[var(--buh-primary)] to-[var(--buh-accent)] mb-4 inline-block min-h-[1.2em]">
                <CounterAnimation value={stat.value} duration={2000} />
              </span>
              <span className="text-xl font-bold text-[var(--buh-foreground)] mb-2">
                {stat.label}
              </span>
              <span className="text-sm text-[var(--buh-foreground-muted)]">
                {stat.sub}
              </span>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-[var(--buh-foreground-subtle)] italic">
            * По данным пилотных внедрений
          </p>
        </div>
      </div>
    </section>
  );
}