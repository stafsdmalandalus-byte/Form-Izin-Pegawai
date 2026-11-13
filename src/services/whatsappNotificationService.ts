import { Employee, LeaveRequest, UserAccount } from '../types';
import {
  ARSIP_IZIN_ISO_FOLDER_URL,
  FullDatabaseStore,
  recordActivity,
  resolveClearArchiveUrl,
  saveDatabase,
} from './databaseService';
import {
  generateFollowUpMessageText,
  generateSubstituteDelegationMessageText,
} from '../utils/messageShareHelper';

export type WhatsAppAutomationEvent =
  | 'PERMOHONAN_BARU'
  | 'KEPUTUSAN_ATASAN'
  | 'KEPUTUSAN_MUDIR'
  | 'DIARSIPKAN_SDM';

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

export interface WhatsAppServerStatus {
  ok: boolean;
  configured: boolean;
  provider: string;
  senderInfo: string;
  recentDispatches: WhatsAppDispatchRecord[];
}

export const fetchWhatsAppServerStatus = async (): Promise<WhatsAppServerStatus | null> => {
  try {
    const res = await fetch('/api/whatsapp/status');
    if (!res.ok) return null;
    return (await res.json()) as WhatsAppServerStatus;
  } catch {
    return null;
  }
};

export const sendSingleWhatsAppApiNotification = async (params: {
  eventType: string;
  nomorPermohonan: string;
  recipientRole: string;
  recipientName: string;
  recipientPhone: string;
  messageText: string;
  gasWebAppUrl?: string;
}): Promise<{ ok: boolean; record?: WhatsAppDispatchRecord; error?: string }> => {
  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Gagal menghubungi endpoint /api/whatsapp/send',
    };
  }
};

const findSupervisorForRequest = (
  store: FullDatabaseStore,
  req: LeaveRequest
): Employee | undefined => {
  const applicant = store.MASTER_PEGAWAI.find((e) => e.idPegawai === req.idPegawai);
  if (applicant?.idAtasanLangsung && applicant.idAtasanLangsung !== '-') {
    const direct = store.MASTER_PEGAWAI.find((e) => e.idPegawai === applicant.idAtasanLangsung);
    if (direct) return direct;
  }
  return store.MASTER_PEGAWAI.find(
    (e) =>
      e.idPegawai !== req.idPegawai &&
      (e.jabatan.toLowerCase().includes('kepala') ||
        e.jabatan.toLowerCase().includes('kabid') ||
        e.jabatan.toLowerCase().includes('atasan'))
  );
};

const findMudirForRequest = (
  store: FullDatabaseStore,
  req: LeaveRequest
): Employee | undefined => {
  const applicant = store.MASTER_PEGAWAI.find((e) => e.idPegawai === req.idPegawai);
  if (applicant?.idMudirUnit && applicant.idMudirUnit !== '-') {
    const direct = store.MASTER_PEGAWAI.find((e) => e.idPegawai === applicant.idMudirUnit);
    if (direct) return direct;
  }
  return store.MASTER_PEGAWAI.find((e) => e.jabatan.toLowerCase().includes('mudir'));
};

const buildApplicantStatusMessage = (
  req: LeaveRequest,
  event: WhatsAppAutomationEvent,
  actorName: string
): string => {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const deepLinkUrl = appUrl
    ? `${appUrl}/?req=${encodeURIComponent(req.idPermohonan)}`
    : appUrl;
  const archiveDriveUrl = resolveClearArchiveUrl(req.urlPdf || ARSIP_IZIN_ISO_FOLDER_URL);

  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Yth. Ustadz/Ustadzah *${req.namaPegawai}*
Di tempat.

🔔 *NOTIFIKASI OTOMATIS SISTEM IZIN & CUTI AL-ANDALUS*
Status permohonan izin/cuti Anda telah diperbarui:

• *No. Permohonan:* ${req.nomorPermohonan}
• *Jenis & Kategori:* ${req.jenisPermohonan} (${req.kategoriKeperluan})
• *Tanggal:* ${req.tanggalMulai} s/d ${req.tanggalSelesai} (${req.jumlahHari})
• *Status Terbaru:* *${req.statusPermohonan}*
• *Diproses Oleh:* ${actorName} (${event.replace('_', ' ')})
• *Catatan Atasan:* ${req.catatanAtasan || '-'}
• *Catatan Mudir:* ${req.catatanMudir || '-'}

${
  req.statusPermohonan === 'DISETUJUI' || req.statusPermohonan === 'DIARSIPKAN'
    ? `✅ Dokumen Surat Resmi *AIS-FRM-SEK.02.11* (lengkap dengan 3 tanda tangan) sudah siap diunduh dalam format PDF & Word A4.\n📂 *Folder Google Drive (Arsip izin ISO):* ${archiveDriveUrl}`
    : ''
}
🔗 *Buka Langsung Surat Ini:* ${deepLinkUrl}

Jazakumullahu Khairan.`;
};

/**
 * Mengirim notifikasi WhatsApp otomatis melalui API (/api/whatsapp/send)
 * setiap kali permohonan baru dibuat atau status permohonan berubah.
 */
export const triggerWhatsAppAutomation = async (
  store: FullDatabaseStore,
  request: LeaveRequest,
  event: WhatsAppAutomationEvent,
  actor: UserAccount,
  overrideSupervisorPhone?: string
): Promise<{
  sentCount: number;
  summaryText: string;
  records: WhatsAppDispatchRecord[];
}> => {
  const applicantEmp = store.MASTER_PEGAWAI.find((e) => e.idPegawai === request.idPegawai);
  const supervisorEmp = findSupervisorForRequest(store, request);
  const mudirEmp = findMudirForRequest(store, request);
  const gasUrl = store.status?.gasWebAppUrl || '';

  const dispatches: Array<{
    recipientRole: string;
    recipientName: string;
    recipientPhone: string;
    messageText: string;
  }> = [];

  if (event === 'PERMOHONAN_BARU') {
    // Prioritas Utama: Kirim otomatis ke WhatsApp Atasan Langsung agar segera mendapatkan pesan
    const supPhone =
      (overrideSupervisorPhone && overrideSupervisorPhone.trim()) ||
      supervisorEmp?.nomorTelepon ||
      '';
    const supName = supervisorEmp?.namaLengkap || 'Atasan Langsung';
    const supMessage = generateFollowUpMessageText(
      request,
      'ATASAN LANGSUNG',
      supervisorEmp
    );

    dispatches.push({
      recipientRole: 'ATASAN LANGSUNG',
      recipientName: supName,
      recipientPhone: supPhone,
      messageText: supMessage,
    });

    // Jika ada Pegawai Pengganti (Badal / Inval), kirim juga notifikasi otomatis ke Pegawai Pengganti
    if (request.namaPegawaiPengganti && request.namaPegawaiPengganti !== '-') {
      const subEmp = store.MASTER_PEGAWAI.find(
        (e) =>
          e.idPegawai === request.idPegawaiPengganti ||
          e.namaLengkap === request.namaPegawaiPengganti
      );
      const subPhone =
        (request.noWaPegawaiPengganti && request.noWaPegawaiPengganti !== '-'
          ? request.noWaPegawaiPengganti
          : subEmp?.nomorTelepon) || '';
      dispatches.push({
        recipientRole: 'PEGAWAI PENGGANTI (BADAL)',
        recipientName: request.namaPegawaiPengganti,
        recipientPhone: subPhone,
        messageText: generateSubstituteDelegationMessageText(request),
      });
    }
  } else if (event === 'KEPUTUSAN_ATASAN') {
    // 1. Jika disetujui Atasan Langsung -> Otomatis kirim WA ke Mudir Unit untuk tanda tangan tahap 3
    if (request.statusPermohonan === 'MENUNGGU PERSETUJUAN MUDIR') {
      const mudirName = mudirEmp?.namaLengkap || `Mudir ${request.unit}`;
      const mudirPhone = mudirEmp?.nomorTelepon || '';
      const mudirMessage = generateFollowUpMessageText(
        request,
        'MUDIR UNIT',
        mudirEmp
      );
      dispatches.push({
        recipientRole: 'MUDIR UNIT',
        recipientName: mudirName,
        recipientPhone: mudirPhone,
        messageText: mudirMessage,
      });
    }

    // 2. Kirim juga update status otomatis ke Pemohon (Pegawai)
    if (applicantEmp) {
      dispatches.push({
        recipientRole: 'PEGAWAI (PEMOHON)',
        recipientName: applicantEmp.namaLengkap,
        recipientPhone: applicantEmp.nomorTelepon || '',
        messageText: buildApplicantStatusMessage(request, event, actor.namaPengguna),
      });
    }
  } else if (event === 'KEPUTUSAN_MUDIR') {
    // 1. Kirim update status ke Pemohon (Pegawai) bahwa surat resmi AIS-FRM-SEK.02.11 siap diunduh / atau perlu revisi
    if (applicantEmp) {
      dispatches.push({
        recipientRole: 'PEGAWAI (PEMOHON)',
        recipientName: applicantEmp.namaLengkap,
        recipientPhone: applicantEmp.nomorTelepon || '',
        messageText: buildApplicantStatusMessage(request, event, actor.namaPengguna),
      });
    }

    // 2. Beri tahu Atasan Langsung bahwa Mudir Unit telah memberikan keputusan final
    if (supervisorEmp) {
      dispatches.push({
        recipientRole: 'ATASAN LANGSUNG',
        recipientName: supervisorEmp.namaLengkap,
        recipientPhone: supervisorEmp.nomorTelepon || '',
        messageText: buildApplicantStatusMessage(request, event, actor.namaPengguna),
      });
    }

    // 3. Jika disetujui Mudir & ada Pegawai Pengganti (Badal), beri tahu Pegawai Pengganti bahwa izin resmi disetujui
    if (
      request.statusPermohonan === 'DISETUJUI' &&
      request.namaPegawaiPengganti &&
      request.namaPegawaiPengganti !== '-'
    ) {
      const subEmp = store.MASTER_PEGAWAI.find(
        (e) =>
          e.idPegawai === request.idPegawaiPengganti ||
          e.namaLengkap === request.namaPegawaiPengganti
      );
      const subPhone =
        (request.noWaPegawaiPengganti && request.noWaPegawaiPengganti !== '-'
          ? request.noWaPegawaiPengganti
          : subEmp?.nomorTelepon) || '';
      dispatches.push({
        recipientRole: 'PEGAWAI PENGGANTI (BADAL)',
        recipientName: request.namaPegawaiPengganti,
        recipientPhone: subPhone,
        messageText: generateSubstituteDelegationMessageText(request),
      });
    }
  } else if (event === 'DIARSIPKAN_SDM') {
    if (applicantEmp) {
      dispatches.push({
        recipientRole: 'PEGAWAI (PEMOHON)',
        recipientName: applicantEmp.namaLengkap,
        recipientPhone: applicantEmp.nomorTelepon || '',
        messageText: buildApplicantStatusMessage(request, event, actor.namaPengguna),
      });
    }
  }

  const records: WhatsAppDispatchRecord[] = [];
  for (const item of dispatches) {
    const result = await sendSingleWhatsAppApiNotification({
      eventType: event,
      nomorPermohonan: request.nomorPermohonan,
      recipientRole: item.recipientRole,
      recipientName: item.recipientName,
      recipientPhone: item.recipientPhone,
      messageText: item.messageText,
      gasWebAppUrl: gasUrl,
    });
    if (result.record) {
      records.push(result.record);
    }
  }

  const targetNames = dispatches.map((d) => `${d.recipientRole} (${d.recipientName})`).join(', ');
  const summaryText =
    records.length > 0
      ? `Notifikasi WhatsApp API otomatis dikirim ke: ${targetNames}`
      : 'Tidak ada antrean notifikasi WhatsApp otomatis.';

  if (records.length > 0) {
    recordActivity(
      store,
      actor,
      `WA_API_${event}`,
      'NOTIFIKASI_WA_API',
      request.nomorPermohonan,
      `${summaryText} [${records.map((r) => `${r.provider}: ${r.status}`).join('; ')}]`
    );
    saveDatabase(store);
  }

  return {
    sentCount: records.length,
    summaryText,
    records,
  };
};
