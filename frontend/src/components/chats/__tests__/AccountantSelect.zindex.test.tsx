/**
 * AccountantSelect z-index regression test (gh-289)
 *
 * The InvitationModal root uses `z-[1200]`; the shared shadcn PopoverContent
 * defaults to `z-50`. Radix portals the popover to <body>, so a default
 * z-index renders visually behind the modal overlay. AccountantSelect must
 * pass an explicit `z-[1300]` className to override.
 *
 * Strategy: stub `@/components/ui/popover` so PopoverContent is a plain div
 * which records its className prop. Render the component and inspect the
 * captured className. This is stable across Radix versions and avoids the
 * flakiness of driving the Popover open state in jsdom.
 *
 * @module components/chats/__tests__/AccountantSelect.zindex.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/lib/trpc', () => ({
  trpc: {
    user: {
      list: {
        useQuery: () => ({ data: [], isLoading: false }),
      },
    },
  },
}));

type DivProps = { className?: string; children?: ReactNode };

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: DivProps) => <div data-testid="popover-root">{children}</div>,
  PopoverTrigger: ({ children }: DivProps) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ className, children }: DivProps) => (
    <div data-testid="popover-content" className={className}>
      {children}
    </div>
  ),
}));

import { AccountantSelect } from '../AccountantSelect';

describe('AccountantSelect — popover z-index (gh-289)', () => {
  it('passes z-[1300] to PopoverContent so it renders above the Add Chat modal (z-[1200])', () => {
    const { getByTestId } = render(<AccountantSelect value={null} onChange={vi.fn()} />);

    const content = getByTestId('popover-content');
    expect(content.className).toContain('z-[1300]');
    // Ensure the override is actually present and not a stale default.
    expect(content.className).not.toMatch(/\bz-50\b/);
  });
});
