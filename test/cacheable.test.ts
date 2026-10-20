import { createHash } from 'node:crypto';

import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { sendPublicCacheable } from '../src/routes/cacheable.js';

/** The validator the helper is expected to produce for a given body. */
function expectedEtag(body: string): string {
  return `"${createHash('sha256').update(body).digest('base64url')}"`;
}

describe('public conditional responses', () => {
  it('returns an ETag and answers a matching If-None-Match with 304', async () => {
    const app = Fastify();
    app.get('/public', async (request, reply) =>
      sendPublicCacheable(request, reply, { value: 'current' }),
    );

    const firstResponse = await app.inject({ method: 'GET', url: '/public' });
    const etag = firstResponse.headers.etag;
    expect(etag).toBeDefined();
    expect(firstResponse.headers['cache-control']).toContain('public');

    const cachedResponse = await app.inject({
      method: 'GET',
      url: '/public',
      headers: { 'if-none-match': `W/${etag}` },
    });

    expect(cachedResponse.statusCode).toBe(304);
    expect(cachedResponse.body).toBe('');
    expect(cachedResponse.headers.etag).toBe(etag);

    await app.close();
  });

  it('hashes the exact bytes it sends, and sends them as JSON', async () => {
    const app = Fastify();
    const payload = { value: 'current', nested: { count: 3 }, list: [1, 2] };
    app.get('/public', async (request, reply) => sendPublicCacheable(request, reply, payload));

    const response = await app.inject({ method: 'GET', url: '/public' });

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers.etag).toBe(expectedEtag(response.body));
    expect(response.json()).toEqual(payload);

    await app.close();
  });

  it('serialises the payload once per response', async () => {
    const app = Fastify();
    let serialisations = 0;
    const payload = {
      value: 'current',
      toJSON() {
        serialisations += 1;
        return { value: this.value };
      },
    };

    app.get('/public', async (request, reply) => sendPublicCacheable(request, reply, payload));

    const response = await app.inject({ method: 'GET', url: '/public' });

    expect(response.statusCode).toBe(200);
    expect(serialisations).toBe(1);
    expect(response.headers.etag).toBe(expectedEtag(response.body));

    await app.close();
  });
});
