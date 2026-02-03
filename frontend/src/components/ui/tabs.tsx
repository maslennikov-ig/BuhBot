'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const Tabs = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
      {...props}
    />
  )
);
Tabs.displayName = 'Tabs';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

const TabsRoot = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { defaultValue?: string }
>(({ className, defaultValue, children, ...props }, ref) => {
  const [value, setValue] = React.useState(defaultValue || '');

  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
});
TabsRoot.displayName = 'TabsRoot';

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-[var(--buh-surface-elevated)] p-1 text-[var(--buh-foreground-muted)] border border-[var(--buh-border)]',
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  const isSelected = context?.value === value;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={() => context?.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--buh-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isSelected
          ? 'bg-[var(--buh-surface)] text-[var(--buh-foreground)] shadow-sm'
          : 'text-[var(--buh-foreground-muted)] hover:bg-[var(--buh-surface)] hover:text-[var(--buh-foreground)]',
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  if (context?.value !== value) return null;

  return (
    <div
      ref={ref}
      role="tabpanel"
      className={cn(
        'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300',
        className
      )}
      {...props}
    />
  );
});
TabsContent.displayName = 'TabsContent';

export { TabsRoot as Tabs, TabsList, TabsTrigger, TabsContent };
