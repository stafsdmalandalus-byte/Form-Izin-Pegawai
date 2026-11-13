import { Employee, LeaveRequest } from '../types';

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
• *Durasi:* ${request.jumlahHari}
• *Alasan:* ${request.alasan}
${statusNote}
📱 *ARAHAN PERSETUJUAN & TANDA TANGAN DI HP:*
1. Silakan buka tautan aplikasi: ${appUrl}
2. Login menggunakan akun *${targetRole}* Anda.
3. Buka menu *Daftar & Persetujuan*, lalu pilih nomor permohonan *${request.nomorPermohonan}*.
4. Klik tombol ${actionButtonName}, pilih *SETUJUI* (atau *MINTA REVISI* / *TOLAK* beserta arahan catatan).
5. Goreskan *Tanda Tangan Digital* langsung di layar HP Anda, lalu klik *Simpan Keputusan*.

Atas perhatian, arahan, dan kebijaksanaannya, saya ucapkan *Jazakumullahu Khairan*.
Wassalamu'alaikum warahmatullahi wabarakatuh.

Hormat saya,
*${request.namaPegawai}*`;
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
