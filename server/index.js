require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '15mb' }));

// Allow browser connections to Supabase and other external services
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sandbox.safaricom.co.ke https://api.safaricom.co.ke",
      "img-src 'self' data: blob: https://*.supabase.co https://supabase.co",
      "font-src 'self' data: https://fonts.gstatic.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "frame-ancestors 'self' https://*.replit.dev https://*.replit.app https://*.repl.co",
    ].join('; ')
  );
  res.removeHeader('X-Content-Type-Options');
  next();
});

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = IS_PRODUCTION ? (process.env.PORT || 5000) : 5000;
const EXPO_PORT = 19006;

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const DARAJA_BASE_URL = process.env.MPESA_ENVIRONMENT === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || '';

// Derive project URL from the anon key (which is confirmed correct) so
// account-level linked secrets cannot override it with a wrong project URL.
function getProjectRef(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString()).ref;
  } catch (_) { return null; }
}

const _anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const _projectRef = getProjectRef(_anonKey);
const SUPABASE_URL = _projectRef
  ? `https://${_projectRef}.supabase.co`
  : (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '');

// Scan ALL environment variables to find a service_role key matching our project.
// This avoids relying on a specific secret name in case of account-level overrides.
function findServiceKey(projectRef) {
  const candidates = Object.values(process.env).filter(v => v && v.startsWith('eyJ'));
  for (const key of candidates) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString());
      if (payload.ref === projectRef && payload.role === 'service_role') return key;
    } catch (_) {}
  }
  return '';
}

const SUPABASE_SERVICE_KEY = findServiceKey(_projectRef);

let tokenCache = { token: null, expiresAt: 0 };

async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const response = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.data || !response.data.id) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = response.data;
    req.userId = response.data.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });

  tokenCache = {
    token: response.data.access_token,
    expiresAt: Date.now() + (response.data.expires_in * 1000) - 60000
  };

  return tokenCache.token;
}

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function generatePassword(timestamp) {
  return Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');
}

async function supabaseQuery(path, method = 'GET', body = null) {
  const config = {
    method,
    url: `${SUPABASE_URL}/rest/v1/${path}`,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
    }
  };
  if (body) config.data = body;
  const response = await axios(config);
  return response.data;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Temp: check which tables exist in Supabase
app.get('/api/check-tables', async (req, res) => {
  const tables = ['cart','cart_items','orders','order_items','wishlist','products','profiles','wallets','wallet_transactions','payments','countries','districts','account_type_limits'];
  const results = {};
  await Promise.all(tables.map(async (t) => {
    try {
      const r = await axios.get(`${SUPABASE_URL}/rest/v1/${t}?limit=1`, {
        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
      });
      results[t] = 'EXISTS';
    } catch (e) {
      results[t] = e.response?.status === 404 ? 'MISSING' : `ERR:${e.response?.status} ${e.response?.data?.message || e.message}`;
    }
  }));
  res.json(results);
});

// Dev-only: create test accounts via server (bypasses browser CORS restriction on admin API)
app.post('/api/setup-test-accounts', async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server Supabase credentials not configured' });
  }

  const accounts = [
    { email: 'admin@store.com',      password: 'admin2026', username: 'admin',      full_name: 'Admin User',  role: 'admin',      account_type: 'premium' },
    { email: 'superadmin@store.com', password: 'super2026', username: 'superadmin', full_name: 'Super Admin', role: 'superadmin', account_type: 'premium' },
    { email: 'user@store.com',       password: 'user2026',  username: 'testuser',   full_name: 'Test User',   role: 'user',       account_type: 'basic'   },
  ];

  const results = [];

  for (const acc of accounts) {
    try {
      let userId = null;

      // Try to create the auth user
      try {
        const createRes = await axios.post(
          `${SUPABASE_URL}/auth/v1/admin/users`,
          { email: acc.email, password: acc.password, email_confirm: true },
          { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' } }
        );
        userId = createRes.data?.id;
        console.log(`Created auth user: ${acc.email} (${userId})`);
      } catch (createErr) {
        const msg = createErr.response?.data?.message || createErr.message || '';
        if (msg.toLowerCase().includes('already') || createErr.response?.status === 422) {
          // User exists — find their ID
          const listRes = await axios.get(
            `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(acc.email)}`,
            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
          );
          const users = listRes.data?.users || listRes.data || [];
          const found = Array.isArray(users) ? users.find(u => u.email === acc.email) : null;
          if (found) { userId = found.id; console.log(`Existing user found: ${acc.email} (${userId})`); }
        } else {
          results.push({ email: acc.email, ok: false, message: msg });
          continue;
        }
      }

      if (!userId) {
        results.push({ email: acc.email, ok: false, message: 'Could not resolve user ID' });
        continue;
      }

      // Upsert profile
      await axios.post(
        `${SUPABASE_URL}/rest/v1/profiles`,
        { id: userId, username: acc.username, full_name: acc.full_name, role: acc.role, is_active: true, account_type: acc.account_type },
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          }
        }
      );

      console.log(`Profile upserted: ${acc.email} role=${acc.role}`);
      results.push({ email: acc.email, ok: true, role: acc.role, account_type: acc.account_type });
    } catch (err) {
      console.error(`Error for ${acc.email}:`, err.response?.data || err.message);
      results.push({ email: acc.email, ok: false, message: err.response?.data?.message || err.message });
    }
  }

  res.json({ results });
});

app.post('/api/mpesa/stk-push', authenticateUser, async (req, res) => {
  try {
    const { phone, amount, orderId, type } = req.body;
    const userId = req.userId;

    if (!phone || !amount) {
      return res.status(400).json({ error: 'Phone and amount are required' });
    }

    let formattedPhone = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
    if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);

    const accountRef = type === 'deposit' ? 'WALLET-DEP' : `ORD-${orderId || 'NEW'}`;

    const paymentRecord = await supabaseQuery('payments', 'POST', {
      user_id: userId,
      order_id: orderId || null,
      method: 'mpesa',
      amount: amount,
      currency: 'KES',
      status: 'initiated',
      phone: formattedPhone
    });

    const paymentId = paymentRecord[0]?.id;

    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
      console.log('M-Pesa credentials not configured - simulating STK push');
      
      if (paymentId) {
        await supabaseQuery(`payments?id=eq.${paymentId}`, 'PATCH', {
          status: 'pending',
          mpesa_checkout_id: `SIM_${Date.now()}`,
          updated_at: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        message: 'STK Push sent to your phone. Enter your M-Pesa PIN to complete.',
        paymentId,
        checkoutRequestId: `SIM_${Date.now()}`,
        simulated: true
      });
    }

    const token = await getAccessToken();

    const stkResponse = await axios.post(
      `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBuyGoodsOnline',
        Amount: Math.ceil(amount),
        PartyA: formattedPhone,
        PartyB: SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: CALLBACK_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost'}:${PORT}/api/mpesa/callback`,
        AccountReference: accountRef,
        TransactionDesc: type === 'deposit' ? 'Wallet Deposit' : `Payment for Order ${orderId}`
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (stkResponse.data.ResponseCode === '0') {
      if (paymentId) {
        await supabaseQuery(`payments?id=eq.${paymentId}`, 'PATCH', {
          status: 'pending',
          mpesa_checkout_id: stkResponse.data.CheckoutRequestID,
          updated_at: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        message: 'STK Push sent to your phone. Enter your M-Pesa PIN to complete.',
        paymentId,
        checkoutRequestId: stkResponse.data.CheckoutRequestID
      });
    } else {
      if (paymentId) {
        await supabaseQuery(`payments?id=eq.${paymentId}`, 'PATCH', {
          status: 'failed',
          updated_at: new Date().toISOString()
        });
      }
      return res.status(400).json({ error: 'STK Push failed', details: stkResponse.data });
    }
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to initiate payment', details: error.message });
  }
});

app.post('/api/mpesa/callback', async (req, res) => {
  try {
    console.log('M-Pesa Callback received:', JSON.stringify(req.body));

    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;

    const payments = await supabaseQuery(`payments?mpesa_checkout_id=eq.${CheckoutRequestID}&select=*`);
    const payment = payments[0];

    if (!payment) {
      console.error('Payment not found for checkout:', CheckoutRequestID);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (ResultCode === 0) {
      let mpesaReceipt = '';
      let transactionDate = '';

      if (CallbackMetadata?.Item) {
        for (const item of CallbackMetadata.Item) {
          if (item.Name === 'MpesaReceiptNumber') mpesaReceipt = item.Value;
          if (item.Name === 'TransactionDate') transactionDate = String(item.Value);
        }
      }

      await supabaseQuery(`payments?id=eq.${payment.id}`, 'PATCH', {
        status: 'paid',
        mpesa_receipt: mpesaReceipt,
        callback_payload: req.body,
        updated_at: new Date().toISOString()
      });

      const isDeposit = !payment.order_id;

      if (isDeposit) {
        const wallets = await supabaseQuery(`wallets?user_id=eq.${payment.user_id}&select=*`);
        let wallet = wallets[0];

        if (!wallet) {
          const newWallets = await supabaseQuery('wallets', 'POST', {
            user_id: payment.user_id,
            balance: 0,
            currency: 'KES'
          });
          wallet = newWallets[0];
        }

        const newBalance = parseFloat(wallet.balance) + parseFloat(payment.amount);
        await supabaseQuery(`wallets?id=eq.${wallet.id}`, 'PATCH', {
          balance: newBalance,
          updated_at: new Date().toISOString()
        });

        await supabaseQuery('wallet_transactions', 'POST', {
          wallet_id: wallet.id,
          user_id: payment.user_id,
          type: 'deposit',
          amount: payment.amount,
          source: 'mpesa',
          reference: mpesaReceipt || String(payment.id),
          description: 'M-Pesa wallet deposit',
          status: 'posted',
          metadata: { payment_id: payment.id, mpesa_receipt: mpesaReceipt }
        });
      } else {
        await supabaseQuery(`orders?id=eq.${payment.order_id}`, 'PATCH', {
          payment_status: 'paid',
          payment_method: 'mpesa',
          payment_id: payment.id,
          status: 'confirmed'
        });
      }
    } else {
      await supabaseQuery(`payments?id=eq.${payment.id}`, 'PATCH', {
        status: 'failed',
        callback_payload: req.body,
        updated_at: new Date().toISOString()
      });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Callback processing error:', error.message);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

app.post('/api/mpesa/simulate-callback', authenticateUser, async (req, res) => {
  try {
    const { paymentId, success } = req.body;

    const payments = await supabaseQuery(`payments?id=eq.${paymentId}&select=*`);
    const payment = payments[0];

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (success !== false) {
      const receipt = `SIM${Date.now()}`;

      await supabaseQuery(`payments?id=eq.${payment.id}`, 'PATCH', {
        status: 'paid',
        mpesa_receipt: receipt,
        updated_at: new Date().toISOString()
      });

      const isDeposit = !payment.order_id;

      if (isDeposit) {
        const wallets = await supabaseQuery(`wallets?user_id=eq.${payment.user_id}&select=*`);
        let wallet = wallets[0];

        if (!wallet) {
          const newWallets = await supabaseQuery('wallets', 'POST', {
            user_id: payment.user_id,
            balance: 0,
            currency: 'KES'
          });
          wallet = newWallets[0];
        }

        const newBalance = parseFloat(wallet.balance) + parseFloat(payment.amount);
        await supabaseQuery(`wallets?id=eq.${wallet.id}`, 'PATCH', {
          balance: newBalance,
          updated_at: new Date().toISOString()
        });

        await supabaseQuery('wallet_transactions', 'POST', {
          wallet_id: wallet.id,
          user_id: payment.user_id,
          type: 'deposit',
          amount: payment.amount,
          source: 'mpesa',
          reference: receipt,
          description: 'M-Pesa wallet deposit (simulated)',
          status: 'posted',
          metadata: { payment_id: payment.id, simulated: true }
        });
      } else {
        await supabaseQuery(`orders?id=eq.${payment.order_id}`, 'PATCH', {
          payment_status: 'paid',
          payment_method: 'mpesa',
          payment_id: payment.id,
          status: 'confirmed'
        });
      }

      return res.json({ success: true, receipt });
    } else {
      await supabaseQuery(`payments?id=eq.${payment.id}`, 'PATCH', {
        status: 'failed',
        updated_at: new Date().toISOString()
      });
      return res.json({ success: false });
    }
  } catch (error) {
    console.error('Simulate callback error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payments/:id/status', authenticateUser, async (req, res) => {
  try {
    const payments = await supabaseQuery(`payments?id=eq.${req.params.id}&select=*`);
    const payment = payments[0];

    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    res.json({
      id: payment.id,
      status: payment.status,
      mpesaReceipt: payment.mpesa_receipt,
      method: payment.method,
      amount: payment.amount,
      createdAt: payment.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/wallet/:userId', authenticateUser, async (req, res) => {
  try {
    const wallets = await supabaseQuery(`wallets?user_id=eq.${req.params.userId}&select=*`);
    let wallet = wallets[0];

    if (!wallet) {
      const newWallets = await supabaseQuery('wallets', 'POST', {
        user_id: req.params.userId,
        balance: 0,
        currency: 'KES'
      });
      wallet = newWallets[0];
    }

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/wallet/:userId/transactions', authenticateUser, async (req, res) => {
  try {
    const wallets = await supabaseQuery(`wallets?user_id=eq.${req.params.userId}&select=id`);
    const wallet = wallets[0];

    if (!wallet) return res.json([]);

    const transactions = await supabaseQuery(
      `wallet_transactions?wallet_id=eq.${wallet.id}&select=*&order=created_at.desc&limit=50`
    );

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wallet/pay', authenticateUser, async (req, res) => {
  try {
    const { orderId, amount, discount } = req.body;
    const userId = req.userId;

    if (!orderId || !amount) {
      return res.status(400).json({ error: 'orderId and amount are required' });
    }

    const wallets = await supabaseQuery(`wallets?user_id=eq.${userId}&select=*`);
    const wallet = wallets[0];

    if (!wallet) return res.status(400).json({ error: 'Wallet not found. Please create a wallet first.' });
    if (wallet.status !== 'active') return res.status(400).json({ error: 'Wallet is not active' });

    const discountAmount = discount || 0;
    const finalAmount = amount - discountAmount;

    if (parseFloat(wallet.balance) < finalAmount) {
      return res.status(400).json({
        error: 'Insufficient wallet balance',
        balance: wallet.balance,
        required: finalAmount
      });
    }

    const newBalance = parseFloat(wallet.balance) - finalAmount;
    await supabaseQuery(`wallets?id=eq.${wallet.id}`, 'PATCH', {
      balance: newBalance,
      updated_at: new Date().toISOString()
    });

    const paymentRecord = await supabaseQuery('payments', 'POST', {
      user_id: userId,
      order_id: orderId,
      method: 'wallet',
      amount: amount,
      wallet_amount: finalAmount,
      discount_applied: discountAmount,
      currency: 'KES',
      status: 'paid',
      price_locked_at: new Date().toISOString()
    });

    await supabaseQuery('wallet_transactions', 'POST', {
      wallet_id: wallet.id,
      user_id: userId,
      type: 'debit',
      amount: finalAmount,
      source: 'order',
      reference: String(orderId),
      description: `Payment for Order #${orderId}`,
      status: 'posted',
      metadata: { order_id: orderId, discount: discountAmount, original_amount: amount }
    });

    if (discountAmount > 0) {
      await supabaseQuery('wallet_transactions', 'POST', {
        wallet_id: wallet.id,
        user_id: userId,
        type: 'discount',
        amount: discountAmount,
        source: 'system',
        reference: String(orderId),
        description: `Wallet payment discount for Order #${orderId}`,
        status: 'posted',
        metadata: { order_id: orderId }
      });
    }

    await supabaseQuery(`orders?id=eq.${orderId}`, 'PATCH', {
      payment_status: 'paid',
      payment_method: 'wallet',
      payment_id: paymentRecord[0]?.id,
      status: 'confirmed'
    });

    res.json({
      success: true,
      newBalance,
      paymentId: paymentRecord[0]?.id,
      discountApplied: discountAmount
    });
  } catch (error) {
    console.error('Wallet payment error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── AI: analyze a product image and infer fields ─────────────────────────
const PRODUCT_CATEGORIES = [
  'Art','Beauty','Books','Children','Clothing','Electronics','Fashion','Food',
  'Furniture','Handicrafts','Home','Kitchen','Sports','Toys','Other'
];

let _openaiClient = null;
function getOpenAI() {
  if (!_openaiClient) {
    const OpenAI = require('openai');
    // Uses Replit AI Integrations (no user API key needed; billed to credits)
    _openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openaiClient;
}

// ─── Admin role gate ────────────────────────────────────────────────────────
// Looks up the authenticated user's profile and rejects non-admins.
async function requireAdmin(req, res, next) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
    const r = await axios.get(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${req.userId}&select=role`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const role = (r.data?.[0]?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.userRole = role;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify admin role' });
  }
}

// ─── Quality / safety scanner ───────────────────────────────────────────────
const qualityCheck = require('./quality-check');
let qualitySchemaReady = false;

async function probeQualitySchema() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return false;
  try {
    await axios.get(`${SUPABASE_URL}/rest/v1/products?select=quality_flag&limit=1`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      timeout: 4000,
    });
    qualitySchemaReady = true;
    return true;
  } catch (err) {
    qualitySchemaReady = false;
    const msg = err.response?.data?.message || err.message || '';
    console.warn(
      '\n[quality] ⚠️  products.quality_flag column not found.\n' +
      '[quality]    Run migrations/2026_05_12_add_quality_flags.sql in the Supabase\n' +
      '[quality]    SQL editor to enable the daily quality & safety scanner.\n' +
      `[quality]    Error: ${msg}\n`
    );
    return false;
  }
}

// Manual trigger (admin only). Lets ops run the scan on demand.
app.post('/api/admin/quality-scan', authenticateUser, requireAdmin, async (req, res) => {
  if (!qualitySchemaReady) {
    const ready = await probeQualitySchema();
    if (!ready) return res.status(503).json({ error: 'Quality schema not migrated. See server logs.' });
  }
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return res.status(503).json({ error: 'AI service not configured' });
  }
  const limit = Math.max(1, Math.min(100, parseInt(req.body?.limit, 10) || 25));
  try {
    const result = await qualityCheck.runDailyQualityScan({
      supabaseUrl: SUPABASE_URL,
      supabaseServiceKey: SUPABASE_SERVICE_KEY,
      openai: getOpenAI(),
    }, { limit });
    res.json(result);
  } catch (err) {
    console.error('[quality] manual scan failed:', err);
    res.status(500).json({ error: err.message || 'Scan failed' });
  }
});

// Schedule the daily scan once the server starts (production only — avoids
// burning OpenAI credits while developing).
if (IS_PRODUCTION) {
  probeQualitySchema().then((ready) => {
    if (ready && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      qualityCheck.scheduleDailyScan({
        supabaseUrl: SUPABASE_URL,
        supabaseServiceKey: SUPABASE_SERVICE_KEY,
        openai: getOpenAI(),
      });
    }
  });
}

app.post('/api/ai/analyze-image', authenticateUser, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });
    if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;
    const client = getOpenAI();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an e-commerce product cataloger for an East African online marketplace ' +
            '(Kenya, Uganda, Ethiopia, Rwanda, South Sudan). Look at the product image and ' +
            'produce a clean listing in JSON with these exact keys: ' +
            'title (string, max 60 chars, descriptive but concise), ' +
            'description (string, 2-4 sentences highlighting features, materials, use), ' +
            'category (must be one of: ' + PRODUCT_CATEGORIES.join(', ') + '), ' +
            'price_usd (number, a reasonable retail price in US dollars based on the item), ' +
            'available_quantity (integer between 1 and 20), ' +
            'confidence (number 0..1 estimating how confident you are about the product). ' +
            'If the image is not a sellable product, set title="" and confidence < 0.3. ' +
            'Return ONLY valid JSON, no extra text.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this product and produce the JSON.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    // Sanitize
    const safeCategory = PRODUCT_CATEGORIES.includes(parsed.category) ? parsed.category : 'Other';
    res.json({
      title: String(parsed.title || '').slice(0, 80),
      description: String(parsed.description || '').slice(0, 600),
      category: safeCategory,
      price_usd: Number(parsed.price_usd) > 0 ? Number(parsed.price_usd) : 0,
      available_quantity: Math.max(1, Math.min(20, parseInt(parsed.available_quantity, 10) || 1)),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    });
  } catch (err) {
    console.error('analyze-image failed:', err.message);
    res.status(500).json({ error: err.message || 'AI analysis failed' });
  }
});

// ─── AI: optimize a product listing for East Africa SEO ──────────────────
// Runs on every product save (Add / Edit / Bulk) to align listings with
// 2026 Kenya & East Africa search trends: M-Pesa, fast delivery, refurbished
// electronics, TikTok-shop language, Jumia-alternative positioning, etc.
const EA_SEO_BRIEF = `
Top 2026 Kenya / East Africa e-commerce search themes to weave in NATURALLY when relevant:
- High-demand categories: smartphones (iPhone, Samsung), refurbished phones,
  laptops for students, smart lighting, solar products, air fryers, coffee
  makers, electric warming trays, beauty & perfumes, trending fashion & shoes.
- Buyer language: "best price", "fast delivery", "same-day delivery",
  "M-Pesa accepted", "pay on delivery", "original", "brand new", "refurbished".
- Geography to mention if it fits: Nairobi, Mombasa, Kisumu, Kampala, Kigali,
  Addis Ababa, Juba, plus the specific county/district provided.
- Brand positioning: trusted East Africa marketplace, Jumia / Kilimall / Jiji
  alternative, M-Pesa secure checkout.
- Keep it truthful — do NOT invent specs, brands, or features the seller did
  not state. Only enrich phrasing and add geo / payment / delivery cues.
`.trim();

app.post('/api/ai/optimize-listing', authenticateUser, async (req, res) => {
  try {
    const { title, description, category, country, county } = req.body || {};
    if (!title && !description) {
      return res.status(400).json({ error: 'title or description required' });
    }
    if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      // Graceful fallback — return originals so save flow never breaks
      return res.json({
        title: String(title || '').slice(0, 80),
        description: String(description || '').slice(0, 600),
        keywords: [],
        optimized: false,
      });
    }

    const client = getOpenAI();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an SEO copywriter for East Africa Online, a marketplace ' +
            'serving Kenya, Uganda, Ethiopia, Rwanda and South Sudan. Rewrite ' +
            'product listings to maximise organic search visibility on Google ' +
            'while staying 100% truthful to what the seller wrote. ' +
            'Return ONLY JSON with keys: title (<=70 chars, keyword-rich, ' +
            'no ALL CAPS, no emoji spam), description (120-320 words, ' +
            '2-4 short paragraphs, includes payment + delivery + location ' +
            'cues where natural, ends with a soft call-to-action), ' +
            'keywords (array of 6-12 lowercase search phrases buyers would ' +
            'actually type). Never invent specs, brand names, warranties, ' +
            'or features the seller did not provide.\n\n' + EA_SEO_BRIEF,
        },
        {
          role: 'user',
          content:
            `Original title: ${title || ''}\n` +
            `Original description: ${description || ''}\n` +
            `Category: ${category || 'Other'}\n` +
            `Country: ${country || ''}\n` +
            `City / district: ${county || ''}\n\n` +
            'Rewrite for SEO. Return JSON only.',
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 700,
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const outTitle = String(parsed.title || title || '').slice(0, 80).trim();
    const outDesc  = String(parsed.description || description || '').slice(0, 1500).trim();
    const outKeywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.map(k => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 12)
      : [];

    res.json({
      title: outTitle || String(title || ''),
      description: outDesc || String(description || ''),
      keywords: outKeywords,
      optimized: true,
    });
  } catch (err) {
    console.error('optimize-listing failed:', err.message);
    // Never block a save — return originals on failure
    res.json({
      title: String(req.body?.title || '').slice(0, 80),
      description: String(req.body?.description || '').slice(0, 1500),
      keywords: [],
      optimized: false,
      error: err.message,
    });
  }
});

// ─── Asha v1: structured shopping search ────────────────────────────────
// The model interprets language only. It never writes SQL or executes tools.
// All database filters are validated against this allowlist and assembled
// server-side into parameterised PostgREST requests.
const ASHA_ALLOWED_ATTRIBUTES = new Set([
  'color', 'size', 'brand', 'model', 'storage', 'condition', 'gender', 'material'
]);
const ASHA_COUNTRIES = {
  kenya: 'KE', uganda: 'UG', tanzania: 'TZ', ethiopia: 'ET',
  rwanda: 'RW', 'south sudan': 'SS', sudan: 'SD'
};

function parseAshaJson(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed;
}

function deterministicAshaIntent(message) {
  const text = String(message || '').trim().slice(0, 500);
  const lower = text.toLowerCase();
  const out = { intent: 'search', query: '', attributes: {}, limit: 4, sort: 'newest' };
  if (/\b(trending|popular|what'?s hot|best sellers)\b/.test(lower)) out.intent = 'trending';
  if (/\b(new arrivals|newly listed|latest products)\b/.test(lower)) out.intent = 'new';
  const max = lower.match(/\b(?:under|below|less than|up to|max(?:imum)?)\s*(?:ksh|kes|ugx|tzs|usd|ssp)?\s*([\d,]+)/i);
  const min = lower.match(/\b(?:above|over|more than|from)\s*(?:ksh|kes|ugx|tzs|usd|ssp)?\s*([\d,]+)/i);
  if (max) out.max_price = Number(max[1].replace(/,/g, ''));
  if (min) out.min_price = Number(min[1].replace(/,/g, ''));
  const size = lower.match(/\bsize\s*(?:no\.?\s*)?([a-z0-9.]+)/i);
  if (size) out.attributes.size = size[1];
  const colors = ['white','black','red','blue','green','yellow','brown','pink','grey','gray'];
  const color = colors.find(c => new RegExp('\\b' + c + '\\b','i').test(lower));
  if (color) out.attributes.color = color;
  const condition = lower.match(/\b(new|used|refurbished|second hand)\b/);
  if (condition) out.attributes.condition = condition[1] === 'second hand' ? 'used' : condition[1];
  for (const [name, code] of Object.entries(ASHA_COUNTRIES)) {
    if (new RegExp('\\\\b' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\\\b','i').test(lower)) {
      out.country_code = code;
      break;
    }
  }
  const location = lower.match(/\bin\s+([a-z][a-z .'-]{1,35})(?:\s*,|\s+under\b|\s+below\b|\s+for\b|$)/i);
  if (location) {
    const place = location[1].trim();
    if (!ASHA_COUNTRIES[place]) out.county = place;
  }
  // Remove common instruction words and extracted constraints, retaining
  // the shopper's product phrase for a simple catalogue text search.
  let query = lower
    .replace(/\b(show me|find me|find|looking for|i need|i want|do you have|any|please|buy|search for)\b/g, ' ')
    .replace(/\b(?:under|below|less than|up to|max(?:imum)?)\s*(?:ksh|kes|ugx|tzs|usd|ssp)?\s*[\d,]+/g, ' ')
    .replace(/\b(?:above|over|more than|from)\s*(?:ksh|kes|ugx|tzs|usd|ssp)?\s*[\d,]+/g, ' ')
    .replace(/\bsize\s*(?:no\.?\s*)?[a-z0-9.]+/g, ' ')
    .replace(/\b(?:white|black|red|blue|green|yellow|brown|pink|grey|gray|new|used|refurbished|second hand)\b/g, ' ')
    .replace(/\b(?:in|from)\s+(kenya|uganda|tanzania|ethiopia|rwanda|south sudan|sudan)\b/g, ' ')
    .replace(/\b(?:under|below|less than|up to|above|over|more than|in|from)\b/g, ' ')
    .replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
  out.query = query.slice(0, 100);
  return out;
}

async function interpretAshaMessage(message) {
  const fallback = deterministicAshaIntent(message);
  // Rule-based parsing handles common requests without spending model tokens.
  if (fallback.query && (fallback.max_price || fallback.min_price ||
      Object.keys(fallback.attributes).length || fallback.country_code || fallback.county)) return fallback;
  const prompt = [
    'Convert the shopper message into one compact JSON object.',
    'Allowed keys: intent(search|trending|new|clarify), query, category, country_code, county, min_price, max_price, attributes, sort, limit.',
    'Allowed attributes keys: color,size,brand,model,storage,condition,gender,material.',
    'Never return SQL, code, explanations, or extra keys. Use null/omit unknown values.',
    'Currencies are numeric only; preserve the shopper requested amount.',
    'Return JSON only. Shopper message: ' + String(message || '').slice(0, 500)
  ].join(' ');
  if (process.env.GROQ_API_KEY) {
    try {
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 180,
        response_format: { type: 'json_object' }
      }, { headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY }, timeout: 12000 });
      const parsed = parseAshaJson(response.data?.choices?.[0]?.message?.content);
      if (parsed) return validateAshaIntent(parsed, fallback);
    } catch (err) { console.warn('Asha Groq interpreter unavailable:', err.response?.status || err.message); }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(process.env.GEMINI_API_KEY),
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 180, responseMimeType: 'application/json' } },
        { timeout: 12000 }
      );
      const parsed = parseAshaJson(response.data?.candidates?.[0]?.content?.parts?.[0]?.text);
      if (parsed) return validateAshaIntent(parsed, fallback);
    } catch (err) { console.warn('Asha Gemini interpreter unavailable:', err.response?.status || err.message); }
  }
  return fallback;
}

function validateAshaIntent(input, fallback) {
  const allowedIntents = new Set(['search','trending','new','clarify']);
  const out = {
    intent: allowedIntents.has(input.intent) ? input.intent : fallback.intent,
    query: typeof input.query === 'string' ? input.query.trim().slice(0, 100) : fallback.query,
    attributes: {}, limit: Math.max(1, Math.min(6, Number(input.limit) || 4)),
    sort: input.sort === 'price_asc' ? 'price_asc' : 'newest'
  };
  if (typeof input.category === 'string') out.category = input.category.slice(0, 80);
  if (typeof input.country_code === 'string' && /^[A-Z]{2}$/i.test(input.country_code)) out.country_code = input.country_code.toUpperCase();
  if (typeof input.county === 'string') out.county = input.county.slice(0, 80);
  for (const key of ['min_price','max_price']) {
    const n = Number(input[key]);
    if (Number.isFinite(n) && n >= 0 && n <= 100000000000) out[key] = n;
  }
  if (input.attributes && typeof input.attributes === 'object' && !Array.isArray(input.attributes)) {
    for (const [key, value] of Object.entries(input.attributes)) {
      if (ASHA_ALLOWED_ATTRIBUTES.has(key) && ['string','number'].includes(typeof value)) {
        out.attributes[key] = String(value).slice(0, 60);
      }
    }
  }
  return out;
}

async function searchAshaProducts(filters) {
  const params = new URLSearchParams();
  params.set('product_status', 'eq.published');
  params.set('select', 'id,title,price,category,county,country_id,attributes,countries(id,code,currency,name),product_images(storage_path,is_main)');
  params.set('limit', String(filters.limit || 4));
  params.set('order', filters.sort === 'price_asc' ? 'price.asc' : 'created_at.desc');
  const conditions = [];
  if (filters.min_price !== undefined) conditions.push('price.gte.' + filters.min_price);
  if (filters.max_price !== undefined) conditions.push('price.lte.' + filters.max_price);
  if (filters.county) conditions.push('county.ilike.*' + filters.county.replace(/[*%,]/g, '') + '*');
  if (filters.category) conditions.push('category.ilike.*' + filters.category.replace(/[*%,]/g, '') + '*');
  const countryId = await getCountryIdByCode(filters.country_code);
  if (countryId) params.set('country_id', 'eq.' + countryId);
  if (filters.intent === 'new') params.set('created_at', 'gte.' + new Date(Date.now() - 7 * 86400000).toISOString());
  const query = String(filters.query || '').trim().replace(/[*%,]/g, ' ').slice(0, 80);
  if (query) {
    const terms = query.split(/\\s+/).filter(Boolean).slice(0, 5);
    conditions.push(...terms.map(term => 'or(title.ilike.*' + term + '*,description.ilike.*' + term + '*,category.ilike.*' + term + '*)'));
  }
  for (const [key, value] of Object.entries(filters.attributes || {})) {
    if (ASHA_ALLOWED_ATTRIBUTES.has(key)) conditions.push('attributes->>' + key + '.ilike.*' + String(value).replace(/[*%,]/g, '') + '*');
  }
  if (conditions.length) params.set('and', '(' + conditions.join(',') + ')');
  const rows = await supabaseQuery('products?' + params.toString());
  return Array.isArray(rows) ? rows : [];
}

app.post('/api/ai/assistant', authenticateUser, async (req, res) => {
  try {
    const { messages = [], message, country_code } = req.body || {};
    const latest = String(message || (Array.isArray(messages) ? [...messages].reverse().find(m => m?.role === 'user')?.content : '') || '').trim();
    if (!latest) return res.status(400).json({ error: 'message required' });
    if (latest.length > 500) return res.status(400).json({ error: 'Message too long' });
    const filters = await interpretAshaMessage(latest);
    if (country_code && /^[A-Z]{2}$/i.test(country_code) && !filters.country_code) filters.country_code = country_code.toUpperCase();
    if (filters.intent === 'clarify' || (!filters.query && filters.intent === 'search')) {
      return res.json({ reply: 'What product are you seeking?', products: [], filters });
    }
    const products = await searchAshaProducts(filters);
    let reply;
    if (products.length) reply = filters.intent === 'trending' ? 'Here are recent listings.' : 'Found ' + products.length + ' matching products.';
    else if (filters.intent === 'trending') reply = 'No recent listings yet.';
    else reply = 'No matches. Broaden your search.';
    return res.json({ reply, products, filters, result_count: products.length });
  } catch (err) {
    console.error('Asha search failed:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Shopping search temporarily unavailable' });
  }
});

app.get('/api/payments/user/:userId', authenticateUser, async (req, res) => {
  try {
    const payments = await supabaseQuery(
      `payments?user_id=eq.${req.params.userId}&select=*,orders(id,status,total_amount,shipping_name,created_at)&order=created_at.desc`
    );
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEO: per-route meta + JSON-LD, dynamic sitemap, dynamic product schema
// ─────────────────────────────────────────────────────────────────────────────
const SITE_URL = 'https://eastafricaonline.com';
const SITE_TITLE = 'East Africa Online — Shop, Sell & Pay with M-Pesa | Kenya, Uganda, Ethiopia, Rwanda, South Sudan';
const SITE_DESC = "East Africa's #1 online marketplace. Buy and sell electronics, fashion, home goods, beauty, food and more across Kenya, Uganda, Ethiopia, Rwanda and South Sudan. Secure M-Pesa payments, free local listings, fast delivery.";
const SITE_KEYWORDS = [
  'east africa online shopping','kenya online marketplace','uganda online store','ethiopia ecommerce',
  'rwanda online shopping','south sudan marketplace','m-pesa shopping','buy online east africa',
  'sell online africa','online marketplace africa','east africa ecommerce','jumia alternative',
  'buy electronics kenya','fashion online uganda','online store nairobi','online store kampala',
  'online store kigali','online store addis ababa','online store juba','free product listings africa',
].join(', ');
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// Escape </script> and < to prevent breaking out of inline JSON-LD
function safeJSONForScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
// Escape attribute/text content for safe HTML embedding
function htmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const ORG_NODE = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#org`,
  name: 'East Africa Online',
  url: SITE_URL,
  logo: `${SITE_URL}/android-chrome-512x512.png`,
  description: SITE_DESC,
  email: 'mngash2005@gmail.com',
  telephone: '+254708165802',
  areaServed: [
    { '@type': 'Country', name: 'Kenya' },
    { '@type': 'Country', name: 'Uganda' },
    { '@type': 'Country', name: 'Ethiopia' },
    { '@type': 'Country', name: 'Rwanda' },
    { '@type': 'Country', name: 'South Sudan' },
  ],
  sameAs: [SITE_URL],
};
const WEBSITE_NODE = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'East Africa Online',
  description: SITE_DESC,
  publisher: { '@id': `${SITE_URL}/#org` },
  inLanguage: 'en',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/browse?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};
const STORE_NODE = {
  '@type': 'OnlineStore',
  '@id': `${SITE_URL}/#store`,
  name: 'East Africa Online',
  url: SITE_URL,
  image: DEFAULT_OG_IMAGE,
  priceRange: '$$',
  paymentAccepted: 'M-Pesa, Wallet',
  currenciesAccepted: 'KES, UGX, ETB, RWF, SSP, USD',
  areaServed: ['KE', 'UG', 'ET', 'RW', 'SS'],
};
const HOME_GRAPH = { '@context': 'https://schema.org', '@graph': [ORG_NODE, WEBSITE_NODE, STORE_NODE] };

// Build per-route <head> meta block. All values must be already HTML-safe text.
function buildSeoHead({ title, description, canonical, ogImage, robots, ogType, jsonLd }) {
  const t = htmlEscape(title || SITE_TITLE);
  const d = htmlEscape(description || SITE_DESC);
  const url = canonical || `${SITE_URL}/`;
  const img = ogImage || DEFAULT_OG_IMAGE;
  const rob = robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const type = ogType || 'website';
  return `
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <meta name="keywords" content="${SITE_KEYWORDS}" />
    <meta name="author" content="East Africa Online" />
    <meta name="robots" content="${rob}" />
    <meta name="googlebot" content="${rob}" />
    <meta name="theme-color" content="#00A082" />
    <meta name="application-name" content="East Africa Online" />
    <meta name="apple-mobile-web-app-title" content="EA Online" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="format-detection" content="telephone=no" />
    <meta name="geo.region" content="KE;UG;ET;RW;SS" />
    <meta name="geo.placename" content="Kenya, Uganda, Ethiopia, Rwanda, South Sudan" />
    <link rel="canonical" href="${htmlEscape(url)}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    ${SUPABASE_URL ? `<link rel="preconnect" href="${htmlEscape(SUPABASE_URL)}" crossorigin />` : ''}
    <link rel="alternate" hreflang="en" href="${SITE_URL}/" />
    <link rel="alternate" hreflang="en-KE" href="${SITE_URL}/" />
    <link rel="alternate" hreflang="en-UG" href="${SITE_URL}/" />
    <link rel="alternate" hreflang="en-ET" href="${SITE_URL}/" />
    <link rel="alternate" hreflang="en-RW" href="${SITE_URL}/" />
    <link rel="alternate" hreflang="en-SS" href="${SITE_URL}/" />
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />
    <meta property="og:type" content="${htmlEscape(type)}" />
    <meta property="og:site_name" content="East Africa Online" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${htmlEscape(url)}" />
    <meta property="og:image" content="${htmlEscape(img)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_KE" />
    <meta property="og:locale:alternate" content="en_UG" />
    <meta property="og:locale:alternate" content="en_ET" />
    <meta property="og:locale:alternate" content="en_RW" />
    <meta property="og:locale:alternate" content="en_SS" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${htmlEscape(img)}" />
    <script type="application/ld+json">${safeJSONForScript(jsonLd || HOME_GRAPH)}</script>`;
}

// Static route SEO map — title/description/canonical/JSON-LD per known path
function staticRouteSeo(reqPath) {
  const p = reqPath.replace(/\/+$/, '') || '/';
  const breadcrumb = (items) => ({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: it.url,
    })),
  });
  const map = {
    '/': {
      title: SITE_TITLE,
      description: SITE_DESC,
      canonical: `${SITE_URL}/`,
      jsonLd: HOME_GRAPH,
      h1: 'East Africa Online — Shop & Sell with M-Pesa',
      intro: SITE_DESC,
    },
    '/browse': {
      title: 'Browse Products — Kenya, Uganda, Ethiopia, Rwanda, South Sudan | East Africa Online',
      description: 'Browse thousands of products from sellers across Kenya, Uganda, Ethiopia, Rwanda and South Sudan. Filter by country, district and category. Pay with M-Pesa.',
      canonical: `${SITE_URL}/browse`,
      jsonLd: { '@context': 'https://schema.org', '@graph': [WEBSITE_NODE, STORE_NODE,
        breadcrumb([{ name: 'Home', url: `${SITE_URL}/` }, { name: 'Browse', url: `${SITE_URL}/browse` }]),
      ]},
      h1: 'Browse Products Across East Africa',
      intro: 'Find electronics, fashion, home goods, beauty and food from verified sellers in five countries.',
    },
    '/about': {
      title: 'About — East Africa Online | The Marketplace for East Africa',
      description: 'Learn about East Africa Online — connecting buyers and sellers across Kenya, Uganda, Ethiopia, Rwanda and South Sudan with secure M-Pesa payments.',
      canonical: `${SITE_URL}/about`,
      jsonLd: { '@context': 'https://schema.org', '@graph': [ORG_NODE,
        breadcrumb([{ name: 'Home', url: `${SITE_URL}/` }, { name: 'About', url: `${SITE_URL}/about` }]),
      ]},
      h1: 'About East Africa Online',
      intro: 'A regional marketplace built for East Africa, with M-Pesa at the center of the buying experience.',
    },
    '/login': {
      title: 'Sign In — East Africa Online',
      description: 'Sign in to your East Africa Online account to shop, sell and manage your wallet.',
      canonical: `${SITE_URL}/login`,
      robots: 'noindex, follow',
      h1: 'Sign In',
      intro: 'Access your account to continue shopping or selling.',
    },
    '/dashboard': {
      title: 'Dashboard — East Africa Online',
      description: 'Your East Africa Online dashboard — orders, wallet, listings and more.',
      canonical: `${SITE_URL}/dashboard`,
      robots: 'noindex, follow',
      h1: 'Your Dashboard',
      intro: 'Manage your account, listings and orders.',
    },
    '/wallet': {
      title: 'My Wallet — Top up with M-Pesa | East Africa Online',
      description: 'Top up your East Africa Online wallet with M-Pesa, view your balance and transaction history. Get a 5% discount when paying from wallet.',
      canonical: `${SITE_URL}/wallet`,
      robots: 'noindex, follow',
      h1: 'My Wallet',
      intro: 'Top up via M-Pesa, view transactions, and pay faster with a 5% wallet discount.',
    },
  };
  return map[p] || null;
}

// Fetch published product (with images + country) for product/:id pages.
// Returns null if not found or on any error/timeout.
async function fetchProductForSeo(productId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  if (!/^[0-9a-f-]{6,40}$/i.test(productId)) return null;
  try {
    const r = await axios.get(
      `${SUPABASE_URL}/rest/v1/products`,
      {
        params: {
          id: `eq.${productId}`,
          product_status: 'eq.published',
          select: 'id,title,description,price,category,county,product_status,storage_path,product_images(storage_path,is_main,display_order),countries(name,currency,country_code)',
          limit: 1,
        },
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
        timeout: 2500,
      }
    );
    const p = (r.data || [])[0];
    return p || null;
  } catch (_) { return null; }
}

function productSeo(product) {
  const title = `${product.title} — Buy on East Africa Online`;
  const desc = (product.description || `Buy ${product.title} on East Africa Online. Pay with M-Pesa. Fast delivery across East Africa.`)
    .replace(/\s+/g, ' ').slice(0, 300);
  const canonical = `${SITE_URL}/product/${product.id}`;
  const currency = product.countries?.currency || 'KES';
  const images = (product.product_images || [])
    .slice()
    .sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || (a.display_order || 0) - (b.display_order || 0))
    .map((img) => `${SUPABASE_URL}/storage/v1/object/public/images/${img.storage_path}`);
  if (images.length === 0 && product.storage_path) {
    images.push(`${SUPABASE_URL}/storage/v1/object/public/images/${product.storage_path}`);
  }
  const ogImage = images[0] || DEFAULT_OG_IMAGE;
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Browse', item: `${SITE_URL}/browse` },
      ...(product.category ? [{ '@type': 'ListItem', position: 3, name: product.category, item: `${SITE_URL}/browse?category=${encodeURIComponent(product.category)}` }] : []),
      { '@type': 'ListItem', position: product.category ? 4 : 3, name: product.title, item: canonical },
    ],
  };
  const productNode = {
    '@type': 'Product',
    '@id': `${canonical}#product`,
    name: product.title,
    description: desc,
    image: images.length ? images : [DEFAULT_OG_IMAGE],
    sku: product.id,
    category: product.category || undefined,
    brand: { '@type': 'Brand', name: 'East Africa Online' },
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: currency,
      price: Number(product.price || 0).toFixed(2),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${SITE_URL}/#org` },
      areaServed: product.countries?.country_code || ['KE','UG','ET','RW','SS'],
    },
  };
  return {
    title,
    description: desc,
    canonical,
    ogImage,
    ogType: 'product',
    jsonLd: { '@context': 'https://schema.org', '@graph': [ORG_NODE, WEBSITE_NODE, productNode, breadcrumb] },
    h1: product.title,
    intro: desc,
    priceLine: `${currency} ${Number(product.price || 0).toLocaleString()}${product.county ? ' · ' + product.county : ''}`,
  };
}

// Inject SEO head + a server-rendered <noscript> fallback (so crawlers always
// see meaningful content even before the SPA hydrates).
function injectSEOIntoHtml(html, seo) {
  const head = buildSeoHead(seo);
  let out = html.replace(/<title>[^<]*<\/title>/i, '');
  out = out.replace(/<link\s+rel=["']shortcut icon["'][^>]*>/i, '');
  out = out.replace(/<\/head>/i, `${head}\n  </head>`);

  const h1 = htmlEscape(seo.h1 || 'East Africa Online');
  const intro = htmlEscape(seo.intro || SITE_DESC);
  const priceLine = seo.priceLine ? `<p style="font-size:18px;font-weight:700;color:#00A082;margin:8px 0 16px">${htmlEscape(seo.priceLine)}</p>` : '';
  const navLinks = `
        <nav style="margin-top:16px;font-size:14px"><a href="/">Home</a> · <a href="/browse">Browse Products</a> · <a href="/about">About</a> · <a href="/sitemap.xml">Sitemap</a></nav>`;
  const fallback = `
    <div id="seo-fallback" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;max-width:760px;margin:0 auto;color:#111">
      <h1 style="font-size:28px;font-weight:800;margin:0 0 8px;color:#00A082">${h1}</h1>
      <p style="font-size:16px;line-height:1.5;margin:0 0 12px">${intro}</p>
      ${priceLine}
      <noscript>
        <p><strong>JavaScript is required</strong> to use the full East Africa Online experience. Please enable it to shop, sell, manage your wallet and pay with M-Pesa.</p>
      </noscript>
      ${navLinks}
    </div>`;
  // Insert fallback right after #root opens (will be hidden once React mounts)
  out = out.replace(/(<div id="root">)/, `$1${fallback}`);
  // Hide the SEO fallback once React renders into #root
  out = out.replace(/<\/head>/i, `<style>#root > div:not(#seo-fallback) ~ #seo-fallback, #root > #seo-fallback:not(:only-child){display:none}</style>\n</head>`);
  return out;
}

// Dynamic sitemap.xml — registered BEFORE express.static so it overrides the file
app.get('/sitemap.xml', async (_req, res) => {
  const lastmod = new Date().toISOString().slice(0, 10);
  // Only include indexable, public URLs. Auth/private pages (/login, /dashboard,
  // /wallet, etc.) are noindex and must NOT appear in the sitemap.
  const staticUrls = [
    { loc: `${SITE_URL}/`,         changefreq: 'daily',   priority: '1.0' },
    { loc: `${SITE_URL}/browse`,   changefreq: 'hourly',  priority: '0.95' },
    { loc: `${SITE_URL}/about`,    changefreq: 'monthly', priority: '0.5' },
  ];
  let productUrls = [];
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const r = await axios.get(`${SUPABASE_URL}/rest/v1/products`, {
        params: { product_status: 'eq.published', select: 'id,updated_at,created_at', order: 'updated_at.desc.nullslast', limit: 5000 },
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
        timeout: 4000,
      });
      productUrls = (r.data || []).map((p) => ({
        loc: `${SITE_URL}/product/${p.id}`,
        lastmod: (p.updated_at || p.created_at || '').slice(0, 10) || lastmod,
        changefreq: 'weekly',
        priority: '0.8',
      }));
    } catch (e) {
      console.warn('[sitemap] product fetch failed:', e.message);
    }
  }
  const all = [...staticUrls, ...productUrls];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    all.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>\n    ` : ''}<changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')
  }\n</urlset>\n`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// Serve robots.txt, manifest, favicons from /public in BOTH dev & prod
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { extensions: ['xml', 'txt', 'png', 'webmanifest'] }));
}

// Serve built web app in production (API routes above take priority)
if (IS_PRODUCTION) {
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    const indexHtmlRaw = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');

    // Static asset serving — must run BEFORE the SPA fallback
    app.use(express.static(distPath, { index: false }));

    // SPA fallback: only intercept extensionless, non-API routes (real navigations)
    app.get('/{*splat}', async (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      if (req.path.startsWith('/_expo')) return next();
      if (req.path.includes('.')) return next();   // assets like /foo.css fall through to static

      // 1) Per-route static SEO
      let seo = staticRouteSeo(req.path);

      // 2) Dynamic product page SEO
      const productMatch = req.path.match(/^\/product\/([^\/?#]+)$/i);
      if (!seo && productMatch) {
        const product = await fetchProductForSeo(productMatch[1]);
        if (product) {
          seo = productSeo(product);
        } else {
          // Unknown / unpublished product: don't index but still serve the SPA
          seo = {
            title: 'Product Not Found — East Africa Online',
            description: 'This product is unavailable or has been removed. Browse other products on East Africa Online.',
            canonical: `${SITE_URL}${req.path}`,
            robots: 'noindex, follow',
            h1: 'Product Not Found',
            intro: 'This product is unavailable or has been removed.',
          };
        }
      }

      // 3) Unknown SPA route — generic SEO with noindex (avoid duplicate-content issues)
      if (!seo) {
        seo = {
          title: SITE_TITLE,
          description: SITE_DESC,
          canonical: `${SITE_URL}${req.path}`,
          robots: 'noindex, follow',
          h1: 'East Africa Online',
          intro: SITE_DESC,
        };
      }

      const html = injectSEOIntoHtml(indexHtmlRaw, seo);
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'no-cache');
      res.send(html);
    });
  }
} else {
  // Dev: proxy all non-API traffic to Expo Metro bundler on port 19006
  app.use('/', createProxyMiddleware({
    target: `http://localhost:${EXPO_PORT}`,
    changeOrigin: true,
    ws: true,
    on: {
      error: (err, req, res) => {
        if (res && res.writeHead) {
          res.writeHead(502);
          res.end('Expo Metro not ready yet — please wait a moment and refresh.');
        }
      }
    }
  }));
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`M-Pesa API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.MPESA_ENVIRONMENT || 'sandbox'}`);
  console.log(`Daraja URL: ${DARAJA_BASE_URL}`);
  console.log(`Credentials configured: ${!!CONSUMER_KEY && !!CONSUMER_SECRET}`);
  if (!IS_PRODUCTION) {
    console.log(`Proxying frontend traffic to Expo Metro on port ${EXPO_PORT}`);
  }
});

// Forward WebSocket upgrades (Expo hot reload) to Metro
if (!IS_PRODUCTION) {
  server.on('upgrade', (req, socket, head) => {
    createProxyMiddleware({
      target: `ws://localhost:${EXPO_PORT}`,
      ws: true,
      changeOrigin: true
    }).upgrade(req, socket, head);
  });
}
