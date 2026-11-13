export type UserRole =
  | 'PEGAWAI'
  | 'ATASAN LANGSUNG'
  | 'MUDIR UNIT'
  | 'ADMIN SDM'
  | 'SUPER ADMIN';

export type LeaveRequestStatus =
  | 'DRAFT'
  | 'MENUNGGU PERSETUJUAN ATASAN'
  | 'MENUNGGU PERSETUJUAN MUDIR'
  | 'DISETUJUI'
  | 'DITOLAK ATASAN'
  | 'DITOLAK MUDIR'
  | 'PERLU REVISI ATASAN'
  | 'PERLU REVISI MUDIR'
  | 'DIARSIPKAN';

export type ApprovalSubStatus =
  | 'BELUM DIPROSES'
  | 'MENUNGGU'
  | 'DISETUJUI'
  | 'DITOLAK'
  | 'REVISI';

export interface Employee {
  idPegawai: string;
  nip: string;
  namaLengkap: string;
  tanggalLahir?: string; // Format ddmmyyyy (digunakan sebagai password login pegawai)
  jenisKelamin: 'Laki-laki' | 'Perempuan';
  bidang: string;
  bagian: string;
  jabatan: string;
  unit: string;
  email: string;
  nomorTelepon: string;
  idAtasanLangsung: string;
  idMudirUnit: string;
  statusKepegawaian: string;
  statusAktif: 'Aktif' | 'Nonaktif';
  tanggalDibuat: string;
  tanggalDiperbarui: string;
}

export interface UserAccount {
  userId: string;
  idPegawai: string;
  namaPengguna: string;
  email: string;
  passwordPlain?: string;
  passwordHash?: string;
  role: UserRole;
  unit: string;
  idAtasan: string;
  idMudir: string;
  statusAkun: 'Aktif' | 'Nonaktif';
  tanggalDibuat: string;
  terakhirLogin: string;
}

export interface LeavePolicy {
  idKategori: string;
  namaKeperluan: string;
  durasi: string;
  minimalPengajuan: string;
  keterangan: string;
  statusAktif: 'Aktif' | 'Nonaktif';
  tanggalDiperbarui: string;
}

export interface LeaveRequest {
  idPermohonan: string;
  nomorPermohonan: string;
  idPegawai: string;
  namaPegawai: string;
  nip?: string;
  bidang: string;
  bagian: string;
  jabatan: string;
  unit: string;
  jenisPermohonan: 'Izin' | 'Cuti' | 'Izin Kondisional/Khusus';
  kategoriKeperluan: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: string;
  alasan: string;
  keteranganTambahan: string;
  lampiran: string;
  tanggalPengajuan: string;
  statusPermohonan: LeaveRequestStatus;
  statusAtasan: ApprovalSubStatus;
  statusMudir: ApprovalSubStatus;
  catatanAtasan: string;
  catatanMudir: string;
  catatanSdm: string;
  urlPdf: string;
  tanggalDisetujui: string;
  tanggalDiarsipkan: string;
  // Signatures & Approver Details
  ttdPemohonUrl?: string;
  ttdAtasanUrl?: string;
  ttdMudirUrl?: string;
  namaAtasan?: string;
  namaMudir?: string;
  waktuTtdPemohon?: string;
  waktuTtdAtasan?: string;
  waktuTtdMudir?: string;
  // Pendelegasian Tugas / Pegawai Pengganti (Badal / Inval)
  idPegawaiPengganti?: string;
  namaPegawaiPengganti?: string;
  noWaPegawaiPengganti?: string;
  catatanDelegasiTugas?: string;
}

export interface PesantrenHoliday {
  tanggal: string; // YYYY-MM-DD
  keterangan: string;
}

export interface ApprovalRecord {
  idPersetujuan: string;
  idPermohonan: string;
  namaPenyetuju: string;
  emailPenyetuju: string;
  rolePenyetuju: UserRole;
  keputusan: 'PENGAJUAN' | 'SETUJUI' | 'TOLAK' | 'MINTA REVISI';
  catatan: string;
  urlTandaTangan: string;
  waktuPersetujuan: string;
}

export interface AppNotification {
  idNotifikasi: string;
  userId: string;
  emailPenerima: string;
  judul: string;
  pesan: string;
  idPermohonan: string;
  statusDibaca: 'BELUM DIBACA' | 'SUDAH DIBACA';
  waktuDibuat: string;
}

export interface DocumentArchive {
  idDokumen: string;
  idPermohonan: string;
  nomorPermohonan: string;
  namaPegawai: string;
  namaFile: string;
  urlGoogleDrive: string;
  jenisDokumen: 'FORMULIR_PDF' | 'LAMPIRAN' | 'TANDA_TANGAN';
  tanggalArsip: string;
}

export interface ActivityLog {
  idLog: string;
  userId: string;
  namaPengguna: string;
  aktivitas: string;
  modul: string;
  idReferensi: string;
  keterangan: string;
  waktuAktivitas: string;
}

export interface SystemSetting {
  namaPengaturan: string;
  nilai: string;
  keterangan: string;
  tanggalDiperbarui: string;
}

export interface DatabaseStatus {
  isInitialized: boolean;
  spreadsheetName: string;
  spreadsheetId: string;
  docFolderId: string;
  signatureFolderId: string;
  pdfArchiveFolderId: string;
  gasWebAppUrl: string;
  connectionMode: 'LOCAL_FALLBACK' | 'GAS_CLOUD';
  sheetsCreated: string[];
  lastSetupTime: string;
}
