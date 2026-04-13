// @vitest-environment jsdom
import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import {MenuPage} from './MenuPage';

describe('MenuPage', () => {
  it('opens single/multi chooser after pressing start', () => {
    render(<MenuPage user={{id: 1, username: 'alpha'}} sessionSaveCount={0} onOpenMultiplayer={vi.fn()} onPlay={vi.fn()} onViewRecords={vi.fn()} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByText('게임 시작'));
    expect(screen.getByText('싱글').textContent).toBe('싱글');
    expect(screen.getByText('멀티').textContent).toBe('멀티');
  });
});
