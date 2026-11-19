import { Employee, LeaveRequest } from '../types';

/**
 * Mengkodekan ringkasan LeaveRequest ke dalam parameter URL base64-safe (&d=...)
 * sehingga ketika Atasan Langsung atau Mudir mengeklik link dari WhatsApp di HP/perangkat mana pun,
 * surat permohonan dijamin 100% langsung muncul tanpa pernah kosong.
 */
export const encodeLeaveRequestForUrl = (request: LeaveRequest): string => {
  try {
    const compactPayload = {
      i: request.idPermohonan,
      n: request.nomorPermohonan,
      ip: request.idPegawai,
      np: request.namaPegawai,
      ni: request.nip || '',
      bi: request.bidang || '-',
      ba: request.bagian || '-',
      ja: request.jabatan || '-',
      un: request.unit || '-',
      jp: request.jenisPermohonan,
      kk: request.kategoriKeperluan,
      tm: request.tanggalMulai,
      ts: request.tanggalSelesai,
      jh: request.jumlahHari,
      al: request.alasan,
      kt: request.keteranganTambahan || '-',
      la: request.lampiran || '-',
      tp: request.tanggalPengajuan,
      sp: request.statusPermohonan,
      sa: request.statusAtasan,
      sm: request.statusMudir,
      ca: request.catatanAtasan || '-',
      cm: request.catatanMudir || '-',
      cs: request.catatanSdm || '-',
      na: request.namaAtasan || '',
      wa: request.waktuTtdAtasan || '',
      nm: request.namaMudir || '',
      wm: request.waktuTtdMudir || '',
      ipg: request.idPegawaiPengganti || '-',
      npg: request.namaPegawaiPengganti || '-',
      wpg: request.noWaPegawaiPengganti || '-',
      cdg: request.catatanDelegasiTugas || '-',
    };
    const jsonStr = JSON.stringify(compactPayload);
    return btoa(encodeURIComponent(jsonStr))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return '';
  }
};

export const decodeLeaveRequestFromUrl = (encoded: string | null): LeaveRequest | null => {
  if (!encoded) return null;
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const jsonStr = decodeURIComponent(atob(base64));
    const p = JSON.parse(jsonStr);
    if (!p || !p.i || !p.n) return null;
    return {
      idPermohonan: p.i,
      nomorPermohonan: p.n,
      idPegawai: p.ip || '-',
      namaPegawai: p.np || 'Pegawai',
      nip: p.ni || '',
      bidang: p.bi || '-',
      bagian: p.ba || '-',
      jabatan: p.ja || '-',
      unit: p.un || '-',
      jenisPermohonan: p.jp || 'Izin',
      kategoriKeperluan: p.kk || '-',
      tanggalMulai: p.tm || '',
      tanggalSelesai: p.ts || '',
      jumlahHari: p.jh || '1 Hari',
      alasan: p.al || '-',
      keteranganTambahan: p.kt || '-',
      lampiran: p.la || '-',
      tanggalPengajuan: p.tp || '',
      statusPermohonan: p.sp || 'MENUNGGU PERSETUJUAN ATASAN',
      statusAtasan: p.sa || 'MENUNGGU',
      statusMudir: p.sm || 'BELUM DIPROSES',
      catatanAtasan: p.ca || '-',
      catatanMudir: p.cm || '-',
      catatanSdm: p.cs || '-',
      urlPdf: '-',
      tanggalDisetujui: '-',
      tanggalDiarsipkan: '-',
      namaAtasan: p.na || undefined,
      waktuTtdAtasan: p.wa || undefined,
      namaMudir: p.nm || undefined,
      waktuTtdMudir: p.wm || undefined,
      idPegawaiPengganti: p.ipg || '-',
      namaPegawaiPengganti: p.npg || '-',
      noWaPegawaiPengganti: p.wpg || '-',
      catatanDelegasiTugas: p.cdg || '-',
    };
  } catch {
    return null;
  }
};

export const buildApprovalDeepLink = (request: LeaveRequest): string => {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  if (!appUrl) return '';
  return `${appUrl}/?req=${encodeURIComponent(request.idPermohonan)}`;
};

/**
 * Menghasilkan teks pesan formal (WhatsApp / Pesan Langsung) dari Pegawai
 * kepada Atasan Langsung atau Mudir Unit, lengkap dengan:
 * 1. Ringkasan Permohonan (Nomor, Nama, NIP, Bidang/Unit, Jenis/Kategori, Tanggal, Durasi, Alasan)
 * 2. Arahan langkah persetujuan & tanda tangan digital di layar HP
 */
export const generateFollowUpMessageText = (
  request: LeaveRequest,
  targetRole: 'ATASAN LANGSUNG' | 'MUDIR UNIT',
  targetPerson?: Employee
): string => {
  const recipientTitle =
    targetRole === 'ATASAN LANGSUNG'
      ? targetPerson?.namaLengkap
        ? `Ustadz / Bapak / Ibu *${targetPerson.namaLengkap}* (${targetPerson.jabatan || 'Atasan Langsung'})`
        : 'Ustadz / Bapak / Ibu *Atasan Langsung / Kepala Bidang*'
      : targetPerson?.namaLengkap
      ? `Ustadz *${targetPerson.namaLengkap}* (Mudir ${request.unit})`
      : `Ustadz *Mudir ${request.unit}*`;

  const actionButtonName =
    targetRole === 'ATASAN LANGSUNG' ? '*Proses Atasan*' : '*Keputusan Mudir*';

  const statusNote =
    targetRole === 'MUDIR UNIT'
      ? `✅ *Status Saat Ini:* Telah diperiksa & ditandatangani oleh Atasan Langsung (${request.namaAtasan || 'Disetujui'})\n`
      : '';

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const deepLinkUrl = buildApprovalDeepLink(request) || appUrl;

  const delegationLine =
    request.namaPegawaiPengganti && request.namaPegawaiPengganti !== '-'
      ? `• *Pegawai Pengganti (Badal/Inval):* ${request.namaPegawaiPengganti}${
          request.catatanDelegasiTugas && request.catatanDelegasiTugas !== '-'
            ? ` (${request.catatanDelegasiTugas})`
            : ''
        }\n`
      : '';

  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Yth. ${recipientTitle}
Di tempat.

Semoga Ustadz/Bapak/Ibu senantiasa dalam lindungan Allah Subhanahu wa Ta'ala.

Izin menyampaikan permohonan *${request.jenisPermohonan}* melalui *Sistem Informasi Permohonan Izin dan Cuti Pegawai Pesantren Islam Internasional Al-Andalus* dengan ringkasan sebagai berikut:

📋 *RINGKASAN PERMOHONAN IZIN / CUTI*
• *No. Permohonan:* ${request.nomorPermohonan}
• *Nama Pemohon:* ${request.namaPegawai}${request.nip ? ` (NIP: ${request.nip})` : ''}
• *Bidang / Bagian:* ${request.bidang} / ${request.bagian}
• *Jabatan / Unit:* ${request.jabatan} — ${request.unit}
• *Jenis & Kategori:* ${request.jenisPermohonan} (${request.kategoriKeperluan})
• *Tanggal Pelaksanaan:* ${request.tanggalMulai} s/d ${request.tanggalSelesai}
• *Durasi Efektif:* ${request.jumlahHari}
• *Alasan:* ${request.alasan}
${delegationLine}${statusNote}
⚡ *TAUTAN CEPAT PERSETUJUAN 1-KLIK (LANGSUNG BUKA SURAT):*
👉 ${deepLinkUrl}

📱 *ARAHAN PERSETUJUAN & TANDA TANGAN DI HP:*
1. Klik tautan cepat di atas: ${deepLinkUrl}
2. Sistem otomatis membuka surat permohonan *${request.nomorPermohonan}*.
3. Klik tombol ${actionButtonName}, pilih *SETUJUI* (atau *MINTA REVISI* / *TOLAK*).
4. Goreskan *Tanda Tangan Digital* langsung di layar HP Anda, lalu klik *Simpan Keputusan*.

Atas perhatian, arahan, dan kebijaksanaannya, saya ucapkan *Jazakumullahu Khairan*.
Wassalamu'alaikum warahmatullahi wabarakatuh.

Hormat saya,
*${request.namaPegawai}*`;
};

/**
 * Menghasilkan teks pesan WhatsApp kepada Pegawai Pengganti (Badal / Inval Tugas)
 */
export const generateSubstituteDelegationMessageText = (
  request: LeaveRequest
): string => {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const deepLinkUrl = buildApprovalDeepLink(request) || appUrl;

  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Yth. Ustadz/Ustadzah *${request.namaPegawaiPengganti || 'Rekan Pegawai'}*
Di tempat.

Semoga antum senantiasa dalam lindungan Allah Subhanahu wa Ta'ala.

Sehubungan dengan pengajuan *${request.jenisPermohonan} (${request.kategoriKeperluan})* saya pada:
• *No. Surat:* ${request.nomorPermohonan}
• *Nama Pemohon:* ${request.namaPegawai} (${request.jabatan} - ${request.unit})
• *Tanggal:* ${request.tanggalMulai} s/d ${request.tanggalSelesai} (${request.jumlahHari})
• *Rincian Pendelegasian / Badal Tugas:* ${
    request.catatanDelegasiTugas || request.keteranganTambahan || 'Mohon bantuan badal/inval tugas selama izin berlangsung.'
  }

🔗 *Lihat Surat Permohonan:* ${deepLinkUrl}

Mohon kesediaan dan bantuannya sebagai *Pegawai Pengganti (Badal/Inval)* selama rentang tanggal tersebut. Atas bantuan dan kerja samanya, saya ucapkan *Jazakumullahu Khairan*.

Wassalamu'alaikum warahmatullahi wabarakatuh.
*${request.namaPegawai}*`;
};

export const generateApprovalResultMessageToApplicant = (
  request: LeaveRequest,
  decision: 'SETUJUI' | 'TOLAK' | 'MINTA REVISI'
): string => {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const deepLinkUrl = buildApprovalDeepLink(request) || appUrl;

  if (decision === 'SETUJUI') {
    return `Assalamu'alaikum warahmatullahi wabarakatuh,

Alhamdulillah, permohonan *${request.jenisPermohonan} (${request.kategoriKeperluan})* Anda telah *DISETUJUI & DITANDATANGANI* oleh Atasan Langsung dan Mudir Unit.

📋 *RINGKASAN SURAT RESMI*
• *No. Surat:* ${request.nomorPermohonan}
• *Nama:* ${request.namaPegawai}
• *Tanggal:* ${request.tanggalMulai} s/d ${request.tanggalSelesai} (${request.jumlahHari})
• *Status:* ✅ DISETUJUI LENGKAP (3 Tanda Tangan)

📄 *Buka & Unduh PDF Resmi (A4):*
👉 ${deepLinkUrl}

Semoga Allah memudahkan urusan Anda.
Wassalamu'alaikum warahmatullahi wabarakatuh.`;
  }

  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Pemberitahuan terkait permohonan *${request.jenisPermohonan}* Anda (*${request.nomorPermohonan}*):
• *Status:* ${request.statusPermohonan}
• *Catatan Pimpinan:* ${request.catatanMudir !== '-' ? request.catatanMudir : request.catatanAtasan || '-'}

👉 *Lihat Detail di Aplikasi:*
${deepLinkUrl}

Wassalamu'alaikum warahmatullahi wabarakatuh.`;
};

export const formatWhatsAppUrl = (phone: string | undefined, messageText: string): string => {
  const encoded = encodeURIComponent(messageText);
  if (!phone || phone === '-' || phone.trim() === '') {
    return `https://wa.me/?text=${encoded}`;
  }
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return `https://wa.me/${cleaned}?text=${encoded}`;
};
