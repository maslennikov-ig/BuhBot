'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Clock, CheckCheck, User } from 'lucide-react';

interface Message {
  id: number;
  type: 'client' | 'accountant' | 'system';
  text: string;
  time: string;
  avatar?: string;
}

export function HeroChatMockup() {
  const [stage, setStage] = useState(0);
  const [slaPercent, setSlaPercent] = useState(0);
  const [showNotification, setShowNotification] = useState(false);

  // Animation sequence
  useEffect(() => {
    const sequence = async () => {
      // Stage 0: Initial state
      await delay(1000);

      // Stage 1: Client message appears
      setStage(1);
      await delay(1500);

      // Stage 2: SLA timer starts
      setStage(2);

      // Animate SLA percentage
      for (let i = 0; i <= 80; i += 2) {
        setSlaPercent(i);
        await delay(50);
      }

      await delay(500);

      // Stage 3: Warning notification
      setShowNotification(true);
      await delay(2000);

      // Stage 4: Accountant responds
      setStage(4);
      setShowNotification(false);
      await delay(2000);

      // Reset and loop
      setStage(0);
      setSlaPercent(0);
      await delay(1000);
    };

    sequence();
    const interval = setInterval(sequence, 10000);
    return () => clearInterval(interval);
  }, []);

  const messages: Message[] = [
    {
      id: 1,
      type: 'client',
      text: 'Добрый день! Когда будет готова декларация по НДС?',
      time: '10:24',
    },
    {
      id: 2,
      type: 'accountant',
      text: 'Здравствуйте! Декларация будет готова сегодня до 18:00',
      time: '10:31',
    },
  ];

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
        <div className="relative bg-[#1a1a2e] rounded-[2.5rem] p-2 shadow-2xl shadow-black/50 border border-white/10">
          {/* Phone notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1a1a2e] rounded-b-2xl z-20" />

          {/* Screen */}
          <div className="relative bg-gradient-to-b from-[#0f1629] to-[#0c1222] rounded-[2rem] overflow-hidden min-h-[420px]">
            {/* Chat Header */}
            <div className="bg-[#1a2744]/80 backdrop-blur-sm px-4 py-3 flex items-center gap-3 border-b border-white/5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                ИП
              </div>
              <div className="flex-1">
                <div className="text-white font-medium text-sm">ИП Иванов А.С.</div>
                <div className="text-[var(--buh-foreground-muted)] text-xs">Клиент</div>
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
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
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
              <AnimatePresence>
                {stage >= 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className="flex gap-2"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      И
                    </div>
                    <div className="max-w-[85%]">
                      <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5">
                        <p className="text-white text-sm leading-relaxed">{messages[0].text}</p>
                      </div>
                      <span className="text-[10px] text-white/40 mt-1 ml-2">{messages[0].time}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Typing indicator or Accountant response */}
              <AnimatePresence>
                {stage >= 4 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className="flex gap-2 justify-end"
                  >
                    <div className="max-w-[85%]">
                      <div className="bg-gradient-to-r from-[var(--buh-accent)] to-[var(--buh-primary)] rounded-2xl rounded-tr-sm px-4 py-2.5">
                        <p className="text-white text-sm leading-relaxed">{messages[1].text}</p>
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1 mr-2">
                        <span className="text-[10px] text-white/40">{messages[1].time}</span>
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
                    <div className="bg-white/5 rounded-2xl px-4 py-3 flex gap-1">
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                        className="w-2 h-2 bg-white/40 rounded-full"
                      />
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                        className="w-2 h-2 bg-white/40 rounded-full"
                      />
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                        className="w-2 h-2 bg-white/40 rounded-full"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input field mock */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#0c1222] to-transparent">
              <div className="bg-white/5 rounded-full px-4 py-2.5 flex items-center gap-2 border border-white/10">
                <span className="text-white/30 text-sm">Написать сообщение...</span>
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
                    SLA 80% — ответьте клиенту ИП Иванов
                  </div>
                </div>
              </div>
            </div>
            {/* Notification arrow */}
            <div className="absolute -bottom-2 left-6 w-4 h-4 bg-gradient-to-br from-amber-500 to-orange-600 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

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
