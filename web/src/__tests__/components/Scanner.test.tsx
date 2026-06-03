import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { Scanner, useHardwareScanner } from '../../components/Scanner';

describe('Scanner & useHardwareScanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset navigator.mediaDevices to a clean writable mock
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  // ─── Camera permission states ─────────────────────────────────────

  test('should render viewfinder loader when camera permissions are pending', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockReturnValue(new Promise(() => {})); // never resolves

    render(<Scanner onScan={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Initializing camera feed...')).toBeInTheDocument();
  });

  test('should render video element when camera permission is granted', async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);

    render(<Scanner onScan={vi.fn()} onClose={vi.fn()} />);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText('Initializing camera feed...')).not.toBeInTheDocument();
  });

  test('should show error warning when camera permission is denied', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockRejectedValue(new Error('Permission Denied'));

    render(<Scanner onScan={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText(/Webcam permission denied/)).toBeInTheDocument();
  });

  test('should show error when navigator.mediaDevices is undefined', async () => {
    // Simulate environments without camera support (e.g., non-HTTPS)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<Scanner onScan={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText(/Camera access is not supported/)).toBeInTheDocument();
  });

  test('should call onClose when close button is clicked', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();

    render(<Scanner onScan={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ─── Native BarcodeDetector scanning ─────────────────────────────

  test('should construct BarcodeDetector with correct formats when available', async () => {
    const onScan = vi.fn();
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);

    const mockDetect = vi.fn().mockResolvedValue([]);
    const MockDetector = vi.fn().mockImplementation(() => ({ detect: mockDetect }));
    (window as any).BarcodeDetector = MockDetector;

    render(<Scanner onScan={onScan} onClose={vi.fn()} />);

    // Wait for startCamera to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // BarcodeDetector should have been constructed with the supported formats
    expect(MockDetector).toHaveBeenCalledWith({
      formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
    });

    delete (window as any).BarcodeDetector;
  });

  test('should log warning when BarcodeDetector is unavailable (fallback mode)', async () => {
    const onScan = vi.fn();
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);

    // Ensure BarcodeDetector is NOT on window
    delete (window as any).BarcodeDetector;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Scanner onScan={onScan} onClose={vi.fn()} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'Native BarcodeDetector API is not supported in this browser. Running mockup scanning feed.'
    );
    warnSpy.mockRestore();
  });

  // ─── useHardwareScanner ──────────────────────────────────────────

  test('should trigger hardware scanner callback on rapid key strokes', () => {
    const mockOnScan = vi.fn();

    // IMPORTANT: spy on Date.now BEFORE renderHook so that the hook's initial
    // `lastKeyTime = Date.now()` also uses the faked value
    let fakeTime = 1000000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

    renderHook(() => useHardwareScanner(mockOnScan));

    for (const char of '47900101') {
      fakeTime += 10; // 10ms between keys → scanner speed
      fireEvent.keyDown(window, { key: char });
    }
    fakeTime += 10;
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockOnScan).toHaveBeenCalledWith('47900101');
    nowSpy.mockRestore();
  });

  test('should ignore key events if typings are too slow (manual entry)', () => {
    const mockOnScan = vi.fn();
    renderHook(() => useHardwareScanner(mockOnScan));

    let fakeTime = 2000000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      fakeTime += 100; // 100ms between keys → manual typing
      return fakeTime;
    });

    for (const char of '47900101') {
      fireEvent.keyDown(window, { key: char });
    }
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockOnScan).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  test('should ignore modifier keys (Shift, Control, Alt, Meta)', () => {
    const mockOnScan = vi.fn();
    renderHook(() => useHardwareScanner(mockOnScan));

    let fakeTime = 3000000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => { fakeTime += 5; return fakeTime; });

    fireEvent.keyDown(window, { key: 'Shift' });
    fireEvent.keyDown(window, { key: 'Control' });
    fireEvent.keyDown(window, { key: 'Alt' });
    fireEvent.keyDown(window, { key: 'Meta' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockOnScan).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  test('should not call onScan for short scanner buffer (< 4 chars)', () => {
    const mockOnScan = vi.fn();
    renderHook(() => useHardwareScanner(mockOnScan));

    let fakeTime = 4000000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => { fakeTime += 5; return fakeTime; });

    fireEvent.keyDown(window, { key: 'A' });
    fireEvent.keyDown(window, { key: 'B' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockOnScan).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  test('should handle Enter key as first slow key (resets buffer to empty)', () => {
    const mockOnScan = vi.fn();
    renderHook(() => useHardwareScanner(mockOnScan));

    let fakeTime = 5000000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => { fakeTime += 200; return fakeTime; });

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockOnScan).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });
});
