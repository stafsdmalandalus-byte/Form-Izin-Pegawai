import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json({ limit: '15mb' }));

const SHARED_STORE_FILE = '/tmp/alandalus_shared_store_v1.json';
const recentWhatsAppDispatches: any[] = [];

function formatNowWib(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizePhoneForWhatsApp(rawPhone?: string): string {
  const fallback = (process.env.DEFAULT_SUPERVISOR_WHATSAPP || '').trim();
  const source = rawPhone && rawPhone !== '-' && rawPhone.trim() ? rawPhone.trim() : fallback;
  let digits = source.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  return digits;
}

function detectConfiguredProvider() {
  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const twilioFrom = (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886').trim();

  if (twilioSid && twilioToken && !twilioSid.startsWith('MY_')) {
    return { configured: true, provider: 'TWILIO', senderInfo: twilioFrom };
  }

  const gatewayToken = (process.env.WHATSAPP_API_TOKEN || '').trim();
  const gatewayUrl = (process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send').trim();
  const prefProvider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();

  if (gatewayToken && !gatewayToken.startsWith('MY_')) {
    if (gatewayUrl.includes('fonnte') || prefProvider === 'fonnte') {
      return { configured: true, provider: 'FONNTE_GATEWAY', senderInfo: gatewayUrl };
    }
    if (gatewayUrl.includes('wablas') || prefProvider === 'wablas') {
      return { configured: true, provider: 'WABLAS_GATEWAY', senderInfo: gatewayUrl };
    }
    return { configured: true, provider: 'CUSTOM_WEBHOOK', senderInfo: gatewayUrl };
  }

  return {
    configured: false,
    provider: 'SANDBOX_AUTO',
    senderInfo: 'Server Auto-Queue (Siap dihubungkan dengan Twilio / Fonnte via Environment Variables)',
  };
}

// Shared Store endpoints
app.get('/api/store', (_req: Request, res: Response) => {
  try {
    let shared = null;
    if (fs.existsSync(SHARED_STORE_FILE)) {
      shared = JSON.parse(fs.readFileSync(SHARED_STORE_FILE, 'utf-8'));
    }
    res.json({ ok: true, store: shared });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post('/api/store', (req: Request, res: Response) => {
  try {
    const incoming = req.body?.store;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ ok: false, error: 'Invalid store payload' });
      return;
    }
    fs.writeFileSync(SHARED_STORE_FILE, JSON.stringify(incoming), 'utf-8');
    res.json({ ok: true, store: incoming });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

// WhatsApp status & send endpoints
app.get('/api/whatsapp/status', (_req: Request, res: Response) => {
  const status = detectConfiguredProvider();
  res.json({
    ok: true,
    configured: status.configured,
    provider: status.provider,
    senderInfo: status.senderInfo,
    recentDispatches: recentWhatsAppDispatches.slice(0, 30),
  });
});

app.post('/api/whatsapp/send', async (req: Request, res: Response) => {
  try {
    const {
      eventType = 'NOTIFIKASI_SISTEM',
      nomorPermohonan = '-',
      recipientRole = 'ATASAN LANGSUNG',
      recipientName = 'Penerima',
      recipientPhone = '',
      messageText = '',
    } = req.body || {};

    if (!messageText || typeof messageText !== 'string') {
      res.status(400).json({ ok: false, error: 'messageText required' });
      return;
    }

    const cleanedPhone = normalizePhoneForWhatsApp(recipientPhone);
    const providerConfig = detectConfiguredProvider();
    const timestamp = formatNowWib();
    const dispatchId = `WA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const record = {
      id: dispatchId,
      timestamp,
      eventType,
      nomorPermohonan,
      recipientRole,
      recipientName,
      recipientPhone: cleanedPhone ? `+${cleanedPhone}` : 'Nomor Belum Diisi',
      provider: providerConfig.configured ? providerConfig.provider : 'Auto-Queue API Engine',
      mode: 'SANDBOX_QUEUE' as const,
      status: 'ANTREAN_SIMULASI' as const,
      detail: cleanedPhone
        ? `Notifikasi otomatis ke +${cleanedPhone} (${recipientName}) diproses.`
        : `Notifikasi tercatat untuk ${recipientName}.`,
      messagePreview: messageText.slice(0, 160),
    };
    recentWhatsAppDispatches.unshift(record);

    res.json({ ok: true, record });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
});

export default app;
