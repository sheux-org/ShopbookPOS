import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import { Scanner, useHardwareScanner } from '../../components/Scanner';

describe('Scanner & useHardwareScanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  test('should render viewfinder loader when camera permissions are pending', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockReturnValue(new Promise(() => {})); // pending

    render(<Scanner onScan={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('Initializing camera feed...')).toBeInTheDocument();
  });

  test('should render video element when camera permission is granted', async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);

    render(<Scanner onScan={vi.fn()} onClose={vi.fn()} />);

    // Wait for promise tick
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText('Initializing camera feed...')).not.toBeInTheDocument();
  });

  test('should show error warning when camera permission is denied', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(new Error('Permission Denied'));

    render(<Scanner onScan={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText(/Webcam permission denied/)).toBeInTheDocument();
  });

  test('should trigger hardware scanner callback on rapid key strokes', () => {
    const mockOnScan = vi.fn();
    renderHook(() => useHardwareScanner(mockOnScan));

    // Simulate hardware barcode entry typings (time interval between typings is 10ms < 50ms)
    const scanCode = '47900101';
    
    // Fake window key events
    let fakeTime = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => {
      fakeTime += 10; // increment by 10ms for each key stroke
      return fakeTime;
    });

    for (const char of scanCode) {
      fireEvent.keyDown(window, { key: char });
    }
    
    // Simulate Enter key termination
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockOnScan).toHaveBeenCalledWith('47900101');
  });

  test('should ignore key events if typings are too slow (simulating manual entry)', () => {
    const mockOnScan = vi.fn();
    renderHook(() => useHardwareScanner(mockOnScan));

    let fakeTime = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => {
      fakeTime += 100; // manual typings: 100ms > 50ms interval
      return fakeTime;
    });

    const scanCode = '47900101';
    for (const char of scanCode) {
      fireEvent.keyDown(window, { key: char });
    }
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockOnScan).not.toHaveBeenCalled();
  });
});
