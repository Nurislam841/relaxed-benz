'use client';

import { io, Socket } from 'socket.io-client';

/**
 * socket.io client for the Kahoot namespace.
 *
 * Auth is handled by the access_token cookie which is automatically sent on
 * the WebSocket upgrade request because we use `withCredentials: true` and
 * Next.js proxies `/api` requests to the backend at the same origin.
 *
 * For dev across origins (frontend :3000, backend :4000) the cookie is set
 * by the login response on :3000 (proxied), so it works without CORS issues.
 *
 * We use a single shared connection per page mount — created lazily, torn
 * down on cleanup. Reconnects are disabled because the game flow doesn't
 * gracefully recover from drops; if a player drops, they're out for that
 * round and can rejoin via the join code.
 */
export function createKahootSocket(): Socket {
  // In dev, the backend runs on :4000. In prod, NEXT_PUBLIC_API_URL is set
  // to the same origin so we connect to the current host.
  // The /kahoot suffix matches `@WebSocketGateway({ namespace: '/kahoot' })`.
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') ?? 'http://localhost:4000';

  return io(`${base}/kahoot`, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: false,
  });
}
