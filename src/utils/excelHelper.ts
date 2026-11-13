import * as XLSX from 'xlsx';
import { Employee, LeavePolicy, LeaveRequest } from '../types';
import { SHEET_HEADERS } from '../data/initialPolicies';
import { normalizeBirthDateToDdMmYyyy } from '../services/databaseService';

export interface ExcelValidationRow {
  rowNumber: number;
  data: Employee;
  isValid: boolean;
  errors: string[];
}

export interface ExcelValidationResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  missingRequiredHeaders: string[];
  rows: ExcelValidationRow[];
}

/**
 * Mengunduh Template Excel Resmi dengan kolom sesuai sheet MASTER_PEGAWAI + Tanggal Lahir (ddmmyyyy)
 */
export const downloadEmployeeExcelTemplate = (): void => {
  const headers = [...SHEET_HEADERS.MASTER_PEGAWAI, 'Tanggal Lahir (ddmmyyyy)'];
  // Baris petunjuk pengisian (tanpa data pegawai fiktif, melainkan panduan format kolom)
  const formatGuideRow = [
    '199001012020011001',
    '199001012020011001',
    '[Isi Nama Lengkap Pegawai]',
    'Laki-laki',
    'Pendidikan & Kurikulum',
    'Pengajaran',
    'Guru / Musyrif',
    'Unit Putra',
    'nama.pegawai@alandalus.sch.id',
    '081234567890',
    '198502022015011001',
    '198003032010011001',
    'Pegawai Tetap',
    'Aktif',
    '2026-01-01',
    '2026-01-01',
    '01011990',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, formatGuideRow]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MASTER_PEGAWAI');
  XLSX.writeFile(wb, 'Template_Import_MASTER_PEGAWAI_AlAndalus.xlsx');
};

/**
 * Mengekspor Data Pegawai dari sheet MASTER_PEGAWAI ke file Excel
 */
export const exportEmployeesToExcel = (employees: Employee[]): void => {
  const headers = SHEET_HEADERS.MASTER_PEGAWAI;
  const rows = employees.map((e) => [
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

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MASTER_PEGAWAI');
  XLSX.writeFile(wb, `Data_MASTER_PEGAWAI_AlAndalus_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Mengekspor Ketentuan Izin Cuti sesuai file Ketentuan_Izin_Cuti_Pegawai.xlsx
 */
export const exportLeavePoliciesToExcel = (policies: LeavePolicy[]): void => {
  const headers = ['No', 'Keperluan Izin/Cuti', 'Durasi', 'Pengajuan Minimal', 'Keterangan', 'Status Aktif'];
  const rows = policies.map((p, i) => [
    i + 1,
    p.namaKeperluan,
    p.durasi,
    p.minimalPengajuan,
    p.keterangan,
    p.statusAktif,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 6 }, { wch: 45 }, { wch: 42 }, { wch: 35 }, { wch: 45 }, { wch: 15 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ketentuan Izin Cuti');
  XLSX.writeFile(wb, 'Ketentuan_Izin_Cuti_Pegawai.xlsx');
};

/**
 * Mengekspor Laporan dan Rekapitulasi Permohonan Izin/Cuti ke Excel (Bagian P)
 */
export const exportLeaveReportToExcel = (requests: LeaveRequest[], employees: Employee[]): void => {
  const empMap = new Map(employees.map((e) => [e.idPegawai, e]));
  const headers = [
    'Nomor Permohonan',
    'Nama Pegawai',
    'NIP',
    'Bidang/Bagian',
    'Jenis Permohonan',
    'Kategori',
    'Tanggal Mulai',
    'Tanggal Selesai',
    'Jumlah Hari',
    'Tanggal Pengajuan',
    'Status',
    'Atasan yang Menyetujui',
    'Mudir yang Menyetujui',
  ];

  const rows = requests.map((r) => {
    const emp = empMap.get(r.idPegawai);
    return [
      r.nomorPermohonan,
      r.namaPegawai,
      r.nip || emp?.nip || '-',
      `${r.bidang} / ${r.bagian}`,
      r.jenisPermohonan,
      r.kategoriKeperluan,
      r.tanggalMulai,
      r.tanggalSelesai,
      r.jumlahHari,
      r.tanggalPengajuan,
      r.statusPermohonan,
      r.namaAtasan || r.statusAtasan,
      r.namaMudir || r.statusMudir,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LAPORAN_IZIN_CUTI');
  XLSX.writeFile(wb, `Laporan_Rekapitulasi_Izin_Cuti_AlAndalus_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Membaca dan memvalidasi file Excel untuk MASTER_PEGAWAI (Bagian F):
 * - Memeriksa kolom wajib
 * - Memeriksa duplikasi NIP (baik di dalam file Excel maupun terhadap database yang ada)
 * - Memeriksa data kosong
 * - Memberikan laporan pratinjau sebelum konfirmasi impor
 */
export const parseAndValidateEmployeeExcel = async (
  file: File,
  existingEmployees: Employee[]
): Promise<ExcelValidationResult> => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const requiredColumns = [
    'NIP',
    'Nama Lengkap',
    'Jenis Kelamin',
    'Bidang',
    'Bagian',
    'Jabatan',
    'Unit',
    'Email',
  ];

  const sheetHeaderRow = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] || [];
  const normalizedHeaders = sheetHeaderRow.map((h) => String(h || '').trim());
  const missingRequiredHeaders = requiredColumns.filter((col) => !normalizedHeaders.includes(col));

  const existingNips = new Set(existingEmployees.map((e) => e.nip.trim().toLowerCase()));
  const existingIds = new Set(existingEmployees.map((e) => e.idPegawai.trim().toLowerCase()));
  const seenNipsInFile = new Set<string>();
  const seenIdsInFile = new Set<string>();

  const now = new Date().toISOString().slice(0, 10);

  const validatedRows: ExcelValidationRow[] = rawRows.map((row, idx) => {
    const errors: string[] = [];
    const getVal = (key: string) => String(row[key] ?? '').trim();

    const nip = getVal('NIP');
    // Jika ID Pegawai dikosongkan atau disamakan dengan NIP, otomatis gunakan NIP sebagai ID Pegawai
    const idPegawai =
      getVal('ID Pegawai') ||
      nip ||
      `PEG-${String(existingEmployees.length + idx + 1).padStart(3, '0')}`;
    const namaLengkap = getVal('Nama Lengkap');
    const jenisKelaminRaw = getVal('Jenis Kelamin');
    const bidang = getVal('Bidang');
    const bagian = getVal('Bagian');
    const jabatan = getVal('Jabatan');
    const unit = getVal('Unit');
    const email = getVal('Email');
    const nomorTelepon = getVal('Nomor Telepon');
    const idAtasanLangsung = getVal('ID Atasan Langsung') || '-';
    const idMudirUnit = getVal('ID Mudir Unit') || '-';
    const statusKepegawaian = getVal('Status Kepegawaian') || 'Pegawai Tetap';
    const statusAktifRaw = getVal('Status Aktif') || 'Aktif';

    if (!nip) errors.push('Kolom NIP wajib diisi (kosong).');
    if (!namaLengkap || namaLengkap.includes('[Isi Nama')) errors.push('Nama Lengkap wajib diisi dengan benar.');
    if (!bidang) errors.push('Kolom Bidang wajib diisi.');
    if (!jabatan) errors.push('Kolom Jabatan wajib diisi.');
    if (!unit) errors.push('Kolom Unit wajib diisi.');
    if (!email || !email.includes('@')) errors.push('Format Email tidak valid atau kosong.');

    if (nip) {
      const nipKey = nip.toLowerCase();
      if (existingNips.has(nipKey)) {
        errors.push(`Duplikasi NIP: "${nip}" sudah terdaftar di database.`);
      }
      if (seenNipsInFile.has(nipKey)) {
        errors.push(`Duplikasi NIP: "${nip}" muncul lebih dari satu kali di dalam file Excel.`);
      }
      seenNipsInFile.add(nipKey);
    }

    const idKey = idPegawai.toLowerCase();
    if (existingIds.has(idKey) || seenIdsInFile.has(idKey)) {
      errors.push(`Duplikasi ID Pegawai: "${idPegawai}" sudah digunakan.`);
    }
    seenIdsInFile.add(idKey);

    const jenisKelamin: 'Laki-laki' | 'Perempuan' =
      jenisKelaminRaw.toLowerCase().startsWith('p') || jenisKelaminRaw.toLowerCase() === 'wanita'
        ? 'Perempuan'
        : 'Laki-laki';

    const statusAktif: 'Aktif' | 'Nonaktif' =
      statusAktifRaw.toLowerCase() === 'nonaktif' ? 'Nonaktif' : 'Aktif';

    const tanggalLahirRaw =
      getVal('Tanggal Lahir (ddmmyyyy)') ||
      getVal('Tanggal Lahir') ||
      getVal('Password (ddmmyyyy)');
    const tanggalLahir = normalizeBirthDateToDdMmYyyy(tanggalLahirRaw, nip);

    const employeeData: Employee = {
      idPegawai,
      nip,
      namaLengkap,
      tanggalLahir: tanggalLahir || '01011995',
      jenisKelamin,
      bidang,
      bagian: bagian || '-',
      jabatan,
      unit,
      email,
      nomorTelepon: nomorTelepon || '-',
      idAtasanLangsung,
      idMudirUnit,
      statusKepegawaian,
      statusAktif,
      tanggalDibuat: getVal('Tanggal Dibuat') || now,
      tanggalDiperbarui: now,
    };

    return {
      rowNumber: idx + 2,
      data: employeeData,
      isValid: errors.length === 0 && missingRequiredHeaders.length === 0,
      errors,
    };
  });

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.length - validCount;

  return {
    totalRows: validatedRows.length,
    validCount,
    invalidCount,
    missingRequiredHeaders,
    rows: validatedRows,
  };
};
