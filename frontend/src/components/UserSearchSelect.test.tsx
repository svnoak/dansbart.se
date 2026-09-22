import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UserSearchSelect } from './UserSearchSelect';
import type { UserSummaryDto } from '@/api/models/userSummaryDto';
import { typeInto, pressKey } from '@/test/typeInto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const searchUsers = vi.fn();

vi.mock('@/api/generated/users/users', () => ({
  searchUsers: (...args: unknown[]) => searchUsers(...args),
}));

describe('UserSearchSelect', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    searchUsers.mockReset();
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    root.unmount();
    container.remove();
  });

  it('does not search below two characters', async () => {
    await act(async () => {
      root.render(
        <UserSearchSelect
          selected={null}
          onSelect={() => {}}
          label="Search users"
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input');
    expect(input).toBeDefined();

    await act(async () => {
      typeInto(input!, 'a');
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('searches after two characters and shows results', async () => {
    const results: UserSummaryDto[] = [
      { id: 'user-1', username: 'anna', displayName: 'Anna Svensson' },
      { id: 'user-2', username: 'anders', displayName: 'Anders Andersson' },
    ];

    searchUsers.mockResolvedValue(results);

    await act(async () => {
      root.render(
        <UserSearchSelect
          selected={null}
          onSelect={() => {}}
          label="Search users"
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input');
    expect(input).toBeDefined();

    await act(async () => {
      typeInto(input!, 'an');
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(searchUsers).toHaveBeenCalledWith({ q: 'an', limit: 8 });

    await act(async () => {
      await Promise.resolve();
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    const annaButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('Anna Svensson'),
    );
    expect(annaButton).toBeDefined();
    expect(annaButton?.textContent).toContain('@anna');

    const andersButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('Anders Andersson'),
    );
    expect(andersButton).toBeDefined();
    expect(andersButton?.textContent).toContain('@anders');
  });

  it('selecting a result calls onSelect and closes the list', async () => {
    const onSelect = vi.fn();
    const user: UserSummaryDto = { id: 'user-1', username: 'anna', displayName: 'Anna Svensson' };

    searchUsers.mockResolvedValue([user]);

    await act(async () => {
      root.render(
        <UserSearchSelect
          selected={null}
          onSelect={onSelect}
          label="Search users"
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input');

    await act(async () => {
      typeInto(input!, 'an');
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const resultButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Anna Svensson'),
    );

    await act(async () => {
      resultButton?.click();
    });

    expect(onSelect).toHaveBeenCalledWith(user);

    await act(async () => {
      await Promise.resolve();
    });

    const remainingButtons = container.querySelectorAll('button');
    const stillShowing = Array.from(remainingButtons).some((b) =>
      b.textContent?.includes('Anna Svensson'),
    );
    expect(stillShowing).toBe(false);
  });

  it('Escape closes the result list', async () => {
    const results: UserSummaryDto[] = [
      { id: 'user-1', username: 'anna', displayName: 'Anna Svensson' },
    ];

    searchUsers.mockResolvedValue(results);

    await act(async () => {
      root.render(
        <UserSearchSelect
          selected={null}
          onSelect={() => {}}
          label="Search users"
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input');

    await act(async () => {
      typeInto(input!, 'an');
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      pressKey(input!, 'Escape');
    });

    const results_list = container.querySelector('ul');
    expect(results_list).toBeNull();
  });

  it('never shows a raw user id', async () => {
    const results: UserSummaryDto[] = [
      { id: 'user-1-with-uuid', displayName: undefined, username: undefined },
    ];

    searchUsers.mockResolvedValue(results);

    await act(async () => {
      root.render(
        <UserSearchSelect
          selected={null}
          onSelect={() => {}}
          label="Search users"
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input');

    await act(async () => {
      typeInto(input!, 'ab');
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const text = container.textContent;
    expect(text).not.toContain('user-1-with-uuid');
  });

  it('closes the result list on an outside click', async () => {
    const results: UserSummaryDto[] = [
      { id: 'user-1', username: 'anna', displayName: 'Anna Svensson' },
    ];

    searchUsers.mockResolvedValue(results);

    await act(async () => {
      root.render(
        <UserSearchSelect
          selected={null}
          onSelect={() => {}}
          label="Search users"
        />,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input');

    await act(async () => {
      typeInto(input!, 'an');
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await act(async () => {
      await Promise.resolve();
    });

    let resultsList = container.querySelector('ul');
    expect(resultsList).toBeDefined();

    const mousedownEvent = new MouseEvent('mousedown', { bubbles: true });
    await act(async () => {
      document.body.dispatchEvent(mousedownEvent);
    });

    resultsList = container.querySelector('ul');
    expect(resultsList).toBeNull();
  });
});
