import { expect } from 'chai';
import request from 'supertest';

import { createApp } from '../src/app';
import { env } from '../src/config/env';

describe('CORS', () => {
  const app = createApp();

  it('allows the configured frontend origin with credentials', async () => {
    const res = await request(app).get('/health').set('Origin', env.corsOrigin);

    expect(res.headers['access-control-allow-origin']).to.equal(env.corsOrigin);
    expect(res.headers['access-control-allow-credentials']).to.equal('true');
  });

  it('reflects the configured origin on a preflight request', async () => {
    const res = await request(app)
      .options('/auth/login')
      .set('Origin', env.corsOrigin)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).to.be.oneOf([200, 204]);
    expect(res.headers['access-control-allow-origin']).to.equal(env.corsOrigin);
  });

  it('exposes Content-Disposition so the browser can read a download filename cross-origin', async () => {
    const res = await request(app).get('/health').set('Origin', env.corsOrigin);

    expect(res.headers['access-control-expose-headers']).to.include('Content-Disposition');
  });
});
