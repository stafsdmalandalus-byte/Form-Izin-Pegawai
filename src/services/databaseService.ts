import {
  ActivityLog,
  AppNotification,
  ApprovalRecord,
  DatabaseStatus,
  DocumentArchive,
  Employee,
  LeavePolicy,
  LeaveRequest,
  SystemSetting,
  UserAccount,
  UserRole,
} from '../types';
import {
  ARSIP_IZIN_ISO_FOLDER_ID,
  ARSIP_IZIN_ISO_FOLDER_NAME,
  ARSIP_IZIN_ISO_FOLDER_URL,
  INITIAL_LEAVE_POLICIES,
  INITIAL_SETTINGS,
  SHEET_NAMES,
} from '../data/initialPolicies';

export {
  ARSIP_IZIN_ISO_FOLDER_ID,
  ARSIP_IZIN_ISO_FOLDER_NAME,
  ARSIP_IZIN_ISO_FOLDER_URL,
};

export const resolveClearArchiveUrl = (rawUrl?: string): string => {
  const clean = String(rawUrl || '').trim();
  if (clean.startsWith('https://drive.google.com/')) {
    return clean;
  }
  return ARSIP_IZIN_ISO_FOLDER_URL;
};

const STORAGE_KEY = 'ALANDALUS_LEAVE_SYSTEM_DB_V1';

export interface FullDatabaseStore {
  status: DatabaseStatus;
  MASTER_PEGAWAI: Employee[];
  USERS: UserAccount[];
  PERMOHONAN: LeaveRequest[];
  KETENTUAN_IZIN_CUTI: LeavePolicy[];
  PERSETUJUAN: ApprovalRecord[];
  NOTIFIKASI: AppNotification[];
  ARSIP_DOKUMEN: DocumentArchive[];
  LOG_AKTIVITAS: ActivityLog[];
  PENGATURAN: SystemSetting[];
}

const nowStr = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Simple deterministic hash for password verification
export const hashPassword = (raw: string): string => {
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0, ch; i < raw.length; i++) {
    ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'SHA256$' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).toUpperCase();
};

// Normalisasi password dari Google Spreadsheet (misal jika angka 0 di depan terpotong oleh Google Sheets: 1011995 -> 01011995)
export const normalizeSpreadsheetPassword = (raw: string): string => {
  const trimmed = String(raw || '').replace(/^'+/, '').trim();
  if (/^\d{7}$/.test(trimmed)) {
    const padded = '0' + trimmed;
    const dd = parseInt(padded.slice(0, 2), 10);
    const mm = parseInt(padded.slice(2, 4), 10);
    const yyyy = parseInt(padded.slice(4, 8), 10);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 1900 && yyyy <= 2100) {
      return padded;
    }
  }
  return trimmed;
};

// Validasi format password ddmmyyyy (tetap menerima password kustom yang diatur Admin di Google Spreadsheet)
export const isValidDdMmYyyyPassword = (raw: string): boolean => {
  const trimmed = raw.trim();
  if (trimmed.length >= 4) return true;
  return false;
};

// Ekstrak otomatis ddmmyyyy jika NIP berformat 18 digit standar (YYYYMMDD...)
export const extractDdMmYyyyFromNip = (nip: string): string => {
  const digits = nip.replace(/\D/g, '');
  if (digits.length >= 8) {
    const yyyy = parseInt(digits.slice(0, 4), 10);
    const mm = parseInt(digits.slice(4, 6), 10);
    const dd = parseInt(digits.slice(6, 8), 10);
    if (yyyy >= 1940 && yyyy <= 2015 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${String(dd).padStart(2, '0')}${String(mm).padStart(2, '0')}${String(yyyy)}`;
    }
  }
  return '';
};

// Normalisasi input Tanggal Lahir / Password
export const normalizeBirthDateToDdMmYyyy = (raw?: string, nip?: string): string => {
  const clean = normalizeSpreadsheetPassword(String(raw || ''));
  if (clean) {
    // Format YYYY-MM-DD atau YYYY/MM/DD
    const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymdMatch) {
      return `${ymdMatch[3].padStart(2, '0')}${ymdMatch[2].padStart(2, '0')}${ymdMatch[1]}`;
    }
    // Format DD-MM-YYYY atau DD/MM/YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[1].padStart(2, '0')}${dmyMatch[2].padStart(2, '0')}${dmyMatch[3]}`;
    }
    return clean;
  }
  if (nip) {
    const fromNip = extractDdMmYyyyFromNip(nip);
    if (fromNip) return fromNip;
  }
  return '';
};

const getDefaultFiveRoleEmployees = (ts: string): Employee[] => [
  {
    idPegawai: '20261110001',
    nip: '20261110001',
    namaLengkap: 'Staf SDM & Penjaminan Mutu',
    tanggalLahir: '10112026',
    jenisKelamin: 'Laki-laki',
    bidang: 'SDM & Penjaminan Mutu',
    bagian: 'Kepegawaian',
    jabatan: 'Admin SDM',
    unit: 'Kantor Pusat Al-Andalus',
    email: 'stafsdm.alandalus@gmail.com',
    nomorTelepon: '081234567801',
    idAtasanLangsung: '-',
    idMudirUnit: '-',
    statusKepegawaian: 'Pegawai Tetap',
    statusAktif: 'Aktif',
    tanggalDibuat: ts,
    tanggalDiperbarui: ts,
  },
  {
    idPegawai: '19950101002',
    nip: '19950101002',
    namaLengkap: 'Akun Role Pegawai (Pemohon)',
    tanggalLahir: '01011995',
    jenisKelamin: 'Laki-laki',
    bidang: 'Pendidikan & Kurikulum',
    bagian: 'Pengajaran',
    jabatan: 'Guru / Musyrif',
    unit: 'Unit Putra',
    email: 'pegawai@alandalus.sch.id',
    nomorTelepon: '081234567802',
    idAtasanLangsung: '19850202003',
    idMudirUnit: '19800303004',
    statusKepegawaian: 'Pegawai Tetap',
    statusAktif: 'Aktif',
    tanggalDibuat: ts,
    tanggalDiperbarui: ts,
  },
  {
    idPegawai: '19850202003',
    nip: '19850202003',
    namaLengkap: 'Akun Role Atasan Langsung (Kepala Bidang)',
    tanggalLahir: '02021985',
    jenisKelamin: 'Laki-laki',
    bidang: 'Pendidikan & Kurikulum',
    bagian: 'Pimpinan Bidang',
    jabatan: 'Kepala Bidang Pendidikan',
    unit: 'Unit Putra',
    email: 'atasan@alandalus.sch.id',
    nomorTelepon: '081234567803',
    idAtasanLangsung: '19800303004',
    idMudirUnit: '19800303004',
    statusKepegawaian: 'Pegawai Tetap',
    statusAktif: 'Aktif',
    tanggalDibuat: ts,
    tanggalDiperbarui: ts,
  },
  {
    idPegawai: '19800303004',
    nip: '19800303004',
    namaLengkap: 'Akun Role Mudir Unit',
    tanggalLahir: '03031980',
    jenisKelamin: 'Laki-laki',
    bidang: 'Pimpinan Unit',
    bagian: 'Mudir',
    jabatan: 'Mudir Unit Putra',
    unit: 'Unit Putra',
    email: 'mudir@alandalus.sch.id',
    nomorTelepon: '081234567804',
    idAtasanLangsung: '-',
    idMudirUnit: '-',
    statusKepegawaian: 'Pegawai Tetap',
    statusAktif: 'Aktif',
    tanggalDibuat: ts,
    tanggalDiperbarui: ts,
  },
  {
    idPegawai: '19750505005',
    nip: '19750505005',
    namaLengkap: 'Super Administrator Sistem',
    tanggalLahir: '05051975',
    jenisKelamin: 'Laki-laki',
    bidang: 'Direktorat',
    bagian: 'Sistem Informasi',
    jabatan: 'Super Admin',
    unit: 'Direktorat Pesantren',
    email: 'superadmin@alandalus.sch.id',
    nomorTelepon: '081234567805',
    idAtasanLangsung: '-',
    idMudirUnit: '-',
    statusKepegawaian: 'Pegawai Tetap',
    statusAktif: 'Aktif',
    tanggalDibuat: ts,
    tanggalDiperbarui: ts,
  },
];

const getDefaultFiveRoleUsers = (ts: string): UserAccount[] => [
  {
    userId: 'USR-001',
    idPegawai: '20261110001',
    namaPengguna: 'Staf SDM & Penjaminan Mutu',
    email: 'stafsdm.alandalus@gmail.com',
    passwordPlain: '10112026',
    passwordHash: hashPassword('10112026'),
    role: 'ADMIN SDM',
    unit: 'Kantor Pusat Al-Andalus',
    idAtasan: '-',
    idMudir: '-',
    statusAkun: 'Aktif',
    tanggalDibuat: ts,
    terakhirLogin: ts,
  },
  {
    userId: 'USR-002',
    idPegawai: '19950101002',
    namaPengguna: 'Akun Role Pegawai (Pemohon)',
    email: 'pegawai@alandalus.sch.id',
    passwordPlain: '01011995',
    passwordHash: hashPassword('01011995'),
    role: 'PEGAWAI',
    unit: 'Unit Putra',
    idAtasan: '19850202003',
    idMudir: '19800303004',
    statusAkun: 'Aktif',
    tanggalDibuat: ts,
    terakhirLogin: ts,
  },
  {
    userId: 'USR-003',
    idPegawai: '19850202003',
    namaPengguna: 'Akun Role Atasan Langsung (Kepala Bidang)',
    email: 'atasan@alandalus.sch.id',
    passwordPlain: '02021985',
    passwordHash: hashPassword('02021985'),
    role: 'ATASAN LANGSUNG',
    unit: 'Unit Putra',
    idAtasan: '19800303004',
    idMudir: '19800303004',
    statusAkun: 'Aktif',
    tanggalDibuat: ts,
    terakhirLogin: ts,
  },
  {
    userId: 'USR-004',
    idPegawai: '19800303004',
    namaPengguna: 'Akun Role Mudir Unit',
    email: 'mudir@alandalus.sch.id',
    passwordPlain: '03031980',
    passwordHash: hashPassword('03031980'),
    role: 'MUDIR UNIT',
    unit: 'Unit Putra',
    idAtasan: '-',
    idMudir: '-',
    statusAkun: 'Aktif',
    tanggalDibuat: ts,
    terakhirLogin: ts,
  },
  {
    userId: 'USR-005',
    idPegawai: '19750505005',
    namaPengguna: 'Super Administrator Sistem',
    email: 'superadmin@alandalus.sch.id',
    passwordPlain: '05051975',
    passwordHash: hashPassword('05051975'),
    role: 'SUPER ADMIN',
    unit: 'Direktorat Pesantren',
    idAtasan: '-',
    idMudir: '-',
    statusAkun: 'Aktif',
    tanggalDibuat: ts,
    terakhirLogin: ts,
  },
];

export const getNextUniqueUserId = (users: UserAccount[]): string => {
  const usedIds = new Set(users.map((u) => String(u.userId || '').trim().toUpperCase()));
  let maxNum = 0;
  users.forEach((u) => {
    const match = String(u.userId || '').match(/(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  });
  let candidateNum = maxNum + 1;
  let candidate = `USR-${String(candidateNum).padStart(3, '0')}`;
  while (usedIds.has(candidate)) {
    candidateNum++;
    candidate = `USR-${String(candidateNum).padStart(3, '0')}`;
  }
  return candidate;
};

export const deduplicateStoreRecords = (store: FullDatabaseStore): FullDatabaseStore => {
  // 1. Deduplikasi MASTER_PEGAWAI berdasarkan idPegawai / nip
  const seenEmpKeys = new Set<string>();
  const uniqueEmployees: Employee[] = [];
  (store.MASTER_PEGAWAI || []).forEach((emp) => {
    const key = `${String(emp.idPegawai || emp.nip || '').trim().toLowerCase()}|${String(
      emp.namaLengkap || ''
    )
      .trim()
      .toLowerCase()}`;
    if (!seenEmpKeys.has(key)) {
      seenEmpKeys.add(key);
      uniqueEmployees.push(emp);
    }
  });

  // 2. Deduplikasi USERS berdasarkan idPegawai / namaPengguna & pastikan setiap userId 100% unik
  const seenPersonKeys = new Set<string>();
  const seenUserIds = new Set<string>();
  const uniqueUsers: UserAccount[] = [];

  (store.USERS || []).forEach((u) => {
    const personKey =
      String(u.idPegawai || '').trim().toLowerCase() ||
      String(u.email || '').trim().toLowerCase() ||
      String(u.namaPengguna || '').trim().toLowerCase();

    if (personKey && seenPersonKeys.has(personKey)) {
      return; // Lewati duplikat akun untuk pegawai yang sama
    }
    if (personKey) seenPersonKeys.add(personKey);

    let finalUserId = String(u.userId || '').trim();
    if (!finalUserId || seenUserIds.has(finalUserId.toUpperCase())) {
      finalUserId = getNextUniqueUserId(uniqueUsers);
    }
    seenUserIds.add(finalUserId.toUpperCase());

    uniqueUsers.push({
      ...u,
      userId: finalUserId,
    });
  });

  store.MASTER_PEGAWAI = uniqueEmployees;
  store.USERS = uniqueUsers;

  // 3. Pastikan semua dokumen yang sudah DISETUJUI / DIARSIPKAN memiliki URL Google Drive yang jelas ke folder "Arsip izin ISO"
  if (Array.isArray(store.PERMOHONAN)) {
    store.PERMOHONAN = store.PERMOHONAN.map((req) => {
      const isApprovedOrArchived =
        req.statusPermohonan === 'DISETUJUI' || req.statusPermohonan === 'DIARSIPKAN';
      if (isApprovedOrArchived) {
        return {
          ...req,
          urlPdf: resolveClearArchiveUrl(req.urlPdf),
        };
      }
      return req;
    });
  }

  if (Array.isArray(store.ARSIP_DOKUMEN)) {
    const seenDocReqIds = new Set<string>();
    const normalizedArchives: DocumentArchive[] = [];
    store.ARSIP_DOKUMEN.forEach((doc) => {
      const key = String(doc.idPermohonan || doc.idDokumen || '').trim();
      if (key && seenDocReqIds.has(key)) return;
      if (key) seenDocReqIds.add(key);
      normalizedArchives.push({
        ...doc,
        urlGoogleDrive: resolveClearArchiveUrl(doc.urlGoogleDrive),
      });
    });

    // Pastikan setiap PERMOHONAN yang berstatus DISETUJUI / DIARSIPKAN tercatat di ARSIP_DOKUMEN (Folder Arsip izin ISO)
    (store.PERMOHONAN || []).forEach((req) => {
      if (
        (req.statusPermohonan === 'DISETUJUI' || req.statusPermohonan === 'DIARSIPKAN') &&
        !seenDocReqIds.has(req.idPermohonan)
      ) {
        seenDocReqIds.add(req.idPermohonan);
        const cleanName = (req.namaPegawai || 'Pegawai')
          .trim()
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .replace(/\s+/g, '-');
        normalizedArchives.unshift({
          idDokumen: `DOC-${String(normalizedArchives.length + 1).padStart(4, '0')}`,
          idPermohonan: req.idPermohonan,
          nomorPermohonan: req.nomorPermohonan,
          namaPegawai: req.namaPegawai,
          namaFile: `${req.nomorPermohonan}_${cleanName}.pdf`,
          urlGoogleDrive: resolveClearArchiveUrl(req.urlPdf),
          jenisDokumen: 'FORMULIR_PDF',
          tanggalArsip: req.tanggalDiarsipkan && req.tanggalDiarsipkan !== '-' ? req.tanggalDiarsipkan : req.tanggalDisetujui !== '-' ? req.tanggalDisetujui : req.tanggalPengajuan,
        });
      }
    });

    store.ARSIP_DOKUMEN = normalizedArchives;
  }

  return store;
};

/**
 * Sinkronisasi antara MASTER_PEGAWAI dan USERS:
 * - Menghormati perubahan password yang dilakukan di sheet USERS maupun MASTER_PEGAWAI.
 * - Jika dipanggil setelah Pull dari Spreadsheet (fromSpreadsheetPull = true),
 *   menghapus akun atau data yang sudah dihapus di Google Spreadsheet.
 */
export const ensureEmployeeUserSync = (
  store: FullDatabaseStore,
  options?: { fromSpreadsheetPull?: boolean }
): FullDatabaseStore => {
  const ts = nowStr();
  let users = [...(store.USERS || [])];
  const employees = [...(store.MASTER_PEGAWAI || [])];

  // Jika ditarik dari Google Spreadsheet dan ada pegawai yang dihapus di MASTER_PEGAWAI,
  // pastikan akun USERS yang terkait dengan pegawai yang dihapus ikut bersih apabila tidak ada lagi di MASTER_PEGAWAI
  if (options?.fromSpreadsheetPull) {
    const validEmpIds = new Set(employees.map((e) => String(e.idPegawai || '').trim().toLowerCase()));
    const validEmpNips = new Set(employees.map((e) => String(e.nip || '').trim().toLowerCase()));
    const validEmpNames = new Set(employees.map((e) => String(e.namaLengkap || '').trim().toLowerCase()));
    const validEmpEmails = new Set(
      employees.map((e) => String(e.email || '').trim().toLowerCase()).filter(Boolean)
    );
    users = users.filter((u) => {
      const uid = String(u.idPegawai || '').trim().toLowerCase();
      const uname = String(u.namaPengguna || '').trim().toLowerCase();
      const uemail = String(u.email || '').trim().toLowerCase();
      return (
        validEmpIds.has(uid) ||
        validEmpNips.has(uid) ||
        validEmpNames.has(uname) ||
        (uemail && validEmpEmails.has(uemail))
      );
    });
  }

  employees.forEach((emp) => {
    const existingIdx = users.findIndex(
      (u) =>
        u.idPegawai === emp.idPegawai ||
        u.idPegawai === emp.nip ||
        u.namaPengguna.trim().toLowerCase() === emp.namaLengkap.trim().toLowerCase() ||
        (emp.email && u.email.trim().toLowerCase() === emp.email.trim().toLowerCase())
    );

    if (existingIdx >= 0) {
      const existingUser = users[existingIdx];
      // Jika dari Spreadsheet Pull, prioritaskan password yang tertulis di sheet USERS (atau Tanggal Lahir di MASTER_PEGAWAI jika diisi)
      if (options?.fromSpreadsheetPull) {
        const userPlain = normalizeSpreadsheetPassword(existingUser.passwordPlain || '');
        const empPlain = normalizeSpreadsheetPassword(emp.tanggalLahir || '');
        const resolvedPlain =
          userPlain || empPlain || extractDdMmYyyyFromNip(emp.nip) || '10112026';

        emp.tanggalLahir = resolvedPlain;
        users[existingIdx] = {
          ...existingUser,
          idPegawai: emp.idPegawai,
          namaPengguna: emp.namaLengkap,
          passwordPlain: resolvedPlain,
          passwordHash: hashPassword(resolvedPlain),
        };
      } else {
        // Perubahan dari dalam Aplikasi (misal Edit Pegawai di Master Data Pegawai)
        const birthPass = normalizeBirthDateToDdMmYyyy(emp.tanggalLahir, emp.nip);
        if (birthPass) {
          emp.tanggalLahir = birthPass;
          users[existingIdx] = {
            ...existingUser,
            idPegawai: emp.idPegawai,
            namaPengguna: emp.namaLengkap,
            passwordPlain: birthPass,
            passwordHash: hashPassword(birthPass),
          };
        }
      }
    } else {
      const birthPass = normalizeBirthDateToDdMmYyyy(emp.tanggalLahir, emp.nip) || '01011995';
      emp.tanggalLahir = birthPass;

      const jabLower = (emp.jabatan || '').toLowerCase();
      let autoRole: UserRole = 'PEGAWAI';
      if (jabLower.includes('mudir')) autoRole = 'MUDIR UNIT';
      else if (
        jabLower.includes('kepala') ||
        jabLower.includes('kabag') ||
        jabLower.includes('kabid') ||
        jabLower.includes('koordinator')
      )
        autoRole = 'ATASAN LANGSUNG';
      else if (jabLower.includes('sdm')) autoRole = 'ADMIN SDM';

      users.push({
        userId: getNextUniqueUserId(users),
        idPegawai: emp.idPegawai,
        namaPengguna: emp.namaLengkap,
        email: emp.email || `${emp.nip}@alandalus.sch.id`,
        passwordPlain: birthPass,
        passwordHash: hashPassword(birthPass),
        role: autoRole,
        unit: emp.unit,
        idAtasan: emp.idAtasanLangsung || '-',
        idMudir: emp.idMudirUnit || '-',
        statusAkun: emp.statusAktif,
        tanggalDibuat: ts,
        terakhirLogin: '-',
      });
    }
  });

  store.MASTER_PEGAWAI = employees;
  store.USERS = users;
  return deduplicateStoreRecords(store);
};

const createInitialStore = (): FullDatabaseStore => {
  const ts = nowStr();
  const bootstrapEmployees = getDefaultFiveRoleEmployees(ts);
  const bootstrapUsers = getDefaultFiveRoleUsers(ts);

  return {
    status: {
      isInitialized: true,
      spreadsheetName: 'DATABASE SISTEM IZIN DAN CUTI PEGAWAI AL-ANDALUS',
      spreadsheetId: 'BELUM_DIKONFIGURASI_PADA_SCRIPT_PROPERTIES',
      docFolderId: 'BELUM_DIKONFIGURASI_PADA_SCRIPT_PROPERTIES',
      signatureFolderId: 'BELUM_DIKONFIGURASI_PADA_SCRIPT_PROPERTIES',
      pdfArchiveFolderId: ARSIP_IZIN_ISO_FOLDER_ID,
      gasWebAppUrl: '',
      connectionMode: 'LOCAL_FALLBACK',
      sheetsCreated: [...SHEET_NAMES],
      lastSetupTime: ts,
    },
    MASTER_PEGAWAI: bootstrapEmployees,
    USERS: bootstrapUsers,
    PERMOHONAN: [],
    KETENTUAN_IZIN_CUTI: [...INITIAL_LEAVE_POLICIES],
    PERSETUJUAN: [],
    NOTIFIKASI: [],
    ARSIP_DOKUMEN: [],
    LOG_AKTIVITAS: [
      {
        idLog: 'LOG-0001',
        userId: 'USR-001',
        namaPengguna: 'Staf SDM & Penjaminan Mutu',
        aktivitas: 'INISIALISASI_DATABASE',
        modul: 'DATABASE',
        idReferensi: 'SETUP-INIT',
        keterangan:
          'Inisialisasi 9 sheet database, sinkronisasi Google Spreadsheet 2 arah, dan 16 ketentuan resmi.',
        waktuAktivitas: ts,
      },
    ],
    PENGATURAN: [...INITIAL_SETTINGS],
  };
};

export const loadDatabase = (): FullDatabaseStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as FullDatabaseStore;
    if (!parsed.KETENTUAN_IZIN_CUTI) {
      parsed.KETENTUAN_IZIN_CUTI = [...INITIAL_LEAVE_POLICIES];
    }
    if (!parsed.MASTER_PEGAWAI) parsed.MASTER_PEGAWAI = [];
    if (!parsed.USERS) parsed.USERS = [];
    if (!parsed.PERMOHONAN) parsed.PERMOHONAN = [];
    if (!parsed.PERSETUJUAN) parsed.PERSETUJUAN = [];
    if (!parsed.NOTIFIKASI) parsed.NOTIFIKASI = [];
    if (!parsed.ARSIP_DOKUMEN) parsed.ARSIP_DOKUMEN = [];
    if (!parsed.LOG_AKTIVITAS) parsed.LOG_AKTIVITAS = [];
    if (!parsed.PENGATURAN) parsed.PENGATURAN = [...INITIAL_SETTINGS];

    // Bersihkan jika ada duplikat userId (mis. USR-003 ganda dari sesi lama) tanpa menimpa password atau mengembalikan data yang dihapus
    deduplicateStoreRecords(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    const initial = createInitialStore();
    return initial;
  }
};

export const saveDatabase = (
  store: FullDatabaseStore,
  options?: { skipCloudPush?: boolean }
): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  if (
    !options?.skipCloudPush &&
    store.status?.gasWebAppUrl &&
    store.status.gasWebAppUrl.startsWith('https://script.google.com/')
  ) {
    syncPushToGasSpreadsheet(store).catch(() => {
      // Tetap tersimpan aman di lokal jika koneksi internet sedang terputus
    });
  }
};

/**
 * Mengirim (Push) seluruh 9 sheet dari Aplikasi ke Google Spreadsheet melalui GAS Web App
 * Menyimpan password dalam bentuk teks terbaca (passwordPlain / tanggalLahir) di kolom Password (ddmmyyyy)
 * agar Admin dapat melihat dan mengganti password langsung dari Google Spreadsheet.
 */
export const syncPushToGasSpreadsheet = async (
  store: FullDatabaseStore,
  overrideGasUrl?: string
): Promise<{ ok: boolean; message: string }> => {
  const url = (overrideGasUrl ?? store.status.gasWebAppUrl ?? '').trim();
  if (!url || !url.startsWith('https://script.google.com/')) {
    return {
      ok: false,
      message: 'URL Web App Google Apps Script belum diisi atau tidak valid.',
    };
  }

  try {
    const usersWithReadablePass = store.USERS.map((u) => {
      const linkedEmp = store.MASTER_PEGAWAI.find(
        (e) =>
          e.idPegawai === u.idPegawai ||
          e.nip === u.idPegawai ||
          (e.email && u.email && e.email.toLowerCase() === u.email.toLowerCase())
      );
      const plain = normalizeSpreadsheetPassword(
        u.passwordPlain || linkedEmp?.tanggalLahir || ''
      );
      return {
        ...u,
        password: plain ? `'${plain}` : u.passwordHash || '',
        passwordPlain: plain,
        passwordHash: plain ? `'${plain}` : u.passwordHash || '',
      };
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'syncPush',
        payload: {
          MASTER_PEGAWAI: store.MASTER_PEGAWAI,
          USERS: usersWithReadablePass,
          PERMOHONAN: store.PERMOHONAN,
          KETENTUAN_IZIN_CUTI: store.KETENTUAN_IZIN_CUTI,
          PERSETUJUAN: store.PERSETUJUAN,
          NOTIFIKASI: store.NOTIFIKASI,
          ARSIP_DOKUMEN: store.ARSIP_DOKUMEN,
          LOG_AKTIVITAS: store.LOG_AKTIVITAS,
          PENGATURAN: store.PENGATURAN,
        },
      }),
    });

    const json = await response.json().catch(() => null);
    if (json && json.success === false) {
      return { ok: false, message: `GAS Error: ${json.error || 'Gagal menulis ke Spreadsheet'}` };
    }
    return {
      ok: true,
      message: 'Seluruh 9 Sheet berhasil disinkronkan (dikirim) ke Google Spreadsheet via GAS.',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `Gagal menghubungi URL Google Apps Script: ${err?.message || 'Periksa izin Deploy Web App (Anyone)'}`,
    };
  }
};

/**
 * Menarik (Pull) seluruh 9 sheet langsung dari Google Spreadsheet melalui GAS Web App.
 * - Jika ada baris yang dihapus di Google Spreadsheet (baik di MASTER_PEGAWAI, USERS, maupun PERMOHONAN),
 *   maka di aplikasi juga otomatis terhapus (100% mengikuti isi Spreadsheet).
 * - Jika password diubah di Google Spreadsheet (di sheet USERS maupun MASTER_PEGAWAI),
 *   maka password baru langsung berlaku di aplikasi.
 */
export const syncPullFromGasSpreadsheet = async (
  gasWebAppUrl: string
): Promise<{ ok: boolean; store: FullDatabaseStore; message: string }> => {
  const current = loadDatabase();
  const cleanUrl = gasWebAppUrl.trim();
  if (!cleanUrl || !cleanUrl.startsWith('https://script.google.com/')) {
    return {
      ok: false,
      store: current,
      message:
        'Masukkan URL Web App Google Apps Script yang valid (https://script.google.com/macros/s/.../exec).',
    };
  }

  try {
    const sep = cleanUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${cleanUrl}${sep}action=syncPull&_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const json = await res.json();
    if (!json || json.success === false) {
      return {
        ok: false,
        store: current,
        message: json?.error || 'Gagal mengambil data dari Google Spreadsheet.',
      };
    }

    const data = json.data || {};
    const ts = nowStr();

    // Deteksi jika ada baris yang sengaja dihapus di sheet USERS oleh Admin di Google Spreadsheet
    const pulledRawUsers: any[] = Array.isArray(data.USERS) ? data.USERS : current.USERS;
    const pulledUserIds = new Set(
      pulledRawUsers.map((u) => String(u.idPegawai || '').trim().toLowerCase()).filter(Boolean)
    );
    const pulledUserEmails = new Set(
      pulledRawUsers.map((u) => String(u.email || '').trim().toLowerCase()).filter(Boolean)
    );
    const pulledUserNames = new Set(
      pulledRawUsers.map((u) => String(u.namaPengguna || '').trim().toLowerCase()).filter(Boolean)
    );

    // Daftar pegawai yang sebelumnya sudah punya akun di USERS lokal, tetapi sekarang dihapus dari sheet USERS di Spreadsheet
    const deletedFromUsersSheet = new Set<string>();
    if (Array.isArray(data.USERS) && current.USERS.length > 0) {
      current.USERS.forEach((oldU) => {
        const oid = String(oldU.idPegawai || '').trim().toLowerCase();
        const oemail = String(oldU.email || '').trim().toLowerCase();
        const oname = String(oldU.namaPengguna || '').trim().toLowerCase();
        const stillInUsers =
          (oid && pulledUserIds.has(oid)) ||
          (oemail && pulledUserEmails.has(oemail)) ||
          (oname && pulledUserNames.has(oname));
        if (!stillInUsers) {
          if (oid) deletedFromUsersSheet.add(oid);
          if (oemail) deletedFromUsersSheet.add(oemail);
          if (oname) deletedFromUsersSheet.add(oname);
        }
      });
    }

    let hadLegacyHashInSpreadsheet = false;

    // Petakan USERS dari Spreadsheet dan dukung perubahan password langsung dari kolom Password di Spreadsheet
    const pulledUsers: UserAccount[] = pulledRawUsers.map((u: any) => {
      const rawCell = String(u.password ?? u.passwordPlain ?? u.passwordHash ?? '').trim();
      const isHash = rawCell.startsWith('SHA256$');
      if (isHash) hadLegacyHashInSpreadsheet = true;
      const normalizedPlain = isHash ? '' : normalizeSpreadsheetPassword(rawCell);

      const prevUser = current.USERS.find(
        (cu) =>
          cu.userId === u.userId ||
          cu.idPegawai === u.idPegawai ||
          (cu.email && u.email && cu.email.toLowerCase() === String(u.email).toLowerCase())
      );
      const prevEmp = current.MASTER_PEGAWAI.find(
        (ce) =>
          ce.idPegawai === u.idPegawai ||
          ce.nip === u.idPegawai ||
          (ce.email && u.email && ce.email.toLowerCase() === String(u.email).toLowerCase())
      );

      const finalPlain =
        normalizedPlain ||
        prevUser?.passwordPlain ||
        prevEmp?.tanggalLahir ||
        extractDdMmYyyyFromNip(String(u.idPegawai || '')) ||
        '10112026';

      const finalHash = hashPassword(finalPlain);

      return {
        ...u,
        passwordPlain: finalPlain,
        passwordHash: finalHash,
      } as UserAccount;
    });

    // Petakan MASTER_PEGAWAI persis seperti yang ada di Spreadsheet (dan hapus juga jika barisnya dihapus di USERS)
    const rawEmployeesList: any[] = Array.isArray(data.MASTER_PEGAWAI)
      ? data.MASTER_PEGAWAI
      : current.MASTER_PEGAWAI;

    const pulledEmployees: Employee[] = rawEmployeesList
      .filter((emp: any) => {
        const eid = String(emp.idPegawai || '').trim().toLowerCase();
        const enip = String(emp.nip || '').trim().toLowerCase();
        const eemail = String(emp.email || '').trim().toLowerCase();
        const ename = String(emp.namaLengkap || '').trim().toLowerCase();
        if (
          (eid && deletedFromUsersSheet.has(eid)) ||
          (enip && deletedFromUsersSheet.has(enip)) ||
          (eemail && deletedFromUsersSheet.has(eemail)) ||
          (ename && deletedFromUsersSheet.has(ename))
        ) {
          return false;
        }
        return true;
      })
      .map((emp: any) => {
        const matchingU = pulledUsers.find(
          (u) =>
            u.idPegawai === emp.idPegawai ||
            u.idPegawai === emp.nip ||
            u.namaPengguna?.trim().toLowerCase() === emp.namaLengkap?.trim().toLowerCase() ||
            (emp.email &&
              u.email &&
              u.email.trim().toLowerCase() === String(emp.email).trim().toLowerCase())
        );
        const rawEmpPass =
          emp.tanggalLahir ||
          emp['Tanggal Lahir (ddmmyyyy)'] ||
          emp['Tanggal Lahir'] ||
          emp['Password'] ||
          '';
        // Prioritaskan password dari sheet USERS (matchingU.passwordPlain) atau kolom Tanggal Lahir di MASTER_PEGAWAI
        const empBirth = normalizeSpreadsheetPassword(
          matchingU?.passwordPlain || rawEmpPass || ''
        );
        return {
          ...emp,
          tanggalLahir: empBirth || extractDdMmYyyyFromNip(emp.nip || '') || '01011995',
        } as Employee;
      });

    const nextStore: FullDatabaseStore = {
      ...current,
      status: {
        ...current.status,
        isInitialized: true,
        gasWebAppUrl: cleanUrl,
        connectionMode: 'GAS_CLOUD',
        spreadsheetId: data.spreadsheetId || current.status.spreadsheetId,
        spreadsheetName: data.spreadsheetName || current.status.spreadsheetName,
        lastSetupTime: ts,
      },
      MASTER_PEGAWAI: pulledEmployees,
      USERS: pulledUsers,
      PERMOHONAN: Array.isArray(data.PERMOHONAN) ? data.PERMOHONAN : current.PERMOHONAN,
      KETENTUAN_IZIN_CUTI: Array.isArray(data.KETENTUAN_IZIN_CUTI)
        ? data.KETENTUAN_IZIN_CUTI
        : current.KETENTUAN_IZIN_CUTI,
      PERSETUJUAN: Array.isArray(data.PERSETUJUAN) ? data.PERSETUJUAN : current.PERSETUJUAN,
      NOTIFIKASI: Array.isArray(data.NOTIFIKASI) ? data.NOTIFIKASI : current.NOTIFIKASI,
      ARSIP_DOKUMEN: Array.isArray(data.ARSIP_DOKUMEN) ? data.ARSIP_DOKUMEN : current.ARSIP_DOKUMEN,
      LOG_AKTIVITAS: Array.isArray(data.LOG_AKTIVITAS) ? data.LOG_AKTIVITAS : current.LOG_AKTIVITAS,
      PENGATURAN: Array.isArray(data.PENGATURAN) ? data.PENGATURAN : current.PENGATURAN,
    };

    ensureEmployeeUserSync(nextStore, { fromSpreadsheetPull: true });
    // Simpan ke localStorage; jika di Spreadsheet tadi masih ada SHA256$ lama atau ada penghapusan timpang, sinkronkan balik agar kolom Password di Spreadsheet berubah jadi angka terbaca
    saveDatabase(nextStore, { skipCloudPush: !hadLegacyHashInSpreadsheet && deletedFromUsersSheet.size === 0 });

    return {
      ok: true,
      store: nextStore,
      message: `Berhasil menarik & menyinkronkan data terbaru dari Google Spreadsheet (${nextStore.MASTER_PEGAWAI.length} Pegawai, ${nextStore.USERS.length} Akun User, ${nextStore.PERMOHONAN.length} Permohonan). Data yang dihapus atau password yang diubah di Spreadsheet telah diterapkan.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      store: current,
      message: `Gagal menarik data dari Google Apps Script: ${err?.message || 'Pastikan Web App di-deploy dengan akses Anyone (Siapa saja).'}`,
    };
  }
};

// Server-side Role Permission Validator (Section R & S)
export const validatePermission = (
  actor: UserAccount | null,
  allowedRoles: UserRole[]
): { valid: boolean; message?: string } => {
  if (!actor) {
    return {
      valid: false,
      message: 'Akses ditolak: Sesi pengguna tidak ditemukan. Silakan login kembali.',
    };
  }
  if (actor.statusAkun !== 'Aktif') {
    return { valid: false, message: 'Akses ditolak: Akun pengguna berstatus Nonaktif.' };
  }
  if (actor.role === 'SUPER ADMIN') {
    return { valid: true };
  }
  if (!allowedRoles.includes(actor.role)) {
    return {
      valid: false,
      message: `Akses ditolak: Role Anda (${actor.role}) tidak memiliki wewenang untuk tindakan ini.`,
    };
  }
  return { valid: true };
};

// Record Activity Log
export const recordActivity = (
  store: FullDatabaseStore,
  actor: UserAccount,
  aktivitas: string,
  modul: string,
  idReferensi: string,
  keterangan: string
): void => {
  const nextNum = store.LOG_AKTIVITAS.length + 1;
  const log: ActivityLog = {
    idLog: `LOG-${String(nextNum).padStart(4, '0')}`,
    userId: actor.userId,
    namaPengguna: actor.namaPengguna,
    aktivitas,
    modul,
    idReferensi,
    keterangan,
    waktuAktivitas: nowStr(),
  };
  store.LOG_AKTIVITAS.unshift(log);
};

// Create In-App Notification
export const createNotification = (
  store: FullDatabaseStore,
  targetUserId: string,
  targetEmail: string,
  judul: string,
  pesan: string,
  idPermohonan: string
): void => {
  const nextNum = store.NOTIFIKASI.length + 1;
  const notif: AppNotification = {
    idNotifikasi: `NTF-${String(nextNum).padStart(4, '0')}`,
    userId: targetUserId,
    emailPenerima: targetEmail,
    judul,
    pesan,
    idPermohonan,
    statusDibaca: 'BELUM DIBACA',
    waktuDibuat: nowStr(),
  };
  store.NOTIFIKASI.unshift(notif);
};

// Generate Unique Request Number: AIS-IZC-2026-0001
export const generateRequestNumber = (store: FullDatabaseStore): string => {
  const year = new Date().getFullYear();
  const existingNumbers = store.PERMOHONAN.map((p) => p.nomorPermohonan).filter((n) =>
    n.startsWith(`AIS-IZC-${year}-`)
  );
  let maxSeq = 0;
  existingNumbers.forEach((num) => {
    const parts = num.split('-');
    const seq = parseInt(parts[3], 10);
    if (!isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  });
  return `AIS-IZC-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
};

// Setup Database (Idempotent as required by Section D)
export const setupDatabaseEngine = (
  actor: UserAccount,
  customGasUrl?: string,
  customIds?: {
    spreadsheetId?: string;
    docFolderId?: string;
    signatureFolderId?: string;
    pdfArchiveFolderId?: string;
  }
): { store: FullDatabaseStore; message: string; alreadyExisted: boolean } => {
  const store = loadDatabase();
  const check = validatePermission(actor, ['ADMIN SDM', 'SUPER ADMIN']);
  if (!check.valid) {
    throw new Error(check.message);
  }

  const alreadyExisted = store.status.isInitialized;
  const ts = nowStr();

  store.status.isInitialized = true;
  store.status.spreadsheetName = 'DATABASE SISTEM IZIN DAN CUTI PEGAWAI AL-ANDALUS';
  store.status.sheetsCreated = [...SHEET_NAMES];
  store.status.lastSetupTime = ts;

  if (customGasUrl !== undefined) {
    store.status.gasWebAppUrl = customGasUrl.trim();
    store.status.connectionMode = customGasUrl.trim() ? 'GAS_CLOUD' : 'LOCAL_FALLBACK';
  }

  if (customIds) {
    if (customIds.spreadsheetId) store.status.spreadsheetId = customIds.spreadsheetId.trim();
    if (customIds.docFolderId) store.status.docFolderId = customIds.docFolderId.trim();
    if (customIds.signatureFolderId)
      store.status.signatureFolderId = customIds.signatureFolderId.trim();
    if (customIds.pdfArchiveFolderId)
      store.status.pdfArchiveFolderId = customIds.pdfArchiveFolderId.trim();
  }

  if (store.KETENTUAN_IZIN_CUTI.length === 0) {
    store.KETENTUAN_IZIN_CUTI = [...INITIAL_LEAVE_POLICIES];
  }
  if (store.PENGATURAN.length === 0) {
    store.PENGATURAN = [...INITIAL_SETTINGS];
  }

  recordActivity(
    store,
    actor,
    'SETUP_DATABASE',
    'DATABASE',
    store.status.spreadsheetName,
    alreadyExisted
      ? 'Verifikasi setupDatabase(): Database sudah tersedia, menggunakan database yang sudah ada tanpa membuat duplikat.'
      : 'Menjalankan setupDatabase() pertama kali: Membuat 9 sheet dan struktur folder Google Drive.'
  );

  saveDatabase(store, { skipCloudPush: true });
  return {
    store,
    alreadyExisted,
    message: alreadyExisted
      ? 'Konfigurasi koneksi Google Apps Script berhasil disimpan.'
      : 'Database "DATABASE SISTEM IZIN DAN CUTI PEGAWAI AL-ANDALUS" beserta 9 sheet berhasil diinisialisasi.',
  };
};

// Role-filtered Leave Requests
export const getVisibleLeaveRequests = (
  store: FullDatabaseStore,
  actor: UserAccount
): LeaveRequest[] => {
  if (actor.role === 'ADMIN SDM' || actor.role === 'SUPER ADMIN') {
    return store.PERMOHONAN;
  }
  if (actor.role === 'PEGAWAI') {
    return store.PERMOHONAN.filter((r) => r.idPegawai === actor.idPegawai);
  }
  if (actor.role === 'ATASAN LANGSUNG') {
    const subordinateIds = new Set(
      store.MASTER_PEGAWAI.filter((e) => e.idAtasanLangsung === actor.idPegawai).map(
        (e) => e.idPegawai
      )
    );
    store.USERS.filter(
      (u) => u.idAtasan === actor.idPegawai || u.idAtasan === actor.userId
    ).forEach((u) => subordinateIds.add(u.idPegawai));
    return store.PERMOHONAN.filter(
      (r) => r.idPegawai === actor.idPegawai || subordinateIds.has(r.idPegawai)
    );
  }
  if (actor.role === 'MUDIR UNIT') {
    const mudirSubordinateIds = new Set(
      store.MASTER_PEGAWAI.filter(
        (e) => e.idMudirUnit === actor.idPegawai || e.unit === actor.unit
      ).map((e) => e.idPegawai)
    );
    store.USERS.filter(
      (u) => u.idMudir === actor.idPegawai || u.idMudir === actor.userId
    ).forEach((u) => mudirSubordinateIds.add(u.idPegawai));
    return store.PERMOHONAN.filter(
      (r) =>
        r.idPegawai === actor.idPegawai ||
        (mudirSubordinateIds.has(r.idPegawai) && r.statusPermohonan !== 'DRAFT')
    );
  }
  return [];
};

export const getTimestamp = nowStr;
