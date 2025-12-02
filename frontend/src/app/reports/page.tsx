'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ReportCard } from '@/components/reports/ReportCard';
import {
  ReportGeneratorModal,
  ReportType,
} from '@/components/reports/ReportGeneratorModal';
import { HelpButton } from '@/components/ui/HelpButton';
import { motion } from 'framer-motion';
import { Users, Clock, Star, BarChart3 } from 'lucide-react';

// ============================================
// ANIMATION VARIANTS
// ============================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

// ============================================
// REPORT TYPES CONFIGURATION
// ============================================

const reportTypes = [
  {
    type: 'productivity' as ReportType,
    icon: Users,
    title: 'Продуктивность операторов',
    description: 'Метрики работы команды за период',
    gradientFrom: 'var(--buh-accent)',
    gradientTo: 'var(--buh-primary)',
    iconColor: 'text-[var(--buh-accent)]',
  },
  {
    type: 'sla' as ReportType,
    icon: Clock,
    title: 'SLA',
    description: 'Анализ соблюдения соглашений',
    gradientFrom: 'var(--buh-primary)',
    gradientTo: 'var(--buh-accent-secondary)',
    iconColor: 'text-[var(--buh-primary)]',
  },
  {
    type: 'quality' as ReportType,
    icon: Star,
    title: 'Качество обслуживания',
    description: 'NPS, CSAT, отзывы',
    gradientFrom: '#f59e0b',
    gradientTo: '#fb923c',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    type: 'summary' as ReportType,
    icon: BarChart3,
    title: 'Сводный отчет',
    description: 'Executive Summary для руководства',
    gradientFrom: 'var(--buh-accent-secondary)',
    gradientTo: 'var(--buh-accent)',
    iconColor: 'text-[var(--buh-accent-secondary)]',
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReportsPage() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedReport, setSelectedReport] = React.useState<{
    type: ReportType;
    title: string;
  } | null>(null);

  const handleOpenModal = (type: ReportType, title: string) => {
    setSelectedReport({ type, title });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedReport(null);
  };

  return (
    <AdminLayout>
      <motion.div
        className="space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--buh-foreground)]">
              Отчеты
            </h1>
            <p className="text-[var(--buh-foreground-muted)] mt-2">
              Формирование и экспорт отчетов для руководства
            </p>
          </div>
          <HelpButton section="reports" />
        </motion.div>

        {/* Report Cards Grid */}
        <motion.div
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
        >
          {reportTypes.map((report, index) => (
            <ReportCard
              key={report.type}
              icon={report.icon}
              title={report.title}
              description={report.description}
              gradientFrom={report.gradientFrom}
              gradientTo={report.gradientTo}
              iconColor={report.iconColor}
              onGenerate={() => handleOpenModal(report.type, report.title)}
              delay={index * 0.1}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Report Generator Modal */}
      {selectedReport && (
        <ReportGeneratorModal
          open={modalOpen}
          onClose={handleCloseModal}
          reportType={selectedReport.type}
          reportTitle={selectedReport.title}
        />
      )}
    </AdminLayout>
  );
}
