'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Timer, Bell, LineChart, MessageCircle, FileText, PieChart } from 'lucide-react';

const features = [
  {
    icon: Timer,
    title: 'SLA-мониторинг',
    description: 'Автоматический учёт времени ответа с учётом рабочих часов, выходных и праздников.',
  },
  {
    icon: Bell,
    title: 'Умные алерты',
    description: 'Предупреждения о приближении дедлайна бухгалтеру и руководителю — до нарушения SLA.',
  },
  {
    icon: LineChart,
    title: 'Аналитика',
    description: 'Дашборд с метриками: среднее время ответа, SLA compliance, нагрузка по бухгалтерам.',
  },
  {
    icon: MessageCircle,
    title: 'Telegram-интеграция',
    description: 'Работает прямо в Telegram — без установки нового софта для бухгалтеров.',
  },
  {
    icon: FileText,
    title: 'Шаблоны ответов',
    description: 'Готовые ответы на частые вопросы — быстрее реакция, меньше рутины.',
  },
  {
    icon: PieChart,
    title: 'Обратная связь',
    description: 'Квартальные опросы NPS клиентов с анонимной аналитикой.',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.2, 0.65, 0.3, 0.9] as const,
    },
  },
};

export function Features() {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[var(--buh-border)] to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--buh-primary-muted)] rounded-full blur-[120px] opacity-20 pointer-events-none" />

      <div className="container px-4 md:px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 buh-shimmer-text inline-block">
            Возможности
          </h2>
          <p className="text-xl text-[var(--buh-foreground-muted)] max-w-2xl mx-auto">
            Всё необходимое для контроля качества сервиса в одном инструменте
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative bg-[var(--buh-surface)] p-8 rounded-3xl border border-[var(--buh-border)] hover:border-[var(--buh-primary)] transition-colors duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--buh-primary-muted)]/0 via-[var(--buh-accent-glow)] to-[var(--buh-primary-muted)]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
              
              <div className="relative z-10">
                <motion.div
                  className="w-14 h-14 rounded-2xl bg-[var(--buh-surface-elevated)] flex items-center justify-center mb-6 text-[var(--buh-primary)] shadow-sm border border-[var(--buh-border)]"
                  whileHover={{
                    scale: 1.15,
                    rotate: [0, -5, 5, 0],
                    transition: { duration: 0.5 }
                  }}
                >
                  <feature.icon size={28} strokeWidth={1.5} />
                </motion.div>
                <h3 className="text-xl font-bold text-[var(--buh-foreground)] mb-3 group-hover:text-[var(--buh-primary)] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-[var(--buh-foreground-muted)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}