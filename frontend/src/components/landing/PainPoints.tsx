'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
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
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <motion.section
      id="pain-points"
      ref={containerRef}
      style={{ opacity }}
      className="py-16 md:py-24 relative bg-[var(--buh-background-subtle)]"
    >
      {/* Add floating background element */}
      <motion.div
        style={{ y }}
        className="absolute top-1/2 left-1/4 w-64 h-64 bg-[var(--buh-accent-glow)] rounded-full blur-[100px] opacity-20 pointer-events-none"
      />

      <div className="container px-4 md:px-6 relative z-10">
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
              whileHover={{
                y: -8,
                rotateX: 5,
                rotateY: 5,
                transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
              }}
              className="bg-[var(--buh-surface)] p-6 rounded-2xl border border-[var(--buh-border)] shadow-[var(--buh-shadow-sm)] hover:shadow-[var(--buh-shadow-lg),0_0_40px_-10px_var(--buh-accent-glow)] transition-all duration-300 perspective-1000"
              style={{ transformStyle: 'preserve-3d' }}
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
    </motion.section>
  );
}