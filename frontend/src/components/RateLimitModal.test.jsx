import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RateLimitModal from './RateLimitModal.jsx';

describe('RateLimitModal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('explains the cap and counts down to the next window', () => {
        render(<RateLimitModal limit={5} resetAt={Date.now() + 3000} onClose={() => {}} />);

        const dialog = screen.getByRole('dialog', { name: 'Request limit reached' });
        expect(dialog).toHaveProperty(
            'textContent',
            expect.stringContaining('5 decisions per minute'),
        );
        expect(screen.getByRole('timer').textContent).toBe('You can try again in 3 seconds.');

        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByRole('timer').textContent).toBe('You can try again in 2 seconds.');

        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByRole('timer').textContent).toBe('You can try again in 1 second.');
    });

    it('closes itself when the countdown reaches zero', () => {
        const onClose = vi.fn();
        render(<RateLimitModal limit={5} resetAt={Date.now() + 2000} onClose={onClose} />);

        act(() => vi.advanceTimersByTime(1750));
        expect(onClose).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(250));
        expect(onClose).toHaveBeenCalledOnce();
        act(() => vi.advanceTimersByTime(5000));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('can be dismissed early with the button or Escape', () => {
        const onClose = vi.fn();
        render(<RateLimitModal limit={5} resetAt={Date.now() + 30_000} onClose={onClose} />);

        fireEvent.click(screen.getByRole('button', { name: 'OK' }));
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
