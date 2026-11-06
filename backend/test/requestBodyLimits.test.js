const assert = require('node:assert/strict');
const {after, before, test} = require('node:test');
const express = require('express');
const {applyJsonBodyParsers} = require('../middleware/requestBodyLimits');

let server;
let baseUrl;

before(async () => {
  const app = express();
  applyJsonBodyParsers(app);
  app.post('*', (_req, res) => res.json({success: true}));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({success: false}));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('public API rejects oversized JSON before route processing', async () => {
  const response = await fetch(`${baseUrl}/api/public/site-booking-availability`, {
    body: JSON.stringify({padding: 'x'.repeat(300 * 1024)}),
    headers: {'content-type': 'application/json'},
    method: 'POST',
  });

  assert.equal(response.status, 413);
});

test('auth API rejects oversized JSON before credential processing', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    body: JSON.stringify({email: 'owner@nuarr.pl', padding: 'x'.repeat(70 * 1024), password: 'invalid'}),
    headers: {'content-type': 'application/json'},
    method: 'POST',
  });

  assert.equal(response.status, 413);
});
