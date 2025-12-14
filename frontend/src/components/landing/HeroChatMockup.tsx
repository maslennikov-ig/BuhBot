'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Clock, CheckCheck } from 'lucide-react';
import { useTheme } from 'next-themes';

interface Scenario {
  id: number;
  clientName: string;
  clientInitials: string;
  clientType: string;
  clientQuestion: string;
  accountantResponse: string;
  slaWarningText: string;
  questionTime: string;
  responseTime: string;
}

const scenarios: Scenario[] = [
  {
    id: 1,
    clientName: 'ИП Иванов А.С.',
    clientInitials: 'ИА',
    clientType: 'Клиент',
    clientQuestion: 'Добрый день! Когда будет готова декларация по НДС?',
    accountantResponse: 'Здравствуйте! Декларация будет готова сегодня до 18:00',
    slaWarningText: 'SLA 80% — ответьте клиенту ИП Иванов',
    questionTime: '10:24',
    responseTime: '10:31',
  },
  {
    id: 2,
    clientName: 'ООО "Прогресс"',
    clientInitials: 'ПР',
    clientType: 'Клиент',
    clientQuestion: 'Нужна справка 2-НДФЛ для сотрудника Петровой',
    accountantResponse: 'Справка готова, отправила на почту hr@progress.ru',
    slaWarningText: 'SLA 75% — запрос от ООО Прогресс',
    questionTime: '11:05',
    responseTime: '11:18',
  },
  {
    id: 3,
    clientName: 'ИП Сидорова М.В.',
    clientInitials: 'СМ',
    clientType: 'Клиент',
    clientQuestion: 'Подскажите, какие документы нужны для закрытия ИП?',
    accountantResponse: 'Отправила список на email. Помогу с заполнением!',
    slaWarningText: 'SLA 85% — вопрос от ИП Сидорова',
    questionTime: '14:32',
    responseTime: '14:45',
  },
  {
    id: 4,
    clientName: 'ООО "ТехноСтрой"',
    clientInitials: 'ТС',
    clientType: 'Клиент',
    clientQuestion: 'Срочно! Когда будет акт сверки за 3 квартал?',
    accountantResponse: 'Акт сверки уже готов, прикрепляю файл',
    slaWarningText: 'SLA 90% — срочный запрос ТехноСтрой',
    questionTime: '09:15',
    responseTime: '09:22',
  },
  {
    id: 5,
    clientName: 'ИП Козлов Д.А.',
    clientInitials: 'КД',
    clientType: 'Клиент',
    clientQuestion: 'Есть вопрос по УСН — можно созвониться?',
    accountantResponse: 'Конечно! Свободна сегодня с 15:00 до 17:00',
    slaWarningText: 'SLA 70% — ИП Козлов ждёт ответа',
    questionTime: '12:48',
    responseTime: '12:55',
  },
  {
    id: 6,
    clientName: 'ООО "Альфа-Групп"',
    clientInitials: 'АГ',
    clientType: 'Клиент',
    clientQuestion: 'Нужно уточнить сумму налога к уплате за ноябрь',
    accountantResponse: 'К уплате 45 320₽. Реквизиты отправила в чат',
    slaWarningText: 'SLA 82% — запрос Альфа-Групп',
    questionTime: '16:20',
    responseTime: '16:28',
  },
  {
    id: 7,
    clientName: 'ИП Новикова Е.С.',
    clientInitials: 'НЕ',
    clientType: 'Клиент',
    clientQuestion: 'Получила требование из налоговой. Что делать?',
    accountantResponse: 'Не волнуйтесь! Изучу и подготовлю ответ к завтра',
    slaWarningText: 'SLA 88% — требование для ИП Новикова',
    questionTime: '13:10',
    responseTime: '13:17',
  },
  {
    id: 8,
    clientName: 'ООО "СтартАп"',
    clientInitials: 'СА',
    clientType: 'Клиент',
    clientQuestion: 'Как оформить командировку директора за рубеж?',
    accountantResponse: 'Подготовлю приказ и авансовый отчёт. Нужны даты поездки',
    slaWarningText: 'SLA 78% — вопрос от СтартАп',
    questionTime: '10:55',
    responseTime: '11:08',
  },
];

export function HeroChatMockup() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState(0);
  const [slaPercent, setSlaPercent] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : true; // Default to dark during SSR
  const currentScenario = scenarios[scenarioIndex];

  // Animation sequence
  const runSequence = useCallback(async () => {
    // Stage 0: Initial state
    setStage(0);
    setSlaPercent(0);
    setShowNotification(false);
    await delay(800);

    // Stage 1: Client message appears
    setStage(1);
    await delay(1200);

    // Stage 2: SLA timer starts
    setStage(2);

    // Animate SLA percentage
    for (let i = 0; i <= 80; i += 4) {
      setSlaPercent(i);
      await delay(40);
    }

    await delay(400);

    // Stage 3: Warning notification
    setShowNotification(true);
    await delay(1800);

    // Stage 4: Accountant responds
    setStage(4);
    setShowNotification(false);
    await delay(2000);

    // Move to next scenario
    setScenarioIndex((prev) => (prev + 1) % scenarios.length);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSequence();
    const interval = setInterval(runSequence, 7000);
    return () => clearInterval(interval);
  }, [runSequence]);

  // Theme-aware colors
  const phoneFrame = isDark ? 'bg-[#1a1a2e]' : 'bg-slate-200';
  const phoneFrameBorder = isDark ? 'border-white/10' : 'border-slate-300';
  const screenBg = isDark
    ? 'bg-gradient-to-b from-[#0f1629] to-[#0c1222]'
    : 'bg-gradient-to-b from-slate-50 to-white';
  const headerBg = isDark ? 'bg-[#1a2744]/80' : 'bg-white/80';
  const headerBorder = isDark ? 'border-white/5' : 'border-slate-200';
  const clientNameColor = isDark ? 'text-white' : 'text-slate-900';
  const clientTypeColor = 'text-[var(--buh-foreground-muted)]';
  const messageBubbleBg = isDark ? 'bg-white/10' : 'bg-slate-100';
  const messageTextColor = isDark ? 'text-white' : 'text-slate-800';
  const timeColor = isDark ? 'text-white/40' : 'text-slate-400';
  const typingBg = isDark ? 'bg-white/5' : 'bg-slate-100';
  const typingDot = isDark ? 'bg-white/40' : 'bg-slate-400';
  const inputBg = isDark ? 'bg-white/5' : 'bg-slate-100';
  const inputBorder = isDark ? 'border-white/10' : 'border-slate-200';
  const inputText = isDark ? 'text-white/30' : 'text-slate-400';
  const inputGradient = isDark
    ? 'bg-gradient-to-t from-[#0c1222] to-transparent'
    : 'bg-gradient-to-t from-white to-transparent';

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Phone Frame */}
      <motion.div
        initial={{ opacity: 0, y: 40, rotateY: -10 }}
        animate={{ opacity: 1, y: 0, rotateY: 0 }}
        transition={{ duration: 1, delay: 0.5, ease: [0.2, 0.65, 0.3, 0.9] }}
        className="relative"
        style={{ perspective: '1000px' }}
      >
        {/* Glow effect behind phone */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--buh-accent)]/20 via-[var(--buh-primary)]/10 to-transparent blur-3xl scale-110" />

        {/* Phone body */}
        <div className={`relative ${phoneFrame} rounded-[2.5rem] p-2 shadow-2xl ${isDark ? 'shadow-black/50' : 'shadow-slate-400/30'} border ${phoneFrameBorder}`}>
          {/* Phone notch */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 ${phoneFrame} rounded-b-2xl z-20`} />

          {/* Screen */}
          <div className={`relative ${screenBg} rounded-[2rem] overflow-hidden min-h-[420px]`}>
            {/* Chat Header */}
            <div className={`${headerBg} backdrop-blur-sm px-4 py-3 flex items-center gap-3 border-b ${headerBorder}`}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                {currentScenario.clientInitials}
              </div>
              <div className="flex-1">
                <div className={`${clientNameColor} font-medium text-sm`}>{currentScenario.clientName}</div>
                <div className={`${clientTypeColor} text-xs`}>{currentScenario.clientType}</div>
              </div>

              {/* SLA Badge */}
              <AnimatePresence>
                {stage >= 2 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      slaPercent >= 80
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>SLA {slaPercent}%</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat Messages */}
            <div className="p-4 space-y-3 min-h-[280px]">
              {/* Client Message */}
              <AnimatePresence mode="wait">
                {stage >= 1 && (
                  <motion.div
                    key={`client-${currentScenario.id}`}
                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className="flex gap-2"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {currentScenario.clientInitials.charAt(0)}
                    </div>
                    <div className="max-w-[85%]">
                      <div className={`${messageBubbleBg} rounded-2xl rounded-tl-sm px-4 py-2.5`}>
                        <p className={`${messageTextColor} text-sm leading-relaxed`}>{currentScenario.clientQuestion}</p>
                      </div>
                      <span className={`text-[10px] ${timeColor} mt-1 ml-2`}>{currentScenario.questionTime}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Accountant response */}
              <AnimatePresence mode="wait">
                {stage >= 4 && (
                  <motion.div
                    key={`accountant-${currentScenario.id}`}
                    initial={{ opacity: 0, x: 20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className="flex gap-2 justify-end"
                  >
                    <div className="max-w-[85%]">
                      <div className="bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] rounded-2xl rounded-tr-sm px-4 py-2.5">
                        <p className="text-white text-sm leading-relaxed">{currentScenario.accountantResponse}</p>
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1 mr-2">
                        <span className={`text-[10px] ${timeColor}`}>{currentScenario.responseTime}</span>
                        <CheckCheck className="w-3 h-3 text-[var(--buh-accent)]" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Typing indicator before response */}
              <AnimatePresence>
                {stage >= 2 && stage < 4 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-2 justify-end"
                  >
                    <div className={`${typingBg} rounded-2xl px-4 py-3 flex gap-1`}>
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                        className={`w-2 h-2 ${typingDot} rounded-full`}
                      />
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                        className={`w-2 h-2 ${typingDot} rounded-full`}
                      />
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                        className={`w-2 h-2 ${typingDot} rounded-full`}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input field mock */}
            <div className={`absolute bottom-0 left-0 right-0 p-3 ${inputGradient}`}>
              <div className={`${inputBg} rounded-full px-4 py-2.5 flex items-center gap-2 border ${inputBorder}`}>
                <span className={`${inputText} text-sm`}>Написать сообщение...</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating Notification */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ type: 'spring', damping: 15 }}
            className="absolute -top-4 -right-4 md:-right-8 z-30"
          >
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 shadow-2xl shadow-amber-500/30 max-w-[200px]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">BuhBot</div>
                  <div className="text-white/90 text-xs mt-0.5">
                    {currentScenario.slaWarningText}
                  </div>
                </div>
              </div>
            </div>
            {/* Notification arrow */}
            <div className="absolute -bottom-2 left-6 w-4 h-4 bg-gradient-to-br from-amber-500 to-orange-600 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scenario indicator dots */}
      <div className="flex justify-center gap-1.5 mt-6">
        {scenarios.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              index === scenarioIndex
                ? 'bg-[var(--buh-accent)] w-4'
                : isDark ? 'bg-white/20' : 'bg-slate-300'
            }`}
          />
        ))}
      </div>

      {/* Decorative elements */}
      <motion.div
        animate={{
          y: [0, -10, 0],
          rotate: [0, 5, 0]
        }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="absolute -bottom-8 -left-8 w-16 h-16 bg-[var(--buh-accent)]/10 rounded-full blur-xl"
      />
      <motion.div
        animate={{
          y: [0, 10, 0],
          rotate: [0, -5, 0]
        }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 1 }}
        className="absolute -top-4 -right-4 w-20 h-20 bg-[var(--buh-primary)]/10 rounded-full blur-xl"
      />
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
