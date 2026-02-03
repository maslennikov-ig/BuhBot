'use client';

import * as React from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface ReportCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  iconColor: string;
  onGenerate: () => void;
  delay?: number;
}

// ============================================
// ANIMATION VARIANTS
// ============================================

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
  hover: {
    y: -4,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

// ============================================
// REPORT CARD COMPONENT
// ============================================

export function ReportCard({
  icon: Icon,
  title,
  description,
  gradientFrom,
  gradientTo,
  iconColor,
  onGenerate,
  delay = 0,
}: ReportCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      transition={{ delay }}
    >
      <GlassCard
        variant="elevated"
        padding="lg"
        className="relative overflow-hidden group h-full flex flex-col"
      >
        {/* Animated gradient accent */}
        <motion.div
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: delay + 0.2, duration: 0.6 }}
        />

        {/* Icon */}
        <div className="flex items-center justify-center mb-4">
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${gradientFrom}15, ${gradientTo}15)`,
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.3 }}
          >
            <Icon className={cn('h-8 w-8', iconColor)} />
          </motion.div>
        </div>

        {/* Content */}
        <div className="flex-1 text-center mb-6">
          <h3 className="text-lg font-semibold text-[var(--buh-foreground)] mb-2">{title}</h3>
          <p className="text-sm text-[var(--buh-foreground-muted)] leading-relaxed">
            {description}
          </p>
        </div>

        {/* Button */}
        <Button
          onClick={onGenerate}
          className="w-full text-white hover:text-white"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          }}
        >
          Сформировать
        </Button>

        {/* Hover glow effect */}
        <div
          className="absolute -bottom-16 -right-16 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
          style={{ background: gradientFrom }}
        />
      </GlassCard>
    </motion.div>
  );
}
