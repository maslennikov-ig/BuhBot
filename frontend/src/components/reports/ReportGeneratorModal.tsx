'use client';

import * as React from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Download, Calendar } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// TYPES
// ============================================

export type ReportType = 'productivity' | 'sla' | 'quality' | 'summary';
type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
type FormatType = 'csv' | 'pdf';

interface ReportGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  reportType: ReportType;
  reportTitle: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getDatesForPeriod = (period: PeriodType): [Date, Date] => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setDate(start.getDate() - 365);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      break;
  }

  return [start, end];
};

const mapReportTypeToBackend = (
  reportType: ReportType
): 'sla_compliance' | 'accountant_performance' | 'violations' => {
  switch (reportType) {
    case 'productivity':
      return 'accountant_performance';
    case 'sla':
    case 'quality':
      return 'sla_compliance';
    case 'summary':
      return 'violations'; // Временно используем violations для сводного
    default:
      return 'sla_compliance';
  }
};

// ============================================
// MODAL COMPONENT
// ============================================

export function ReportGeneratorModal({
  open,
  onClose,
  reportType,
  reportTitle,
}: ReportGeneratorModalProps) {
  const [period, setPeriod] = React.useState<PeriodType>('month');
  const [format, setFormat] = React.useState<FormatType>('csv');
  const [customStartDate, setCustomStartDate] = React.useState<string>('');
  const [customEndDate, setCustomEndDate] = React.useState<string>('');
  const [selectedAccountantId, setSelectedAccountantId] = React.useState<string>('all');
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Fetch users for accountant filter
  const usersQuery = trpc.auth.listUsers.useQuery({}, { enabled: open });

  // Get tRPC utils at component level (not inside callbacks)
  const utils = trpc.useUtils();

  // Calculate date range
  const [dateFrom, dateTo] = React.useMemo(() => {
    if (period === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return [start, end];
    }
    return getDatesForPeriod(period);
  }, [period, customStartDate, customEndDate]);

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const backendReportType = mapReportTypeToBackend(reportType);

      // Use tRPC client directly for query
      const result = await utils.client.analytics.exportReport.query({
        reportType: backendReportType,
        dateFrom,
        dateTo,
        accountantId: selectedAccountantId === 'all' ? undefined : selectedAccountantId,
        format: format === 'pdf' ? 'csv' : format, // PDF not supported yet, fallback to CSV
      });

      // Download file
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = result.filename;
      link.click();

      // Show success feedback
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Ошибка при формировании отчета. Попробуйте еще раз.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GlassCard variant="elevated" padding="lg" className="w-full max-w-lg relative">
              {/* Close button */}
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="absolute right-4 top-4 text-[var(--buh-foreground-muted)] hover:text-[var(--buh-foreground)] transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[var(--buh-foreground)]">{reportTitle}</h2>
                <p className="text-sm text-[var(--buh-foreground-muted)] mt-1">
                  Настройте параметры формирования отчета
                </p>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* Period */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--buh-foreground)] flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Период
                  </label>
                  <Select value={period} onValueChange={(v: PeriodType) => setPeriod(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите период" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Сегодня</SelectItem>
                      <SelectItem value="week">Неделя</SelectItem>
                      <SelectItem value="month">Месяц</SelectItem>
                      <SelectItem value="quarter">Квартал</SelectItem>
                      <SelectItem value="year">Год</SelectItem>
                      <SelectItem value="custom">Произвольный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom date range */}
                {period === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--buh-foreground)]">От</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--buh-foreground)]">До</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </div>
                )}

                {/* Format */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--buh-foreground)]">Формат</label>
                  <Select value={format} onValueChange={(v: FormatType) => setFormat(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите формат" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="pdf" disabled>
                        PDF (Coming Soon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Accountant filter (only for productivity report) */}
                {reportType === 'productivity' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--buh-foreground)]">
                      Фильтр по оператору
                    </label>
                    <Select value={selectedAccountantId} onValueChange={setSelectedAccountantId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Все операторы" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все операторы</SelectItem>
                        {usersQuery.data?.map((user: { id: string; fullName: string }) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="ghost" onClick={onClose} disabled={isGenerating}>
                  Отмена
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={
                    isGenerating || (period === 'custom' && (!customStartDate || !customEndDate))
                  }
                  className="gap-2 bg-[var(--buh-primary)] text-white hover:bg-[var(--buh-primary-hover)] hover:text-white"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Формирование...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Сформировать
                    </>
                  )}
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
