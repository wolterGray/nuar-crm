const express = require('express');

const AUTH_JSON_LIMIT = '64kb';
const PUBLIC_JSON_LIMIT = '256kb';
const PRIVATE_JSON_LIMIT = '15mb';

const applyJsonBodyParsers = (app) => {
  app.use('/api/auth', express.json({limit: AUTH_JSON_LIMIT}));
  app.use('/api/public', express.json({limit: PUBLIC_JSON_LIMIT}));
  app.use(express.json({limit: PRIVATE_JSON_LIMIT}));
};

module.exports = {
  applyJsonBodyParsers,
  AUTH_JSON_LIMIT,
  PRIVATE_JSON_LIMIT,
  PUBLIC_JSON_LIMIT,
};
