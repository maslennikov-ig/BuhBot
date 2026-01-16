'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================
// TYPES
// ============================================

type ErrorLevel = 'error' | 'warn' | 'info';
type ErrorStatus = 'new' | 'in_progress' | 'resolved' | 'ignored';

type LogsFiltersProps = {
  onFiltersChange: (filters: {
    level?: ErrorLevel;
    status?: ErrorStatus;
    search?: string;
    service?: string;
  }) => void;
};

// ============================================
// COMPONENT
// ============================================

export function LogsFilters({ onFiltersChange }: LogsFiltersProps) {
  const [level, setLevel] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [service, setService] = useState<string>('');

  const handleChange = (newFilters: {
    level: string;
    status: string;
    search: string;
    service: string;
  }) => {
    onFiltersChange({
      level: (newFilters.level || undefined) as ErrorLevel | undefined,
      status: (newFilters.status || undefined) as ErrorStatus | undefined,
      search: newFilters.search || undefined,
      service: newFilters.service || undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--buh-foreground-subtle)]" />
        <Input
          placeholder="Поиск по сообщению..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            handleChange({ level, status, search: e.target.value, service });
          }}
          className="pl-10"
        />
      </div>

      {/* Level filter */}
      <Select
        value={level}
        onValueChange={(val) => {
          setLevel(val);
          handleChange({ level: val, status, search, service });
        }}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Уровень" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Все уровни</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="warn">Warning</SelectItem>
          <SelectItem value="info">Info</SelectItem>
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={status}
        onValueChange={(val) => {
          setStatus(val);
          handleChange({ level, status: val, search, service });
        }}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Все статусы</SelectItem>
          <SelectItem value="new">Новая</SelectItem>
          <SelectItem value="in_progress">В работе</SelectItem>
          <SelectItem value="resolved">Решено</SelectItem>
          <SelectItem value="ignored">Игнорируется</SelectItem>
        </SelectContent>
      </Select>

      {/* Service filter */}
      <Select
        value={service}
        onValueChange={(val) => {
          setService(val);
          handleChange({ level, status, search, service: val });
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Сервис" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Все сервисы</SelectItem>
          <SelectItem value="buhbot-backend">BuhBot Backend</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
