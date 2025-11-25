'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, MessageSquareWarning, BarChart3, Flame } from 'lucide-react';

const problems = [
  {
    icon: Clock,
    title: 'Забытые сообщения',
    description: 'Клиент написал в Telegram, бухгалтер увидел, но забыл ответить. Через 3 дня — жалоба руководителю.',
    color: 'text-blue-500',
  },
  {
    icon: MessageSquareWarning,
    title: 'Негативные отзывы',
    description: '"Долго отвечают" — частая причина ухода клиентов. Узнаёте последними.',
    color: 'text-red-500',
  },
  {
    icon: BarChart3,
    title: 'Слепая зона',
    description: 'Сколько обращений в день? Какое среднее время ответа? Кто из бухгалтеров перегружен? Данных нет.',
    color: 'text-purple-500',
  },
  {
    icon: Flame,
    title: 'Тушение пожаров',
    description: 'Вместо стратегического развития — разбор конфликтов и извинения перед клиентами.',
    color: 'text-orange-500',
  },
];

export function PainPoints() {
  return (
    <section id="pain-points" className="py-24 relative bg-[var(--buh-background-subtle)]">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--buh-foreground)] mb-4">
            Знакомо?
          </h2>
          <p className="text-lg text-[var(--buh-foreground-muted)]">
            Типичные проблемы растущих бухгалтерских фирм
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="bg-[var(--buh-surface)] p-6 rounded-2xl border border-[var(--buh-border)] shadow-[var(--buh-shadow-sm)] hover:shadow-[var(--buh-shadow-md)] hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl bg-[var(--buh-surface-elevated)] flex items-center justify-center mb-4 ${item.color}`}>
                <item.icon size={24} />
              </div>
              <h3 className="text-xl font-bold text-[var(--buh-foreground)] mb-3">
                {item.title}
              </h3>
              <p className="text-[var(--buh-foreground-muted)] leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-16"
        >
          <p className="text-2xl font-semibold text-[var(--buh-primary)]">
            BuhBot решает эти проблемы автоматически
          </p>
        </motion.div>
      </div>
    </section>
  );
}
