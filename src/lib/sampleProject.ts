/**
 * BLACKBOX built-in demo target: "shipyard-api"
 * A deliberately vulnerable Express + React bolt-on app.
 * Loading the sample lets you try every BLACKBOX pipeline instantly.
 */
export const SAMPLE_PROJECT_NAME = 'shipyard-api';

export const SAMPLE_FILES: { path: string; content: string }[] = [
  {
    path: 'package.json',
    content: `{
  "name": "shipyard-api",
  "version": "1.4.2",
  "description": "Shipyard ordering API + dashboard",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "seed": "node scripts/seed.js",
    "test": "jest"
  },
  "dependencies": {
    "axios": "^0.21.1",
    "cors": "^2.8.5",
    "dotenv": "^8.2.0",
    "express": "^4.17.1",
    "jsonwebtoken": "^8.5.1",
    "lodash": "^4.17.15",
    "mongoose": "^6.0.12"
  },
  "devDependencies": {
    "jest": "^27.4.5",
    "nodemon": "^2.0.15"
  }
}
`,
  },
  {
    path: '.env',
    content: `AWS_ACCESS_KEY_ID=AKIAQ7XK9M2JPL4TNBZR
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
DB_PASSWORD=Sup3rSecretPassw0rd!
JWT_SECRET=shipyard_super_secret_jwt_key_2024
PAYMENTS_API_KEY=pay_live_BLACKBOXsampleEXAMPLEnotreal0000000000
DATABASE_URL=mongodb://localhost:27017/shipyard
`,
  },
  {
    path: 'src/server.js',
    content: `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const crypto = require('crypto');
const mongoose = require('mongoose');

const app = express();

// TODO: rotate before launch
const JWT_SECRET = 'shipyard_super_secret_jwt_key_2024';
const adminPassword = 'hunter2-admin';

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/shipyard');

app.use('/api/users', require('./routes/users'));
app.use('/api/billing', require('./routes/billing'));

app.get('/api/status', (req, res) => {
  res.json({ ok: true, service: 'shipyard-api' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const hash = crypto.createHash('md5').update(password || '').digest('hex');
  const sql = "SELECT * FROM users WHERE name = '" + username + "' AND pass = '" + hash + "'";
  try {
    const rows = await global.db?.query(sql);
    if (!rows) return res.status(401).json({ error: 'nope' });
    const token = crypto.randomBytes(16).toString('hex');
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/orders', async (req, res) => {
  const orders = await mongoose.connection.db.collection('orders').find({}).toArray();
  res.json(orders);
});

app.post('/api/orders', async (req, res) => {
  const order = req.body;
  await mongoose.connection.db.collection('orders').insertOne(order);
  res.status(201).json(order);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('shipyard-api on :' + PORT));
`,
  },
  {
    path: 'src/routes/users.js',
    content: `const express = require('express');
const router = express.Router();

const users = [];

router.get('/api/users', (req, res) => {
  res.json(users);
});

router.post('/api/users', express.json(), (req, res) => {
  const payload = req.body?.payload;
  // "dynamic rules engine" — never do this
  const result = eval(payload);
  users.push({ id: Math.random().toString(36).slice(2), result });
  res.status(201).json({ ok: true });
});

router.delete('/api/users/:id', (req, res) => {
  res.json({ deleted: req.params.id });
});

module.exports = router;
`,
  },
  {
    path: 'src/routes/billing.js',
    content: `const express = require('express');
const axios = require('axios');
const router = express.Router();

const PAYMENTS_API_KEY = 'pay_live_BLACKBOXsampleEXAMPLEnotreal0000000000';
const GOOGLE_API_KEY = 'AIzaSyBBLACKBOXsampleKEYnotreal1234567890AB';

router.post('/api/billing/charge', async (req, res) => {
  const { amount, token } = req.body;
  try {
    const charge = await axios.post(
      'https://api.stripe.com/v1/charges',
      'amount=' + amount + '&currency=usd&source=' + token,
      { headers: { Authorization: 'Bearer ' + PAYMENTS_API_KEY } }
    );
    res.json(charge.data);
  } catch (err) {
    res.status(502).json({ error: 'stripe error' });
  }
});

router.get('/api/billing/google-places', async (req, res) => {
  const q = req.query.q;
  const places = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=' + GOOGLE_API_KEY + '&keyword=' + q);
  res.json(places.data);
});

module.exports = router;
`,
  },
  {
    path: 'src/db.js',
    content: `const mongoose = require('mongoose');

async function findOrderById(orderId) {
  const query = "SELECT * FROM orders WHERE id = '" + orderId + "'";
  return global.db.query(query);
}

async function connect() {
  return mongoose.connect('mongodb://localhost:27017/shipyard', {
    useNewUrlParser: true,
  });
}

module.exports = { findOrderById, connect };
`,
  },
  {
    path: 'src/middleware/auth.js',
    content: `const jwt = require('jsonwebtoken');

// middleware validates bearer tokens
module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer /, '');
  try {
    const payload = jwt.verify(token, 'shipyard_super_secret_jwt_key_2024');
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'bad token' });
  }
};
`,
  },
  {
    path: 'config/keys.js',
    content: `// legacy service credentials — do NOT commit
module.exports = {
  awsAccessKeyId: 'AKIAQ7XK9M2JPL4TNBZR',
  githubToken: 'ghp_5sBLACKBOXsampleTOKENnotreal1234567890abcd',
  sendgrid: 'SG.BLACKBOXsamplekeynotreal.1234567890abcdef',
  internalEndpoint: 'http://api.internal.shipyard.co:8080/legacy',
};
`,
  },
  {
    path: 'client/src/App.jsx',
    content: `import React, { useEffect, useState } from 'react';
import { marked } from 'marked';
import axios from 'axios';

export default function App() {
  const [orders, setOrders] = useState([]);
  const [bio, setBio] = useState('<b>loading…</b>');

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then(setOrders);

    fetch('/api/users', { method: 'GET' })
      .then((r) => r.json())
      .catch(() => {});

    axios
      .get('https://status.shipyard.example.com/ping')
      .then((r) => setBio(r.data))
      .catch(() => {});
  }, []);

  return (
    <div className="dashboard">
      <h1>Shipyard</h1>
      {/* rendered as raw HTML — XSS playground */}
      <div dangerouslySetInnerHTML={{ __html: marked(String(bio)) }} />
      <ul>{orders.map((o) => <li key={o.id}>{o.id}</li>)}</ul>
      <a href="https://status.shipyard.example.com" target="_blank">Status page</a>
    </div>
  );
}
`,
  },
  {
    path: 'client/src/api.js',
    content: `import axios from 'axios';

export const api = axios.create({ baseURL: 'http://localhost:4000' });

export async function fetchOrders() {
  const { data } = await api.get('/api/orders');
  return data;
}

export async function login(username, password) {
  const { data } = await api.post('/api/login', { username, password });
  return data;
}

export async function chargeCard(amount, token) {
  const { data } = await api.post('/api/billing/charge', { amount, token });
  return data;
}
`,
  },
  {
    path: 'scripts/seed.js',
    content: `const { exec } = require('child_process');
const fs = require('fs');

const backupPath = process.argv[2] || 'dump.tar';
console.log('seeding from', backupPath);

// restores a mongo dump — interpolates the path straight into a shell
exec('mongorestore --archive=' + backupPath, (err) => {
  if (err) {
    console.error('seed failed', err);
    process.exit(1);
  }
  console.log('done');
});

fs.writeFileSync('.seed-marker', new Date().toISOString());
`,
  },
  {
    path: 'tests/auth.test.js',
    content: `const request = require('supertest');

describe('login', () => {
  it('rejects bad credentials', async () => {
    expect(true).toBe(true);
  });
});
`,
  },
  {
    path: '.github/workflows/ci.yml',
    content: `name: ci
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm test
`,
  },
  {
    path: 'Dockerfile',
    content: `FROM node:12-bullseye
WORKDIR /app
COPY . .
RUN npm install --production
EXPOSE 4000
CMD ["node", "src/server.js"]
`,
  },
  {
    path: 'README.md',
    content: `# shipyard-api

Internal ordering API and React dashboard for the shipyard yard crews.

## Quickstart

\`\`\`bash
npm install
npm start
\`\`\`

## Notes

- MongoDB (or the bundled memory fallback) is required.
- Stripe billing lives under /api/billing.
- This service is legacy-first: it predates the security review.
`,
  },
  {
    path: '.gitignore',
    content: `node_modules
.seed-marker
`,
  },
];
