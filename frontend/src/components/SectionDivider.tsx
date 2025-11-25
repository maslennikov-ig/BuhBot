'use client';

import { motion } from 'framer-motion';

export function SectionDivider() {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1, ease: 'easeInOut' }}
      className="w-full h-px bg-gradient-to-r from-transparent via-[var(--buh-border)] to-transparent my-16"
    />
  );
}
