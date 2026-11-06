/**
 * ============================================================================
 * SENA — Next-Gen Electric Transit & 3D Vision Platform (Mombasa, Kenya)
 * Google Cloud Run Server + Meta Business WhatsApp Cloud API Integration
 * ============================================================================
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

// Optional GCP SDK clients (gracefully initialized for local & Cloud Run)
let gcpLogging = null;
let gcpStorage = null;
let gcpSecrets = null;

try {
  const { Logging } = require('@google-cloud/logging');
  const { Storage } = require('@google-cloud/storage');
  const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

  const projectId = process.env.GCP_PROJECT_ID || 'sena-mobility-ke-prod';
  if (process.env.ENABLE_GCP_CLOUD_LOGGING === 'true') {
    gcpLogging = new Logging({ projectId });
  }
  gcpStorage = new Storage({ projectId });
  if (process.env.ENABLE_GCP_SECRET_MANAGER === 'true') {
    gcpSecrets = new SecretManagerServiceClient();
  }
} catch (err) {
  // SDKs optional during local dev if not installed yet
}

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Security & Performance Middleware for GCP Cloud Run
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(compression());
app.use(cors());

// Capture raw body for Meta X-Hub-Signature-256 HMAC validation
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true }));

// Static assets with high-performance caching headers
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    etag: true
  })
);

/**
 * Helper: Structured Cloud Logging for GCP Observability
 */
function logStructured(severity, message, metadata = {}) {
  const entry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    serviceContext: {
      service: process.env.K_SERVICE || 'sena-3d-landing',
      revision: process.env.K_REVISION || 'local-dev'
    },
    ...metadata
  };
  console.log(JSON.stringify(entry));
}

/**
 * SENA Intelligent Mobility Knowledge Engine for WhatsApp Bot
 */
function generateSenaBotReply(userText = '', userPhone = '') {
  const normalized = userText.toLowerCase().trim();

  if (normalized.includes('bike') || normalized.includes('boda') || normalized.includes('132')) {
    return {
      reply:
        '⚡ *SENA Standard E-Bike (SDR FR-C011)*\n' +
        '• *Base Fare:* KES 40 (1 Passenger)\n' +
        '• *Typical City Center → Nyali Estimate:* *KES 132*\n' +
        '• *Fleet Status:* 92% Avg Battery | Hyper-fluid dispatch in < 90 secs.\n\n' +
        'Reply with your *Pickup Pin* in Mombasa (e.g., _City Center, Mombasa Road, or Nyali Beach_) or tap below to launch instant dispatch.',
      intent: 'BOOK_EBIKE',
      suggestedActions: ['Dispatch to City Center', 'Dispatch to Nyali Beach', 'View 3 Seater Tuk-Tuk']
    };
  }

  if (normalized.includes('tuk') || normalized.includes('3 seater') || normalized.includes('three')) {
    return {
      reply:
        '🛺 *SENA 3-Seater Electric Tuk-Tuk (E-TU TUK 01)*\n' +
        '• *Base Fare:* KES 80 (Up to 3 Passengers + Luggage)\n' +
        '• *Typical Route Estimate:* *KES 240*\n' +
        '• *Range & Clarity:* 210 KM Zero-Emission Range, panoramic glass roof & real-time AR telemetry HUD.\n\n' +
        'Would you like to book an immediate pickup or schedule a group coastal transfer?',
      intent: 'BOOK_TUKTUK',
      suggestedActions: ['Book 3-Seater Now', 'Compare E-Bike (KES 132)', 'Speak to Fleet Ops']
    };
  }

  if (normalized.includes('clarity') || normalized.includes('3d') || normalized.includes('ar') || normalized.includes('vision')) {
    return {
      reply:
        '🔮 *SENA Optical & Service Clarity Engine*\n' +
        'SENA eliminates transit uncertainty in Mombasa through three pillars of clarity:\n' +
        '1️⃣ *Upfront Fare Clarity:* Exact KES pricing (e.g., KES 132 Standard Bike) before you tap Request.\n' +
        '2️⃣ *3D Telemetry Clarity:* Live E-Fleet network vectors across City Center, Mombasa Road & Nyali Beach.\n' +
        '3️⃣ *Verified Safety & KDPA 2019 Privacy:* Encrypted trip telemetry hosted on Google Cloud Platform.',
      intent: 'IMAGE_AND_SERVICE_CLARITY',
      suggestedActions: ['Book Standard Bike (KES 132)', 'Check KDPA 2019 Compliance', 'Connect Meta Business Agent']
    };
  }

  if (normalized.includes('privacy') || normalized.includes('data') || normalized.includes('act') || normalized.includes('kdpa') || normalized.includes('2019')) {
    return {
      reply:
        '🛡️ *Kenya Data Protection Act, 2019 (No. 24 of 2019) Compliance*\n' +
        'SENA processes all rider telemetry, phone numbers, and Meta WhatsApp interactions strictly under the *Kenya Data Protection Act, 2019* and ODPC guidelines:\n' +
        '• Lawful, minimal & transparent collection (Section 25)\n' +
        '• Right to access, rectification & erasure (Section 26)\n' +
        '• Official Statute: http://kenyalaw.org:8181/exist/kenyalex/actview.xql?actid=No.%2024%20of%202019',
      intent: 'KDPA_2019_COMPLIANCE',
      suggestedActions: ['Book Standard Bike (KES 132)', 'Request Data Export', 'Back to Main Menu']
    };
  }

  if (normalized.includes('contact') || normalized.includes('poughkeepsie') || normalized.includes('tel') || normalized.includes('email') || normalized.includes('facebook')) {
    return {
      reply:
        '🏢 *Poughkeepsie Limited — Smart Transport Ecosystem*\n' +
        '*SENA Transit* is a flagship mobility product engineered by *Poughkeepsie Limited*.\n\n' +
        '📞 *Tel:* +254 700 736 200\n' +
        '✉️ *Email:* info@poughkeepsie.co.ke\n' +
        '📘 *Facebook:* Poughkeepsie Limited (https://www.facebook.com/search/top?q=Poughkeepsie%20Limited)\n' +
        '📍 *Operations Hub:* Mombasa, Kenya',
      intent: 'CONTACT_POUGHKEEPSIE',
      suggestedActions: ['Book Standard Bike (KES 132)', 'Request 3-Seater Tuk-Tuk', 'KDPA 2019 Data Privacy']
    };
  }

  if (normalized.includes('partner') || normalized.includes('driver') || normalized.includes('fleet') || normalized.includes('invest')) {
    return {
      reply:
        '🤝 *SENA Fleet & Rider Partnership — Twende Kazi!*\n' +
        'Join Mombasa’s fastest-growing 100% electric transit network:\n' +
        '• Zero fuel cost — rapid battery swap & solar charging docks in Nyali & CBD\n' +
        '• Instant M-Pesa & Meta WhatsApp Business automated dispatch\n' +
        'Share your name and vehicle interest (E-Boda or E-Tuk-Tuk) and our Mombasa Onboarding Team will call you right back.',
      intent: 'FLEET_PARTNERSHIP',
      suggestedActions: ['Onboard as E-Boda Rider', 'Fleet Investor Deck', 'Book a Demo Ride']
    };
  }

  return {
    reply:
      'Habari! 👋 Karibu *SENA — Twende Kazi* ⚡\n' +
      'Mombasa’s next-gen electric transit network with hyper-fluid speed & crystal-clear upfront pricing.\n\n' +
      'How can our Meta Business Assistant help you today?\n' +
      '• 🏍️ *Standard E-Bike:* Base KES 40 • 1 Pax (~KES 132)\n' +
      '• 🛺 *3-Seater E-Tuk-Tuk:* Base KES 80 • 3 Pax (~KES 240)\n' +
      '• 📍 *Active Corridors:* City Center ↔ Mombasa Road ↔ Nyali Beach',
    intent: 'WELCOME_MENU',
    suggestedActions: [
      'Book Standard Bike (KES 132)',
      'Request 3-Seater Tuk-Tuk',
      'Explore 3D Service Clarity',
      'KDPA 2019 Data Privacy'
    ]
  };
}

/**
 * 1. GCP & Meta Configuration Status Endpoint
 */
app.get('/api/config/status', (req, res) => {
  const hasLiveMetaToken = Boolean(
    process.env.META_WHATSAPP_ACCESS_TOKEN &&
      !process.env.META_WHATSAPP_ACCESS_TOKEN.includes('REPLACE_WITH')
  );

  res.json({
    status: 'healthy',
    company: process.env.COMPANY_NAME || 'Poughkeepsie Limited',
    flagshipProduct: 'SENA Transit (Part of the Poughkeepsie Limited Transport Ecosystem)',
    contact: {
      tel: process.env.CONTACT_TEL || '+254700736200',
      email: process.env.CONTACT_EMAIL || 'info@poughkeepsie.co.ke',
      facebook:
        process.env.FACEBOOK_PAGE_URL ||
        'https://www.facebook.com/search/top?q=Poughkeepsie%20Limited'
    },
    platform: 'Google Cloud Platform (Cloud Run + Cloud Storage)',
    gcp: {
      projectId: process.env.GCP_PROJECT_ID || 'sena-mobility-ke-prod',
      region: process.env.GCP_REGION || 'africa-south1',
      gcsBucket: process.env.GCS_ASSETS_BUCKET || 'sena-mobility-3d-assets-prod',
      cloudRunService: process.env.K_SERVICE || 'sena-3d-landing',
      cloudRunRevision: process.env.K_REVISION || 'sena-3d-landing-00001-gcp'
    },
    metaBusiness: {
      graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v21.0',
      businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID || '104829104928174',
      wabaId: process.env.META_WABA_ID || '109482716492810',
      phoneNumberId: process.env.META_PHONE_NUMBER_ID || '118492019482719',
      displayNumber: process.env.META_WHATSAPP_DISPLAY_NUMBER || '254700736200',
      webhookEndpoint: '/api/whatsapp/webhook',
      liveTokenConfigured: hasLiveMetaToken
    },
    compliance: {
      framework: 'Kenya Data Protection Act, 2019 (No. 24 of 2019)',
      kenyaLawUrl:
        process.env.KDPA_2019_ACT_URL ||
        'http://kenyalaw.org:8181/exist/kenyalex/actview.xql?actid=No.%2024%20of%202019',
      odpcUrl: process.env.ODPC_KENYA_PORTAL_URL || 'https://www.odpc.go.ke/data-protection-act/'
    }
  });
});

/**
 * 2. Meta WhatsApp Business Cloud API — Webhook Verification (GET)
 */
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'sena_mombasa_meta_verify_2026';

  if (mode === 'subscribe' && token === verifyToken) {
    logStructured('INFO', 'Meta WhatsApp Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logStructured('WARNING', 'Meta WhatsApp Webhook verification failed', { mode });
  return res.sendStatus(403);
});

/**
 * 3. Meta WhatsApp Business Cloud API — Incoming Webhook Receiver (POST)
 */
app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    // Verify X-Hub-Signature-256 if META_APP_SECRET is configured
    const appSecret = process.env.META_APP_SECRET;
    const signatureHeader = req.get('X-Hub-Signature-256');
    if (appSecret && signatureHeader && req.rawBody) {
      const expectedSig =
        'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
      if (signatureHeader !== expectedSig) {
        logStructured('ERROR', 'Invalid Meta X-Hub-Signature-256 header');
        return res.sendStatus(401);
      }
    }

    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value || {};
          const messages = value.messages || [];
          for (const msg of messages) {
            const fromPhone = msg.from;
            const textBody = msg.text?.body || msg.interactive?.button_reply?.title || '';
            const botResponse = generateSenaBotReply(textBody, fromPhone);

            logStructured('INFO', 'Processed incoming WhatsApp message', {
              fromPhone,
              intent: botResponse.intent
            });

            // If live Meta Access Token is configured, reply via Graph API v21.0
            const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
            const phoneId = process.env.META_PHONE_NUMBER_ID;
            const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';

            if (accessToken && !accessToken.includes('REPLACE_WITH') && phoneId) {
              await fetch(`https://graph.facebook.com/${apiVersion}/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: fromPhone,
                  type: 'text',
                  text: { body: botResponse.reply }
                })
              });
            }
          }
        }
      }
      return res.status(200).json({ status: 'EVENT_RECEIVED' });
    }

    return res.sendStatus(404);
  } catch (err) {
    logStructured('ERROR', 'Meta Webhook handler exception', { error: err.message });
    return res.status(500).json({ error: 'Webhook processing error' });
  }
});

/**
 * 4. Interactive On-Page WhatsApp Business Chat Endpoint (POST /api/whatsapp/send)
 */
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { message, customerPhone, metaAccountOverride } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const botResult = generateSenaBotReply(message, customerPhone);
    const displayNum = (
      metaAccountOverride?.displayNumber ||
      process.env.META_WHATSAPP_DISPLAY_NUMBER ||
      '254700736200'
    ).replace(/[^0-9]/g, '');

    const businessAccountId =
      metaAccountOverride?.businessAccountId ||
      process.env.META_BUSINESS_ACCOUNT_ID ||
      '104829104928174';

    const phoneId =
      metaAccountOverride?.phoneNumberId ||
      process.env.META_PHONE_NUMBER_ID ||
      '118492019482719';

    // Optional live dispatch to Meta Graph API if customerPhone & live token exist
    let graphApiDispatched = false;
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';

    if (
      customerPhone &&
      accessToken &&
      !accessToken.includes('REPLACE_WITH') &&
      phoneId
    ) {
      try {
        const graphRes = await fetch(
          `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: customerPhone.replace(/[^0-9]/g, ''),
              type: 'text',
              text: { body: botResult.reply }
            })
          }
        );
        graphApiDispatched = graphRes.ok;
      } catch (_e) {
        graphApiDispatched = false;
      }
    }

    const encodedPrefill = encodeURIComponent(
      `Habari SENA! [Meta Business ID: ${businessAccountId}] ${message}`
    );

    return res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      reply: botResult.reply,
      intent: botResult.intent,
      suggestedActions: botResult.suggestedActions,
      metaBusiness: {
        businessAccountId,
        phoneNumberId: phoneId,
        displayNumber: displayNum,
        graphApiDispatched,
        waMeDirectUrl: `https://wa.me/${displayNum}?text=${encodedPrefill}`
      }
    });
  } catch (err) {
    logStructured('ERROR', 'WhatsApp send API error', { error: err.message });
    return res.status(500).json({ error: 'Failed to process WhatsApp message' });
  }
});

/**
 * 5. Cloud Run Healthcheck Endpoint
 */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'sena-3d-landing', timestamp: Date.now() });
});

// SPA Fallback to index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  logStructured('INFO', `SENA 3D Landing Page & Meta WhatsApp Server listening on http://${HOST}:${PORT}`);
});
