import { describe, test, expect, vi, beforeEach } from 'vitest';
import { POST as checkPost } from '../../app/api/auth/check/route';
import { POST as verifyPost } from '../../app/api/auth/verify/route';

describe('Auth API Proxies', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch; // reset to original before mocking
  });

  // ─── /api/auth/check ──────────────────────────────────────────────

  test('/api/auth/check should forward parameters and return tokens on success', async () => {
    const mockJson = { token: 'mock-verification-token' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJson,
    });
    global.fetch = mockFetch;

    const request = new Request('http://localhost:3000/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: '771234567' }),
    });

    const response = await checkPost(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.token).toBe('mock-verification-token');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mini-pos-sync-server.vercel.app/api/v1/auth/check',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phone_number: '771234567' }),
      })
    );
  });

  test('/api/auth/check should forward error status codes and text from proxy backend', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid phone number format',
    });
    global.fetch = mockFetch;

    const request = new Request('http://localhost:3000/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: 'invalid' }),
    });

    const response = await checkPost(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.message).toBe('Invalid phone number format');
  });

  test('/api/auth/check should return 500 when fetch throws an exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network unreachable'));

    const request = new Request('http://localhost:3000/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: '771234567' }),
    });

    const response = await checkPost(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.message).toBe('Network unreachable');
  });

  test('/api/auth/check should return 500 with default message when error has no message', async () => {
    global.fetch = vi.fn().mockRejectedValue({});

    const request = new Request('http://localhost:3000/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await checkPost(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toBe('Internal Server Error');
  });

  // ─── /api/auth/verify ─────────────────────────────────────────────

  test('/api/auth/verify should forward bearer authorization header and code parameters', async () => {
    const mockJson = { message: 'Success' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockJson,
    });
    global.fetch = mockFetch;

    const request = new Request('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer verify-jwt-token',
      },
      body: JSON.stringify({ code: '11111', phone_number: '771234567' }),
    });

    const response = await verifyPost(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.message).toBe('Success');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://mini-pos-sync-server.vercel.app/api/v1/auth/verify',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer verify-jwt-token',
        },
        body: JSON.stringify({ code: '11111', phone_number: '771234567' }),
      })
    );
  });

  test('/api/auth/verify should forward error response when backend returns non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'OTP verification failed',
    });

    const request = new Request('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '99999', phone_number: '771234567' }),
    });

    const response = await verifyPost(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.message).toBe('OTP verification failed');
  });

  test('/api/auth/verify should work without Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'OK' }),
    });
    global.fetch = mockFetch;

    const request = new Request('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '11111' }),
    });

    const response = await verifyPost(request);
    expect(response.status).toBe(200);

    // Authorization header should NOT be forwarded when missing
    const calledHeaders = mockFetch.mock.calls[0][1].headers;
    expect(calledHeaders['Authorization']).toBeUndefined();
  });

  test('/api/auth/verify should return 500 when fetch throws an exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('DNS resolution failed'));

    const request = new Request('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '11111' }),
    });

    const response = await verifyPost(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.message).toBe('DNS resolution failed');
  });
});
