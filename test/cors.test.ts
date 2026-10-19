import { afterEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../src/db.js';
import { buildServer } from '../src/server.js';
import * as rpc from '../src/stellar/rpc.js';

describe('CORS configuration', () => {
  const originalCorsOrigins = process.env.CORS_ORIGINS;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalCorsOrigins;
    }
  });

  it('returns CORS headers for configured allowed origin', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:3001,http://localhost:3000';
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{}]);
    vi.spyOn(rpc, 'getLatestLedgerSequence').mockResolvedValue(1);
    const app = buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://localhost:3001',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');

    await app.close();
  });

  it('handles preflight OPTIONS requests with CORS headers', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:3001';
    const app = buildServer();

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3001',
        'access-control-request-method': 'GET',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');

    await app.close();
  });

  it('advertises PUT, PATCH, and DELETE for browser preflight requests', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:3001';
    const app = buildServer();

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3001',
        'access-control-request-method': 'PATCH',
      },
    });

    const methods = String(response.headers['access-control-allow-methods'])
      .split(',')
      .map((method) => method.trim().toUpperCase());
    expect(response.statusCode).toBe(204);
    expect(methods).toEqual(expect.arrayContaining(['PUT', 'PATCH', 'DELETE']));

    await app.close();
  });
});
