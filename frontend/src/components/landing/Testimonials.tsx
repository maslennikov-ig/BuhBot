'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote: "Раньше я узнавала о просроченных обращениях от самих клиентов — уже с претензией. Теперь вижу всё в реальном времени и успеваю вмешаться до конфликта. За 3 месяца ни одной жалобы на скорость.",
    author: "Елена Сергеева",
    role: "Управляющий партнёр, ООО \"Финансовый Советник\"",
    city: "г. Екатеринбург"
  },
  {
    quote: "У нас 4 бухгалтера и 80+ клиентов. Было невозможно отследить, кто кому ответил. BuhBot показал, что 15% обращений 'терялись'. Сейчас потерь ноль, а среднее время ответа упало с 6 часов до 1.5.",
    author: "Андрей Козлов",
    role: "Директор, БухгалтерияПро",
    city: "г. Новосибирск"
  },
  {
    quote: "Внедрили за день, без обучения сотрудников — всё работает в привычном Telegram. Бухгалтеры даже не заметили изменений, а я наконец-то получил нормальную аналитику по нагрузке.",
    author: "Дмитрий Волков",
    role: "IT-директор, Группа компаний \"Учёт и Право\"",
    city: "г. Москва"
  }
];

export function Testimonials() {
  return (
    <section className="py-16 md:py-24 bg-[var(--buh-surface-elevated)] border-y border-[var(--buh-border)]">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 buh-shimmer-text inline-block">
            Отзывы клиентов
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {testimonials.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{
                scale: 1.02,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 40px -10px var(--buh-accent-glow)',
              }}
              className="bg-[var(--buh-surface)] p-8 rounded-2xl border border-[var(--buh-border)] shadow-sm flex flex-col h-full cursor-pointer relative overflow-hidden"
            >
              {/* Add gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--buh-accent-glow)] to-transparent opacity-0 hover:opacity-10 transition-opacity duration-500 rounded-2xl pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full">
                <Quote className="w-10 h-10 text-[var(--buh-primary)] mb-6 opacity-50" />
                <p className="text-lg text-[var(--buh-foreground)] mb-6 italic flex-grow leading-relaxed">
                  "{item.quote}"
                </p>
                <div>
                  <p className="font-bold text-[var(--buh-foreground)]">{item.author}</p>
                  <p className="text-sm text-[var(--buh-primary)]">{item.role}</p>
                  <p className="text-sm text-[var(--buh-foreground-muted)]">{item.city}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-[var(--buh-border)] pt-10 text-center">
          <div>
            <div className="text-3xl font-bold text-[var(--buh-foreground)]">50+</div>
            <div className="text-[var(--buh-foreground-muted)]">Бухгалтерских фирм</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[var(--buh-foreground)]">10,000+</div>
            <div className="text-[var(--buh-foreground-muted)]">Обработанных обращений</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[var(--buh-foreground)]">12</div>
            <div className="text-[var(--buh-foreground-muted)]">Регионов России</div>
          </div>
        </div>
      </div>
    </section>
  );
}