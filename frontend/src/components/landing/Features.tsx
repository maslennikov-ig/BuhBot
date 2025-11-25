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

export function Features() {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[var(--buh-border)] to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--buh-primary-muted)] rounded-full blur-[120px] opacity-20 pointer-events-none" />

      <div className="container px-4 md:px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-[var(--buh-foreground)] mb-6">
            Возможности
          </h2>
          <p className="text-xl text-[var(--buh-foreground-muted)] max-w-2xl mx-auto">
            Всё необходимое для контроля качества сервиса в одном инструменте
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="group relative bg-[var(--buh-surface)] p-8 rounded-3xl border border-[var(--buh-border)] hover:border-[var(--buh-primary)] transition-colors duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--buh-primary-muted)]/0 to-[var(--buh-primary-muted)]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-[var(--buh-surface-elevated)] flex items-center justify-center mb-6 text-[var(--buh-primary)] group-hover:scale-110 transition-transform duration-300 shadow-sm border border-[var(--buh-border)]">
                  <feature.icon size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-[var(--buh-foreground)] mb-3 group-hover:text-[var(--buh-primary)] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-[var(--buh-foreground-muted)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
