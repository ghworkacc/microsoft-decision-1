import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppLayout from './AppLayout.jsx';

describe('AppLayout', () => {
    it('renders attachments for a selected sample and omits them otherwise', () => {
        render(
            <AppLayout onSampleChange={vi.fn()}>{(sample) => <div>{sample.name}</div>}</AppLayout>,
        );

        expect(screen.queryByRole('img')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'keep talking (decision unit)' }));

        expect(screen.getByRole('img').getAttribute('src')).toBe(
            '/assets/attachments/keep_talking.png',
        );
        expect(screen.getByRole('img').compareDocumentPosition(screen.getByRole('main'))).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
    });
});
