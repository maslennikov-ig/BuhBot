'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Link as LinkIcon, Settings, Radio, CheckCircle } from 'lucide-react';

const steps = [
  {
    id: '01',
    icon: LinkIcon,
    title: 'Подключение',
    description: 'Добавьте BuhBot в ваши клиентские Telegram-чаты. Занимает 5 минут.',
  },
  {
    id: '02',
    icon: Settings,
    title: 'Настройка',
    description: 'Укажите SLA-пороги (например, 2 часа), рабочее время и праздники.',
  },
  {
    id: '03',
    icon: Radio,
    title: 'Мониторинг',
    description: 'BuhBot автоматически отслеживает каждое обращение и время ответа.',
  },
  {
    id: '04',
    icon: CheckCircle,
    title: 'Результат',
    description: 'Бухгалтеры получают напоминания, вы — аналитику и спокойствие.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-[var(--buh-background-subtle)]">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-[var(--buh-foreground)] mb-6">
            Как это работает
          </h2>
          <p className="text-xl text-[var(--buh-foreground-muted)]">
            Простой старт без сложной интеграции
          </p>
        </div>

        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-[var(--buh-border)] -translate-y-1/2 z-0" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.5 }}
                className="bg-[var(--buh-surface)] p-8 rounded-2xl border border-[var(--buh-border)] shadow-sm relative group hover:-translate-y-2 transition-transform duration-300"
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[var(--buh-surface)] px-4 text-[var(--buh-primary)] font-black text-5xl opacity-20 group-hover:opacity-40 transition-opacity">
                  {step.id}
                </div>
                
                <div className="flex flex-col items-center text-center pt-4">
                  <div className="w-16 h-16 rounded-full bg-[var(--buh-surface-elevated)] flex items-center justify-center mb-6 text-[var(--buh-primary)] shadow-md group-hover:scale-110 transition-transform duration-300 border-4 border-[var(--buh-surface)]">
                    <step.icon size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--buh-foreground)] mb-3">
                    {step.title}
                  </h3>
                  <p className="text-[var(--buh-foreground-muted)]">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
