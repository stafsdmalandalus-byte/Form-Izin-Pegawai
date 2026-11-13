import * as XLSX from 'xlsx';
import { FullDatabaseStore } from '../services/databaseService';
import { SHEET_HEADERS } from '../data/initialPolicies';

/**
 * Menghasilkan dan mengunduh 1 file Spreadsheet lengkap (.xlsx) bernama:
 * "DATABASE SISTEM IZIN DAN CUTI PEGAWAI AL-ANDALUS.xlsx"
 * yang langsung berisi ke-9 Sheet resmi beserta seluruh header kolom,
 * data awal 16 ketentuan izin/cuti, pengaturan, dan seluruh data operasional saat ini.
 * File ini siap dibuka langsung di Google Sheets / Google Drive tanpa perlu coding manual.
 */
export const downloadFullDatabaseSpreadsheet = (store: FullDatabaseStore): void => {
  const wb = XLSX.utils.book_new();

  // 1. MASTER_PEGAWAI
  const pegawaiRows = store.MASTER_PEGAWAI.map((e) => [
    e.idPegawai,
    e.nip,
    e.namaLengkap,
    e.jenisKelamin,
    e.bidang,
    e.bagian,
    e.jabatan,
    e.unit,
    e.email,
    e.nomorTelepon,
    e.idAtasanLangsung,
    e.idMudirUnit,
    e.statusKepegawaian,
    e.statusAktif,
    e.tanggalDibuat,
    e.tanggalDiperbarui,
  ]);
  const wsPegawai = XLSX.utils.aoa_to_sheet([
    SHEET_HEADERS.MASTER_PEGAWAI,
    ...pegawaiRows,
  ]);
  wsPegawai['!cols'] = SHEET_HEADERS.MASTER_PEGAWAI.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsPegawai, 'MASTER_PEGAWAI');

  // 2. USERS
  const userRows = store.USERS.map((u) => {
    const emp = store.MASTER_PEGAWAI.find(
      (e) => e.idPegawai === u.idPegawai || e.nip === u.idPegawai
    );
    return [
      u.userId,
      u.idPegawai,
      u.namaPengguna,
      u.email,
      u.passwordPlain || emp?.tanggalLahir || '10112026',
      u.role,
      u.unit,
      u.idAtasan,
      u.idMudir,
      u.statusAkun,
      u.tanggalDibuat,
      u.terakhirLogin,
    ];
  });
  const wsUsers = XLSX.utils.aoa_to_sheet([SHEET_HEADERS.USERS, ...userRows]);
  wsUsers['!cols'] = SHEET_HEADERS.USERS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsUsers, 'USERS');

  // 3. PERMOHONAN
  const permohonanRows = store.PERMOHONAN.map((r) => [
    r.idPermohonan,
    r.nomorPermohonan,
    r.idPegawai,
    r.namaPegawai,
    r.bidang,
    r.bagian,
    r.jabatan,
    r.unit,
    r.jenisPermohonan,
    r.kategoriKeperluan,
    r.tanggalMulai,
    r.tanggalSelesai,
    r.jumlahHari,
    r.alasan,
    r.keteranganTambahan,
    r.lampiran,
    r.tanggalPengajuan,
    r.statusPermohonan,
    r.statusAtasan,
    r.statusMudir,
    r.catatanAtasan,
    r.catatanMudir,
    r.catatanSdm,
    r.urlPdf,
    r.tanggalDisetujui,
    r.tanggalDiarsipkan,
  ]);
  const wsPermohonan = XLSX.utils.aoa_to_sheet([
    SHEET_HEADERS.PERMOHONAN,
    ...permohonanRows,
  ]);
  wsPermohonan['!cols'] = SHEET_HEADERS.PERMOHONAN.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsPermohonan, 'PERMOHONAN');

  // 4. KETENTUAN_IZIN_CUTI
  const ketentuanRows = store.KETENTUAN_IZIN_CUTI.map((k) => [
    k.idKategori,
    k.namaKeperluan,
    k.durasi,
    k.minimalPengajuan,
    k.keterangan,
    k.statusAktif,
    k.tanggalDiperbarui,
  ]);
  const wsKetentuan = XLSX.utils.aoa_to_sheet([
    SHEET_HEADERS.KETENTUAN_IZIN_CUTI,
    ...ketentuanRows,
  ]);
  wsKetentuan['!cols'] = [{ wch: 14 }, { wch: 45 }, { wch: 38 }, { wch: 32 }, { wch: 45 }, { wch: 15 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsKetentuan, 'KETENTUAN_IZIN_CUTI');

  // 5. PERSETUJUAN
  const persetujuanRows = store.PERSETUJUAN.map((p) => [
    p.idPersetujuan,
    p.idPermohonan,
    p.namaPenyetuju,
    p.emailPenyetuju,
    p.rolePenyetuju,
    p.keputusan,
    p.catatan,
    p.urlTandaTangan,
    p.waktuPersetujuan,
  ]);
  const wsPersetujuan = XLSX.utils.aoa_to_sheet([
    SHEET_HEADERS.PERSETUJUAN,
    ...persetujuanRows,
  ]);
  wsPersetujuan['!cols'] = SHEET_HEADERS.PERSETUJUAN.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsPersetujuan, 'PERSETUJUAN');

  // 6. NOTIFIKASI
  const notifikasiRows = store.NOTIFIKASI.map((n) => [
    n.idNotifikasi,
    n.userId,
    n.emailPenerima,
    n.judul,
    n.pesan,
    n.idPermohonan,
    n.statusDibaca,
    n.waktuDibuat,
  ]);
  const wsNotifikasi = XLSX.utils.aoa_to_sheet([
    SHEET_HEADERS.NOTIFIKASI,
    ...notifikasiRows,
  ]);
  wsNotifikasi['!cols'] = SHEET_HEADERS.NOTIFIKASI.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(wb, wsNotifikasi, 'NOTIFIKASI');

  // 7. ARSIP_DOKUMEN
  const arsipRows = store.ARSIP_DOKUMEN.map((a) => [
    a.idDokumen,
    a.idPermohonan,
    a.nomorPermohonan,
    a.namaPegawai,
    a.namaFile,
    a.urlGoogleDrive,
    a.jenisDokumen,
    a.tanggalArsip,
  ]);
  const wsArsip = XLSX.utils.aoa_to_sheet([
    SHEET_HEADERS.ARSIP_DOKUMEN,
    ...arsipRows,
  ]);
  wsArsip['!cols'] = SHEET_HEADERS.ARSIP_DOKUMEN.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(wb, wsArsip, 'ARSIP_DOKUMEN');

  // 8. LOG_AKTIVITAS
  const logRows = store.LOG_AKTIVITAS.map((l) => [
    l.idLog,
    l.userId,
    l.namaPengguna,
    l.aktivitas,
    l.modul,
    l.idReferensi,
    l.keterangan,
    l.waktuAktivitas,
  ]);
  const wsLog = XLSX.utils.aoa_to_sheet([
    SHEET_HEADERS.LOG_AKTIVITAS,
    ...logRows,
  ]);
  wsLog['!cols'] = SHEET_HEADERS.LOG_AKTIVITAS.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(wb, wsLog, 'LOG_AKTIVITAS');

  // 9. PENGATURAN
  const pengaturanRows = store.PENGATURAN.map((s) => [
    s.namaPengaturan,
    s.nilai,
    s.keterangan,
    s.tanggalDiperbarui,
  ]);
  const wsPengaturan = XLSX.utils.aoa_to_sheet([
    SHEET_HEADERS.PENGATURAN,
    ...pengaturanRows,
  ]);
  wsPengaturan['!cols'] = [{ wch: 30 }, { wch: 48 }, { wch: 42 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsPengaturan, 'PENGATURAN');

  XLSX.writeFile(wb, 'DATABASE SISTEM IZIN DAN CUTI PEGAWAI AL-ANDALUS.xlsx');
};
