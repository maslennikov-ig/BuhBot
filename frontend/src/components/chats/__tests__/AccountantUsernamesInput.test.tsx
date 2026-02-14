/**
 * AccountantUsernamesInput Component Tests
 *
 * Tests for multi-input Telegram username component with validation,
 * chip display, and duplicate prevention.
 *
 * @module components/chats/__tests__/AccountantUsernamesInput.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountantUsernamesInput } from '../AccountantUsernamesInput';

// ============================================
// TEST SUITE
// ============================================

describe('AccountantUsernamesInput', () => {
  // ============================================
  // 1. RENDERING TESTS
  // ============================================

  describe('Rendering', () => {
    it('should render empty state when no usernames', () => {
      const onChange = vi.fn();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      // Check for empty state message
      expect(screen.getByText('Список @username бухгалтеров пуст')).toBeInTheDocument();

      // Check for input placeholder
      expect(screen.getByPlaceholderText('Введите @username')).toBeInTheDocument();

      // Check for add button
      expect(screen.getByLabelText('Добавить username')).toBeInTheDocument();
    });

    it('should render custom placeholder when provided', () => {
      const onChange = vi.fn();

      render(
        <AccountantUsernamesInput
          value={[]}
          onChange={onChange}
          placeholder="Введите имя пользователя"
        />
      );

      expect(screen.getByPlaceholderText('Введите имя пользователя')).toBeInTheDocument();
    });

    it('should render chips for existing usernames', () => {
      const onChange = vi.fn();
      const usernames = ['user123', 'accountant_pro'];

      render(<AccountantUsernamesInput value={usernames} onChange={onChange} />);

      // Check that both usernames are displayed
      expect(screen.getByText('@user123')).toBeInTheDocument();
      expect(screen.getByText('@accountant_pro')).toBeInTheDocument();

      // Check that empty state is NOT shown
      expect(screen.queryByText('Список @username бухгалтеров пуст')).not.toBeInTheDocument();
    });

    it('should show disabled state correctly', () => {
      const onChange = vi.fn();

      render(<AccountantUsernamesInput value={['user123']} onChange={onChange} disabled />);

      // Input should be disabled
      const input = screen.getByPlaceholderText('Введите @username');
      expect(input).toBeDisabled();

      // Add button should be disabled
      const addButton = screen.getByLabelText('Добавить username');
      expect(addButton).toBeDisabled();

      // Remove button should NOT be present when disabled
      expect(screen.queryByLabelText('Удалить user123')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const onChange = vi.fn();

      const { container } = render(
        <AccountantUsernamesInput value={[]} onChange={onChange} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  // ============================================
  // 2. ADDING USERNAMES TESTS
  // ============================================

  describe('Adding usernames', () => {
    it('should add valid username via Enter key', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Type username and press Enter
      await user.type(input, 'user123');
      await user.keyboard('{Enter}');

      // onChange should be called with the new username
      expect(onChange).toHaveBeenCalledWith(['user123']);

      // Input should be cleared after successful add
      expect(input).toHaveValue('');
    });

    it('should add valid username via + button click', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');
      const addButton = screen.getByLabelText('Добавить username');

      // Type username
      await user.type(input, 'testuser');

      // Click add button
      await user.click(addButton);

      // onChange should be called
      expect(onChange).toHaveBeenCalledWith(['testuser']);

      // Input should be cleared
      expect(input).toHaveValue('');
    });

    it('should normalize username by removing @ prefix', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Type username with @ prefix
      await user.type(input, '@user123');
      await user.keyboard('{Enter}');

      // @ should be removed
      expect(onChange).toHaveBeenCalledWith(['user123']);
    });

    it('should preserve case but validate using lowercase', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Type username with mixed case - validation checks lowercase but stores as-is
      await user.type(input, 'UserName123');
      await user.keyboard('{Enter}');

      // Case is preserved but validation passes (validates lowercase version)
      expect(onChange).toHaveBeenCalledWith(['UserName123']);
    });

    it('should reject invalid format (too short)', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Type username that's too short (less than 5 chars)
      await user.type(input, 'user');
      await user.keyboard('{Enter}');

      // onChange should NOT be called - validation should fail
      expect(onChange).not.toHaveBeenCalled();

      // Input should still contain the invalid value
      expect(input).toHaveValue('user');
    });

    it('should reject invalid format (too long)', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Type username that's too long (more than 32 chars)
      const longUsername = 'a'.repeat(33);
      await user.type(input, longUsername);
      await user.keyboard('{Enter}');

      // onChange should NOT be called - validation should fail
      expect(onChange).not.toHaveBeenCalled();

      // Input should still contain the invalid value
      expect(input).toHaveValue(longUsername);
    });

    it('should reject username starting with underscore', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Type username starting with underscore
      await user.type(input, '_user123');
      await user.keyboard('{Enter}');

      // onChange should NOT be called - validation should fail
      expect(onChange).not.toHaveBeenCalled();

      // Input should still contain the invalid value
      expect(input).toHaveValue('_user123');
    });

    it('should reject username ending with underscore', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Type username ending with underscore
      await user.type(input, 'user123_');
      await user.keyboard('{Enter}');

      // onChange should NOT be called - validation should fail
      expect(onChange).not.toHaveBeenCalled();

      // Input should still contain the invalid value
      expect(input).toHaveValue('user123_');
    });

    it('should reject duplicate username', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={['user123']} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Try to add duplicate username
      await user.type(input, 'user123');
      await user.keyboard('{Enter}');

      // onChange should NOT be called - duplicate check should fail
      expect(onChange).not.toHaveBeenCalled();

      // Input should still contain the attempted duplicate
      expect(input).toHaveValue('user123');
    });

    it('should clear input after successful add', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Type and add username
      await user.type(input, 'user123');
      await user.keyboard('{Enter}');

      // Input should be empty
      expect(input).toHaveValue('');
    });

    it('should allow retry after validation failure', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // First attempt with invalid username
      await user.type(input, 'user');
      await user.keyboard('{Enter}');
      expect(onChange).not.toHaveBeenCalled();

      // Clear and retry with valid username
      await user.clear(input);
      await user.type(input, 'validuser123');
      await user.keyboard('{Enter}');

      // This time onChange should be called
      expect(onChange).toHaveBeenCalledWith(['validuser123']);
    });

    it('should not add empty or whitespace-only username', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Try to add empty username
      await user.keyboard('{Enter}');
      expect(onChange).not.toHaveBeenCalled();

      // Try to add whitespace-only username
      await user.type(input, '   ');
      await user.keyboard('{Enter}');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should disable add button when input is empty', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const addButton = screen.getByLabelText('Добавить username');

      // Add button should be disabled when input is empty
      expect(addButton).toBeDisabled();

      // Type something
      const input = screen.getByPlaceholderText('Введите @username');
      await user.type(input, 'user123');

      // Add button should now be enabled
      expect(addButton).not.toBeDisabled();
    });
  });

  // ============================================
  // 3. REMOVING USERNAMES TESTS
  // ============================================

  describe('Removing usernames', () => {
    it('should remove username via X button click', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={['user123', 'testuser']} onChange={onChange} />);

      // Find and click remove button for user123
      const removeButton = screen.getByLabelText('Удалить user123');
      await user.click(removeButton);

      // onChange should be called with remaining username
      expect(onChange).toHaveBeenCalledWith(['testuser']);
    });

    it('should not show remove button when disabled', () => {
      const onChange = vi.fn();

      render(
        <AccountantUsernamesInput value={['user123', 'testuser']} onChange={onChange} disabled />
      );

      // Remove buttons should NOT be present
      expect(screen.queryByLabelText('Удалить user123')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Удалить testuser')).not.toBeInTheDocument();
    });

    it('should remove correct username when multiple exist', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(
        <AccountantUsernamesInput
          value={['alice123', 'bob456', 'charlie789']}
          onChange={onChange}
        />
      );

      // Remove middle username
      const removeButton = screen.getByLabelText('Удалить bob456');
      await user.click(removeButton);

      // onChange should be called with alice and charlie only
      expect(onChange).toHaveBeenCalledWith(['alice123', 'charlie789']);
    });
  });

  // ============================================
  // 4. VALIDATION TESTS
  // ============================================

  describe('Validation', () => {
    it('should accept valid usernames', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const validUsernames = [
        'user123',
        '@username',
        'user_name',
        'test_user_123',
        'abcde', // exactly 5 chars
        'a'.repeat(32), // exactly 32 chars
      ];

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      for (const username of validUsernames) {
        await user.clear(input);
        await user.type(input, username);
        await user.keyboard('{Enter}');

        // onChange should be called (username was valid)
        expect(onChange).toHaveBeenCalled();

        // Clear mock for next iteration
        onChange.mockClear();
      }
    });

    it('should reject all invalid username formats', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const invalidUsernames = [
        'user', // too short (4 chars)
        'a'.repeat(33), // too long (33 chars)
        '_user123', // starts with underscore
        'user123_', // ends with underscore
        'user@name', // invalid character
        'user name', // space not allowed
        'user-name', // dash not allowed
        'user.name', // dot not allowed
      ];

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      for (const username of invalidUsernames) {
        await user.clear(input);
        await user.type(input, username);
        await user.keyboard('{Enter}');

        // onChange should NOT be called (username was invalid)
        expect(onChange).not.toHaveBeenCalled();
      }

      // Total: no usernames should have been added
      expect(onChange).toHaveBeenCalledTimes(0);
    });

    it('should handle edge case: username with consecutive underscores', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Username with consecutive underscores (should be valid)
      await user.type(input, 'user__name');
      await user.keyboard('{Enter}');

      // Should be accepted
      expect(onChange).toHaveBeenCalledWith(['user__name']);
    });

    it('should handle edge case: username with numbers only in middle', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Username like 'a1234b' (valid)
      await user.type(input, 'a1234b');
      await user.keyboard('{Enter}');

      // Should be accepted
      expect(onChange).toHaveBeenCalledWith(['a1234b']);
    });
  });

  // ============================================
  // 5. INTEGRATION TESTS
  // ============================================

  describe('Integration scenarios', () => {
    it('should handle complete workflow: add multiple, remove one, add again', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Add first username
      await user.type(input, 'alice123');
      await user.keyboard('{Enter}');
      expect(onChange).toHaveBeenCalledWith(['alice123']);

      // Simulate state update
      rerender(<AccountantUsernamesInput value={['alice123']} onChange={onChange} />);

      // Add second username
      await user.type(input, 'bob456');
      await user.keyboard('{Enter}');
      expect(onChange).toHaveBeenCalledWith(['alice123', 'bob456']);

      // Simulate state update
      rerender(<AccountantUsernamesInput value={['alice123', 'bob456']} onChange={onChange} />);

      // Remove first username
      const removeButton = screen.getByLabelText('Удалить alice123');
      await user.click(removeButton);
      expect(onChange).toHaveBeenCalledWith(['bob456']);

      // Simulate state update
      rerender(<AccountantUsernamesInput value={['bob456']} onChange={onChange} />);

      // Add third username
      await user.type(input, 'charlie789');
      await user.keyboard('{Enter}');
      expect(onChange).toHaveBeenCalledWith(['bob456', 'charlie789']);
    });

    it('should handle rapid successive additions', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      const usernames = ['user1aa', 'user2bb', 'user3cc'];

      for (const username of usernames) {
        await user.type(input, username);
        await user.keyboard('{Enter}');

        // Simulate state update
        const currentValue = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        rerender(<AccountantUsernamesInput value={currentValue} onChange={onChange} />);
      }

      // Should have called onChange 3 times
      expect(onChange).toHaveBeenCalledTimes(3);

      // Final state should have all usernames
      expect(onChange).toHaveBeenLastCalledWith(['user1aa', 'user2bb', 'user3cc']);
    });

    it('should handle validation failure then success workflow', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(<AccountantUsernamesInput value={[]} onChange={onChange} />);

      const input = screen.getByPlaceholderText('Введите @username');

      // Try invalid username (too short)
      await user.type(input, 'bad');
      await user.keyboard('{Enter}');

      // onChange should NOT be called
      expect(onChange).not.toHaveBeenCalled();

      // Clear and try valid username
      await user.clear(input);
      await user.type(input, 'gooduser123');
      await user.keyboard('{Enter}');

      // Now onChange should be called with valid username
      expect(onChange).toHaveBeenCalledWith(['gooduser123']);
    });
  });
});
