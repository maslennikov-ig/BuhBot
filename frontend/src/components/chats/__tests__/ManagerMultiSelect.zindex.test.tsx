/**
 * ManagerMultiSelect z-index regression test (gh-289 code-review F2).
 *
 * Mirrors AccountantSelect.zindex.test — both share the Radix Popover pattern
 * and both must pass `z-[1300]` on PopoverContent to stay above z-[1200]
 * modals. Captures the className prop so the regression is stable against
 * Radix version bumps and jsdom portal flakiness.
 *
 * @module components/chats/__tests__/ManagerMultiSelect.zindex.test
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

import { ManagerMultiSelect } from '../ManagerMultiSelect';

describe('ManagerMultiSelect — popover z-index (gh-289 F2)', () => {
  it('passes z-[1300] to PopoverContent for modal contexts', () => {
    const { getByTestId } = render(<ManagerMultiSelect value={[]} onChange={vi.fn()} />);

    const content = getByTestId('popover-content');
    expect(content.className).toContain('z-[1300]');
    expect(content.className).not.toMatch(/\bz-50\b/);
  });
});
