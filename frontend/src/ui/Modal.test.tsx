import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Modal } from './Modal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Modal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it('renders its children in a role="dialog" element when open is true', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal open label="Test modal" onClose={onClose}>
          <p>Test content</p>
        </Modal>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Test content');
  });

  it('renders nothing when open is false', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal open={false} label="Test modal" onClose={onClose}>
          <p>Test content</p>
        </Modal>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal open label="Test modal" onClose={onClose}>
          <p>Test content</p>
        </Modal>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeDefined();

    await act(async () => {
      dialog.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal open label="Test modal" onClose={onClose}>
          <p>Test content</p>
        </Modal>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeDefined();

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      dialog.dispatchEvent(event);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when content inside the dialog is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal open label="Test modal" onClose={onClose}>
          <div className="content">
            <p>Test content</p>
          </div>
        </Modal>,
      );
    });

    const content = document.body.querySelector('.content') as HTMLElement;
    expect(content).toBeDefined();

    await act(async () => {
      content.click();
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
