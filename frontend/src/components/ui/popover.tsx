'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

/**
 * z-index contract for PopoverContent:
 *   - Default `z-50` matches shadcn convention for non-modal contexts
 *     (tooltips, dropdowns, command palette, date pickers).
 *   - When a Popover is placed inside a modal that uses `z-[1200]` (e.g.
 *     `InvitationModal`, any `ChatDetails` overlay), the caller MUST pass
 *     `z-[1300]` (or higher) via `className` — `cn`/twMerge replaces the
 *     default. See `AccountantSelect` and `ManagerMultiSelect` for reference
 *     and `gh-289` for the original bug context.
 *   - Do NOT raise the default here: doing so would shift tooltips and
 *     DropdownMenu portals above elements that currently rely on the
 *     default stacking order.
 */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
