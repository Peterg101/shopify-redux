// Polyfill TextEncoder/TextDecoder for Jest (jsdom lacks them)
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

import { connectSSE } from '../sseListener';

// Mock authApi so the module can import it
jest.mock('../authApi', () => ({
  authApi: {
    util: {
      invalidateTags: jest.fn((tags: string[]) => ({
        type: 'authApi/invalidateTags',
        payload: tags,
      })),
    },
  },
}));

const { authApi } = require('../authApi');

describe('sseListener — connectSSE', () => {
  const mockDispatch = jest.fn();
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    process.env.REACT_APP_API_URL = 'http://localhost:8000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createMockReadableStream(lines: string[]) {
    const encoder = new TextEncoder();
    const data = encoder.encode(lines.join('\n') + '\n');
    let consumed = false;

    return {
      getReader: () => ({
        read: async () => {
          if (!consumed) {
            consumed = true;
            return { done: false, value: data };
          }
          return { done: true, value: undefined };
        },
      }),
    };
  }

  it('fetches the /events endpoint with correct URL and options', async () => {
    const mockBody = createMockReadableStream([]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);

    // Let the async connect() run
    await new Promise((r) => setTimeout(r, 50));

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/events',
      expect.objectContaining({
        credentials: 'include',
        headers: { Accept: 'text/event-stream' },
      })
    );

    cleanup();
  });

  it('dispatches invalidateTags for basket:updated event', async () => {
    const sseData = JSON.stringify({ event: 'basket:updated' });
    const mockBody = createMockReadableStream([`data: ${sseData}`]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).toHaveBeenCalledWith(
      authApi.util.invalidateTags(['BasketItems'])
    );

    cleanup();
  });

  it('dispatches invalidateTags for order:created event', async () => {
    const sseData = JSON.stringify({ event: 'order:created' });
    const mockBody = createMockReadableStream([`data: ${sseData}`]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).toHaveBeenCalledWith(
      authApi.util.invalidateTags(['ClaimableOrders', 'UserOrders'])
    );

    cleanup();
  });

  it('dispatches invalidateTags for claim:status_changed event', async () => {
    const sseData = JSON.stringify({ event: 'claim:status_changed' });
    const mockBody = createMockReadableStream([`data: ${sseData}`]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).toHaveBeenCalledWith(
      authApi.util.invalidateTags(['UserClaims', 'UserOrders'])
    );

    cleanup();
  });

  it('dispatches invalidateTags for stripe:onboarded event', async () => {
    const sseData = JSON.stringify({ event: 'stripe:onboarded' });
    const mockBody = createMockReadableStream([`data: ${sseData}`]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).toHaveBeenCalledWith(
      authApi.util.invalidateTags(['sessionData'])
    );

    cleanup();
  });

  it('dispatches invalidateTags for task:completed event', async () => {
    const sseData = JSON.stringify({ event: 'task:completed' });
    const mockBody = createMockReadableStream([`data: ${sseData}`]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).toHaveBeenCalledWith(
      authApi.util.invalidateTags(['UserTasks', 'sessionData'])
    );

    cleanup();
  });

  it('dispatches invalidateTags for profile:updated event', async () => {
    const sseData = JSON.stringify({ event: 'profile:updated' });
    const mockBody = createMockReadableStream([`data: ${sseData}`]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).toHaveBeenCalledWith(
      authApi.util.invalidateTags(['sessionData'])
    );

    cleanup();
  });

  it('ignores unknown event types without dispatching', async () => {
    const sseData = JSON.stringify({ event: 'unknown:event' });
    const mockBody = createMockReadableStream([`data: ${sseData}`]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).not.toHaveBeenCalled();

    cleanup();
  });

  it('ignores malformed JSON in SSE data lines', async () => {
    const mockBody = createMockReadableStream(['data: not-valid-json']);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).not.toHaveBeenCalled();

    cleanup();
  });

  it('does not dispatch when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      body: null,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).not.toHaveBeenCalled();

    cleanup();
  });

  it('returns a cleanup function that aborts the connection', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves
    const cleanup = connectSSE(mockDispatch);

    expect(typeof cleanup).toBe('function');
    // Should not throw
    cleanup();
  });

  it('handles multiple events in a single stream chunk', async () => {
    const event1 = JSON.stringify({ event: 'basket:updated' });
    const event2 = JSON.stringify({ event: 'order:created' });
    const mockBody = createMockReadableStream([
      `data: ${event1}`,
      `data: ${event2}`,
    ]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const cleanup = connectSSE(mockDispatch);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockDispatch).toHaveBeenCalledTimes(2);

    cleanup();
  });
});
