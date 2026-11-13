import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WhatsAppDispatchRecord {
  id: string;
  timestamp: string;
  eventType: string;
  nomorPermohonan: string;
  recipientRole: string;
  recipientName: string;
  recipientPhone: string;
  provider: string;
  mode: 'LIVE_API' | 'GAS_BRIDGE' | 'SANDBOX_QUEUE';
  status: 'TERKIRIM' | 'ANTREAN_SIMULASI' | 'GAGAL';
  detail: string;
  messagePreview: string;
}

const recentWhatsAppDispatches: WhatsAppDispatchRecord[] = [];

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

function detectConfiguredProvider(): {
  configured: boolean;
  provider: 'TWILIO' | 'FONNTE_GATEWAY' | 'WABLAS_GATEWAY' | 'CUSTOM_WEBHOOK' | 'SANDBOX_AUTO';
  senderInfo: string;
} {
  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const twilioFrom = (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886').trim();

  if (twilioSid && twilioToken && !twilioSid.startsWith('MY_')) {
    return {
      configured: true,
      provider: 'TWILIO',
      senderInfo: twilioFrom,
    };
  }

  const gatewayToken = (process.env.WHATSAPP_API_TOKEN || '').trim();
  const gatewayUrl = (process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send').trim();
  const prefProvider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();

  if (gatewayToken && !gatewayToken.startsWith('MY_')) {
    if (gatewayUrl.includes('fonnte') || prefProvider === 'fonnte') {
      return {
        configured: true,
        provider: 'FONNTE_GATEWAY',
        senderInfo: gatewayUrl,
      };
    }
    if (gatewayUrl.includes('wablas') || prefProvider === 'wablas') {
      return {
        configured: true,
        provider: 'WABLAS_GATEWAY',
        senderInfo: gatewayUrl,
      };
    }
    return {
      configured: true,
      provider: 'CUSTOM_WEBHOOK',
      senderInfo: gatewayUrl,
    };
  }

  return {
    configured: false,
    provider: 'SANDBOX_AUTO',
    senderInfo: 'Server Auto-Queue (Siap dihubungkan dengan Twilio / Fonnte via Environment Variables)',
  };
}

async function sendViaTwilio(toDigits: string, bodyText: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromWhatsApp = (process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886').trim();

  const formattedFrom = fromWhatsApp.startsWith('whatsapp:') ? fromWhatsApp : `whatsapp:${fromWhatsApp.startsWith('+') ? fromWhatsApp : '+' + fromWhatsApp}`;
  const formattedTo = `whatsapp:+${toDigits}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const params = new URLSearchParams();
  params.append('From', formattedFrom);
  params.append('To', formattedTo);
  params.append('Body', bodyText);

  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok) {
    return {
      ok: false,
      error: data?.message || `Twilio HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    sid: data?.sid || `SM${Date.now()}`,
  };
}

async function sendViaThirdPartyGateway(
  toDigits: string,
  bodyText: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiUrl = (process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send').trim();
  const apiToken = (process.env.WHATSAPP_API_TOKEN || '').trim();

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: apiToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target: toDigits,
      phone: toDigits,
      to: `+${toDigits}`,
      message: bodyText,
      text: bodyText,
      countryCode: '62',
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok || data?.status === false) {
    return {
      ok: false,
      error: data?.reason || data?.message || `Gateway HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    id: String(data?.id || data?.data?.id || `GW-${Date.now()}`),
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  // Endpoint 1: Cek status konfigurasi API WhatsApp di sisi server & riwayat pengiriman otomatis
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

  // Endpoint 2: Kirim notifikasi WhatsApp otomatis saat permohonan baru dibuat atau status berubah
  app.post('/api/whatsapp/send', async (req: Request, res: Response) => {
    try {
      const {
        eventType = 'NOTIFIKASI_SISTEM',
        nomorPermohonan = '-',
        recipientRole = 'ATASAN LANGSUNG',
        recipientName = 'Penerima',
        recipientPhone = '',
        messageText = '',
        gasWebAppUrl = '',
      } = req.body || {};

      if (!messageText || typeof messageText !== 'string') {
        res.status(400).json({
          ok: false,
          error: 'Isi pesan WhatsApp (messageText) wajib disertakan.',
        });
        return;
      }

      const cleanedPhone = normalizePhoneForWhatsApp(recipientPhone);
      const providerConfig = detectConfiguredProvider();
      const timestamp = formatNowWib();
      const dispatchId = `WA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 1. Jika Twilio terkonfigurasi di environment server
      if (providerConfig.configured && providerConfig.provider === 'TWILIO' && cleanedPhone) {
        const twilioRes = await sendViaTwilio(cleanedPhone, messageText);
        const record: WhatsAppDispatchRecord = {
          id: dispatchId,
          timestamp,
          eventType,
          nomorPermohonan,
          recipientRole,
          recipientName,
          recipientPhone: `+${cleanedPhone}`,
          provider: 'Twilio WhatsApp API',
          mode: 'LIVE_API',
          status: twilioRes.ok ? 'TERKIRIM' : 'GAGAL',
          detail: twilioRes.ok
            ? `Terkirim via Twilio (SID: ${twilioRes.sid})`
            : `Gagal via Twilio: ${twilioRes.error}`,
          messagePreview: messageText.slice(0, 160),
        };
        recentWhatsAppDispatches.unshift(record);
        res.json({
          ok: twilioRes.ok,
          record,
        });
        return;
      }

      // 2. Jika Penyedia Pihak Ketiga (Fonnte / Wablas / Custom Webhook) terkonfigurasi di environment server
      if (providerConfig.configured && providerConfig.provider !== 'TWILIO' && cleanedPhone) {
        const gwRes = await sendViaThirdPartyGateway(cleanedPhone, messageText);
        const record: WhatsAppDispatchRecord = {
          id: dispatchId,
          timestamp,
          eventType,
          nomorPermohonan,
          recipientRole,
          recipientName,
          recipientPhone: `+${cleanedPhone}`,
          provider: providerConfig.provider,
          mode: 'LIVE_API',
          status: gwRes.ok ? 'TERKIRIM' : 'GAGAL',
          detail: gwRes.ok
            ? `Terkirim otomatis via ${providerConfig.provider} (ID: ${gwRes.id})`
            : `Gagal via ${providerConfig.provider}: ${gwRes.error}`,
          messagePreview: messageText.slice(0, 160),
        };
        recentWhatsAppDispatches.unshift(record);
        res.json({
          ok: gwRes.ok,
          record,
        });
        return;
      }

      // 3. Jika URL Google Apps Script (GAS) terhubung, teruskan juga event WhatsApp ke GAS
      if (
        typeof gasWebAppUrl === 'string' &&
        gasWebAppUrl.trim().startsWith('https://script.google.com/') &&
        cleanedPhone
      ) {
        try {
          await fetch(gasWebAppUrl.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'sendWhatsAppNotification',
              payload: {
                eventType,
                nomorPermohonan,
                recipientRole,
                recipientName,
                recipientPhone: cleanedPhone,
                messageText,
              },
            }),
          });
        } catch {
          // Lanjutkan ke pencatatan antrean server jika GAS belum mendukung handler
        }
      }

      // 4. Mode Antrean / Sandbox Otomatis (ketika kredensial Twilio / Gateway di .env belum diisi)
      const record: WhatsAppDispatchRecord = {
        id: dispatchId,
        timestamp,
        eventType,
        nomorPermohonan,
        recipientRole,
        recipientName,
        recipientPhone: cleanedPhone ? `+${cleanedPhone}` : 'Nomor Belum Diisi di MASTER_PEGAWAI',
        provider: providerConfig.configured ? providerConfig.provider : 'Auto-Queue API Engine (Twilio/Fonnte Ready)',
        mode: 'SANDBOX_QUEUE',
        status: 'ANTREAN_SIMULASI',
        detail: cleanedPhone
          ? `Notifikasi otomatis ke +${cleanedPhone} (${recipientName}) telah diproses oleh endpoint /api/whatsapp/send.`
          : `Notifikasi otomatis untuk ${recipientName} tercatat (lengkapi nomor telepon di MASTER_PEGAWAI untuk pengiriman nomor tujuan).`,
        messagePreview: messageText.slice(0, 160),
      };
      recentWhatsAppDispatches.unshift(record);

      res.json({
        ok: true,
        record,
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'Terjadi kesalahan pada server pengiriman WhatsApp API.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Sistem Izin & Cuti Al-Andalus berjalan pada http://0.0.0.0:${PORT}`);
  });
}

startServer();
