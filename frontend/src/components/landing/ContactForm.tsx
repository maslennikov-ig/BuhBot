'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactFormSchema, type ContactFormValues } from '@/lib/schemas/contact';
import { motion } from 'framer-motion';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export function ContactForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = trpc.contact.submit.useMutation();
  const isLoading = mutation.isPending;

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      company: '',
      message: '',
      consent: undefined,
      website: '', // Honeypot
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    // Spam check
    if (data.website) return;

    setError(null);

    try {
      await mutation.mutateAsync({
        name: data.name,
        email: data.email,
        company: data.company,
        message: data.message,
        consent: Boolean(data.consent),
      });
      setIsSubmitted(true);
      form.reset();
    } catch (err) {
      console.error(err);
      setError(
        'Произошла ошибка при отправке. Пожалуйста, попробуйте позже или свяжитесь с нами через Telegram.'
      );
    }
  };

  if (isSubmitted) {
    return (
      <section id="contact" className="py-16 md:py-24 relative overflow-hidden">
        <div className="container px-4 md:px-6 max-w-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--buh-surface)] p-8 rounded-3xl border border-[var(--buh-border)] text-center shadow-lg"
          >
            <div className="w-16 h-16 bg-[var(--buh-success-muted)] rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--buh-success)]">
              <Check size={32} />
            </div>
            <h3 className="text-2xl font-bold text-[var(--buh-foreground)] mb-4">
              Заявка отправлена!
            </h3>
            <p className="text-[var(--buh-foreground-muted)] mb-8">
              Спасибо за интерес к BuhBot. Мы свяжемся с вами в течение 24 часов для уточнения
              деталей и демонстрации.
            </p>
            <button
              onClick={() => setIsSubmitted(false)}
              className="text-[var(--buh-primary)] font-medium hover:underline"
            >
              Отправить еще одну заявку
            </button>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-[var(--buh-accent-secondary-glow)] rounded-full blur-[120px] opacity-10 pointer-events-none" />

      <div className="container px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold text-[var(--buh-foreground)] mb-6 leading-tight">
              Готовы контролировать время ответа?
            </h2>
            <p className="text-xl text-[var(--buh-foreground-muted)] mb-8">
              Оставьте заявку — мы покажем BuhBot в действии и поможем настроить под вашу фирму.
            </p>

            <div className="space-y-6 text-[var(--buh-foreground-muted)]">
              <div>
                <h4 className="font-semibold text-[var(--buh-foreground)] mb-2">
                  Или напишите нам:
                </h4>
                <p className="hover:text-[var(--buh-primary)] transition-colors cursor-pointer">
                  <a href="https://t.me/buhbot_support">Telegram: @buhbot_support</a>
                </p>
                <p className="hover:text-[var(--buh-primary)] transition-colors cursor-pointer">
                  <a href="mailto:contact@aidevteam.ru">Email: contact@aidevteam.ru</a>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[var(--buh-surface)] p-8 rounded-3xl border border-[var(--buh-border)] shadow-xl backdrop-blur-sm">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-[var(--buh-foreground)]">
                  Имя *
                </label>
                <motion.input
                  {...form.register('name')}
                  id="name"
                  whileFocus={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--buh-border)] bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground)] focus:ring-2 focus:ring-[var(--buh-primary)] focus:border-transparent outline-none transition-all"
                  placeholder="Иван Петров"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-[var(--buh-error)] flex items-center gap-1">
                    <AlertCircle size={14} /> {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-[var(--buh-foreground)]">
                  Email *
                </label>
                <motion.input
                  {...form.register('email')}
                  id="email"
                  type="email"
                  whileFocus={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--buh-border)] bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground)] focus:ring-2 focus:ring-[var(--buh-primary)] focus:border-transparent outline-none transition-all"
                  placeholder="ivan@example.com"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-[var(--buh-error)] flex items-center gap-1">
                    <AlertCircle size={14} /> {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Company */}
              <div className="space-y-2">
                <label
                  htmlFor="company"
                  className="text-sm font-medium text-[var(--buh-foreground)]"
                >
                  Компания
                </label>
                <motion.input
                  {...form.register('company')}
                  id="company"
                  whileFocus={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--buh-border)] bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground)] focus:ring-2 focus:ring-[var(--buh-primary)] focus:border-transparent outline-none transition-all"
                  placeholder="ООО Бухгалтерия"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label
                  htmlFor="message"
                  className="text-sm font-medium text-[var(--buh-foreground)]"
                >
                  Сообщение (необязательно)
                </label>
                <motion.textarea
                  {...form.register('message')}
                  id="message"
                  rows={3}
                  whileFocus={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--buh-border)] bg-[var(--buh-surface-elevated)] text-[var(--buh-foreground)] focus:ring-2 focus:ring-[var(--buh-primary)] focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Хочу узнать подробнее про..."
                />
              </div>

              {/* Honeypot */}
              <input {...form.register('website')} type="text" className="hidden" />

              {/* Consent */}
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      {...form.register('consent')}
                      className="peer h-5 w-5 rounded border-gray-300 text-[var(--buh-primary)] focus:ring-[var(--buh-primary)]"
                    />
                  </div>
                  <span className="text-sm text-[var(--buh-foreground-muted)] group-hover:text-[var(--buh-foreground)] transition-colors">
                    Даю согласие на обработку персональных данных в соответствии с{' '}
                    <a href="/privacy" className="text-[var(--buh-primary)] hover:underline">
                      Политикой конфиденциальности
                    </a>
                  </span>
                </label>
                {form.formState.errors.consent && (
                  <p className="text-sm text-[var(--buh-error)] flex items-center gap-1">
                    <AlertCircle size={14} /> {form.formState.errors.consent.message}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-[var(--buh-error-muted)] text-[var(--buh-error)] text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
                className="w-full py-4 rounded-xl bg-[var(--buh-primary)] text-white font-bold text-lg shadow-[0_4px_14px_0_var(--buh-primary-muted)] hover:shadow-[0_6px_20px_var(--buh-primary-muted),0_0_40px_-10px_var(--buh-accent)] hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 relative overflow-hidden"
              >
                {/* Shimmer effect */}
                {!isLoading && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                )}

                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" /> Отправка...
                    </>
                  ) : (
                    'Запросить демо'
                  )}
                </span>
              </motion.button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
