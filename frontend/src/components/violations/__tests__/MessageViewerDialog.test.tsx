/**
 * MessageViewerDialog tests (gh-293)
 *
 * Verifies:
 *  - Row action replaces the non-a11y native tooltip with a real dialog.
 *  - Radix Dialog primitives wire focus/ESC/return-focus correctly.
 *  - Metadata rendering: chat link, timestamps, SLA excess badge.
 *  - Edge cases: short, long (>1000 chars), empty, and chatId=null/undefined.
 *
 * Strategy: drive the Dialog open via the real Radix primitives (they run in
 * jsdom), not via a stub. The primitives portal to document.body so we query
 * there via @testing-library/react.
 *
 * @module components/violations/__tests__/MessageViewerDialog.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MessageViewerDialogRequest } from '../MessageViewerDialog';
import { MessageViewerDialog } from '../MessageViewerDialog';

// next/link resolves to <a> in tests — no mock needed for default behaviour.

function makeRequest(
  overrides: Partial<MessageViewerDialogRequest> = {}
): MessageViewerDialogRequest {
  return {
    messageText: 'Короткое сообщение клиента',
    clientUsername: 'client_user',
    chatTitle: 'ООО Ромашка',
    chatId: '42',
    receivedAt: new Date('2026-04-15T10:30:00Z'),
    respondedAt: null,
    slaMinutes: 60,
    excessMinutes: 30,
    excessSevere: false,
    isOpenBreach: true,
    ...overrides,
  };
}

describe('MessageViewerDialog (gh-293)', () => {
  it('renders trigger with accessible name that includes the client username', () => {
    render(<MessageViewerDialog preview="preview text" request={makeRequest()} />);

    const trigger = screen.getByRole('button', {
      name: /показать полное сообщение от client_user/i,
    });
    expect(trigger).toBeInTheDocument();
  });

  it('shows the preview text inside the trigger (table layout stays compact)', () => {
    render(<MessageViewerDialog preview="Первые 100 символов..." request={makeRequest()} />);
    expect(screen.getByText('Первые 100 символов...')).toBeInTheDocument();
  });

  it('opens a dialog with DialogTitle wired to aria-labelledby when the trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageViewerDialog preview="preview" request={makeRequest()} />);

    await user.click(screen.getByRole('button', { name: /показать полное сообщение/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Radix wires aria-labelledby to the DialogTitle node.
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId!)?.textContent).toBe('Сообщение клиента');
  });

  it('renders full messageText verbatim inside a scrollable <pre> (short body)', async () => {
    const user = userEvent.setup();
    render(<MessageViewerDialog preview="ok" request={makeRequest({ messageText: 'ok' })} />);

    await user.click(screen.getByRole('button', { name: /показать полное сообщение/i }));
    const dialog = await screen.findByRole('dialog');
    const pre = within(dialog).getByText('ok', { selector: 'pre' });
    expect(pre).toHaveAttribute('tabindex', '0');
    expect(pre.className).toMatch(/overflow-auto/);
  });

  it('renders a very long messageText (>1000 chars) without truncation', async () => {
    const user = userEvent.setup();
    const longText = 'A'.repeat(2000) + '\nLine two.';
    render(<MessageViewerDialog preview="A..." request={makeRequest({ messageText: longText })} />);

    await user.click(screen.getByRole('button', { name: /показать полное сообщение/i }));
    const dialog = await screen.findByRole('dialog');
    const pre = dialog.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre!.tagName).toBe('PRE');
    expect(pre!.textContent).toBe(longText);
    expect(pre!.className).toMatch(/overflow-auto/);
  });

  it('shows an empty-state placeholder when messageText is blank', async () => {
    const user = userEvent.setup();
    render(<MessageViewerDialog preview="—" request={makeRequest({ messageText: '   ' })} />);

    await user.click(screen.getByRole('button', { name: /показать полное сообщение/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Сообщение пустое.')).toBeInTheDocument();
  });

  it('links to /chats/{chatId} when chatId is present', async () => {
    const user = userEvent.setup();
    render(<MessageViewerDialog preview="x" request={makeRequest({ chatId: '777' })} />);

    await user.click(screen.getByRole('button', { name: /показать полное сообщение/i }));
    const dialog = await screen.findByRole('dialog');
    const link = within(dialog).getByRole('link', { name: /ООО Ромашка/ });
    expect(link).toHaveAttribute('href', '/chats/777');
  });

  it('falls back to plain text when chatId is null (no link rendered)', async () => {
    const user = userEvent.setup();
    render(<MessageViewerDialog preview="x" request={makeRequest({ chatId: null })} />);

    await user.click(screen.getByRole('button', { name: /показать полное сообщение/i }));
    const dialog = await screen.findByRole('dialog');
    // Chat title visible, but not as a link.
    expect(within(dialog).getByText('ООО Ромашка')).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: /ООО Ромашка/ })).toBeNull();
  });

  it('closes on ESC and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<MessageViewerDialog preview="x" request={makeRequest()} />);

    const trigger = screen.getByRole('button', { name: /показать полное сообщение/i });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');
    // Dialog removed from the accessibility tree.
    expect(screen.queryByRole('dialog')).toBeNull();
    // Focus restored to trigger.
    expect(trigger).toHaveFocus();
  });

  it('renders the SLA excess badge with "open breach" annotation when there is no response', async () => {
    const user = userEvent.setup();
    render(
      <MessageViewerDialog
        preview="x"
        request={makeRequest({
          isOpenBreach: true,
          respondedAt: null,
          slaMinutes: 60,
          excessMinutes: 90,
        })}
      />
    );

    await user.click(screen.getByRole('button', { name: /показать полное сообщение/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/ответа пока нет/i)).toBeInTheDocument();
  });
});
