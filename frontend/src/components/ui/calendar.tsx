'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const buttonBaseClasses =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50';

  const customClassNames = {
    months: 'flex flex-col sm:flex-row gap-4',
    month: 'space-y-4',
    month_caption: 'relative flex items-center justify-center pt-1',
    caption_label: 'text-sm font-medium',
    nav: 'flex items-center gap-1',
    button_previous: cn(
      buttonBaseClasses,
      'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
      'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
    ),
    button_next: cn(
      buttonBaseClasses,
      'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
      'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
    ),
    month_grid: 'w-full border-collapse',
    weekdays: 'grid grid-cols-7',
    weekday: 'text-muted-foreground h-9 w-9 text-center text-[0.8rem] font-normal',
    week: 'grid grid-cols-7',
    day: 'h-9 w-9 p-0 text-center text-sm',
    day_button: cn(
      buttonBaseClasses,
      'h-9 w-9 p-0 font-normal hover:bg-accent hover:text-accent-foreground aria-selected:opacity-100'
    ),
    range_start:
      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-l-md',
    range_end:
      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-r-md',
    selected:
      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
    today: 'bg-accent text-accent-foreground',
    outside:
      'text-muted-foreground opacity-50 aria-selected:bg-accent/40 aria-selected:text-muted-foreground',
    disabled: 'text-muted-foreground opacity-50',
    range_middle: 'bg-accent text-accent-foreground rounded-none',
    hidden: 'invisible',
    ...classNames,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={customClassNames}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return <Icon className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
