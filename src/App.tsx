import React, { useState, useEffect, useMemo } from 'react';
import {
  LeaveRequest,
  UserAccount,
} from './types';
import {
  FullDatabaseStore,
  getNextUniqueUserId,
  getTimestamp,
  hashPassword,
  loadDatabase,
  mergeLeaveRequests,
  recordActivity,
  saveDatabase,
  syncFromServerStore,
  syncPullFromGasSpreadsheet,
} from './services/databaseService';
import { decodeLeaveRequestFromUrl } from './utils/messageShareHelper';
import { DashboardView } from './components/DashboardView';
import { LeaveRequestFormView } from './components/LeaveRequestFormView';
import { ApprovalWorkflowView } from './components/ApprovalWorkflowView';
import { MasterDataPegawaiView } from './components/MasterDataPegawaiView';
import { ArchiveReportsPoliciesView } from './components/ArchiveReportsPoliciesView';
import { SystemDatabaseBackendView } from './components/SystemDatabaseBackendView';
import { OfficialFormModal } from './components/OfficialFormModal';
import { AL_ANDALUS_LOGO_PATH } from './utils/pdfGenerator';
import {
  LayoutDashboard,
  FilePlus2,
  CheckSquare,
  Users,
  Archive,
  FileBarChart2,
  BookOpen,
  Bell,
  Database,
  LogOut,
  Menu,
  X,
  Lock,
  ShieldCheck,
  CheckCheck,
  Search,
  Clock,
  LogIn,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  KeyRound,
} from 'lucide-react';

type ActiveMenu =
  | 'dashboard'
  | 'permohonan_baru'
  | 'persetujuan'
  | 'master_pegawai'
  | 'ketentuan'
  | 'arsip'
  | 'laporan'
  | 'notifikasi'
  | 'database_backend';

function getInitials(name: string): string {
  const parts = name
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'AA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatWibClock(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return `${formatter.format(date).replace(/:/g, '.')} WIB`;
  } catch {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}.${m}.${s} WIB`;
  }
}

const SESSION_STORAGE_KEY = 'SIM_SDM_ALANDALUS_SESSION_V1';

function loadSavedSession(users: UserAccount[]): { user: UserAccount; isAdminSdm: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; idPegawai?: string; isAdminSdm?: boolean };
    if (!parsed || (!parsed.userId && !parsed.idPegawai)) return null;
    const found = users.find(
      (u) =>
        u.statusAkun === 'Aktif' &&
        ((parsed.userId && u.userId === parsed.userId) ||
          (parsed.idPegawai && u.idPegawai === parsed.idPegawai))
    );
    if (!found) return null;
    return {
      user: found,
      isAdminSdm: Boolean(parsed.isAdminSdm) || found.role === 'ADMIN SDM',
    };
  } catch {
    return null;
  }
}

function saveUserSession(user: UserAccount | null, isAdminSdm: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (!user) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          userId: user.userId,
          idPegawai: user.idPegawai,
          isAdminSdm,
        })
      );
    }
  } catch {
    // ignore storage quota errors
  }
}

export function App() {
  const [store, setStore] = useState<FullDatabaseStore>(() => {
    const initial = loadDatabase();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const decodedFromUrl = decodeLeaveRequestFromUrl(params.get('d'));
      if (decodedFromUrl) {
        initial.PERMOHONAN = mergeLeaveRequests(initial.PERMOHONAN || [], [decodedFromUrl]);
        saveDatabase(initial, { skipCloudPush: true });
      }
    }
    return initial;
  });

  // Tautan Cepat Persetujuan 1-Klik dari WhatsApp (?req=REQ-...&d=...)
  const [deepLinkReqId, setDeepLinkReqId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const reqParam = params.get('req');
    if (reqParam) return reqParam;
    const decoded = decodeLeaveRequestFromUrl(params.get('d'));
    return decoded?.idPermohonan || null;
  });

  const initialSession = useMemo(() => loadSavedSession(store.USERS), []);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(
    () => initialSession?.user || null
  );
  const [isAdminSdmSession, setIsAdminSdmSession] = useState<boolean>(
    () => initialSession?.isAdminSdm || false
  );

  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(() =>
    deepLinkReqId && initialSession?.user ? 'persetujuan' : 'dashboard'
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [previewPdfRequest, setPreviewPdfRequest] = useState<LeaveRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);

  // State Modal Ubah Password Mandiri oleh Pegawai
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [oldPassInput, setOldPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [changePassMsg, setChangePassMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Jam WIB Live di Halaman Depan
  const [wibTime, setWibTime] = useState<string>(() => formatWibClock(new Date()));

  // Login Screen Form States (1. Ketik Nama Pegawai -> muncul Nama & Jabatan dari MASTER_PEGAWAI, 2. Password Tanggal Lahir ddmmyyyy)
  const [loginNameQuery, setLoginNameQuery] = useState('');
  const [selectedLoginEmployeeId, setSelectedLoginEmployeeId] = useState<string>('');
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setWibTime(formatWibClock(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simpan ke localStorage saja saat state berubah (jangan auto-push ke Google Spreadsheet saat baru buka halaman agar tidak menimpa editan/hapusan di Spreadsheet)
  useEffect(() => {
    saveDatabase(store, { skipCloudPush: true });
  }, [store]);

  // Tarik otomatis dari Shared Server Store (/api/store) & Google Spreadsheet saat aplikasi dibuka & setiap kali pengguna kembali ke tab aplikasi (focus)
  useEffect(() => {
    const pullLatestData = async () => {
      const serverMerged = await syncFromServerStore();
      if (serverMerged) {
        setStore(serverMerged);
      }
      const latestLocal = serverMerged || loadDatabase();
      const gasUrl = latestLocal.status?.gasWebAppUrl;
      if (gasUrl && gasUrl.startsWith('https://script.google.com/')) {
        syncPullFromGasSpreadsheet(gasUrl).then((res) => {
          if (res.ok) {
            setStore(res.store);
          }
        });
      }
    };

    pullLatestData();
    window.addEventListener('focus', pullLatestData);
    return () => window.removeEventListener('focus', pullLatestData);
  }, []);

  // Pencarian langsung (live autocomplete) dari Daftar Pegawai (MASTER_PEGAWAI)
  const matchingEmployees = useMemo(() => {
    const q = loginNameQuery.trim().toLowerCase();
    const activeEmployees = store.MASTER_PEGAWAI.filter((e) => e.statusAktif === 'Aktif');
    if (!q) return [];
    return activeEmployees.filter(
      (e) =>
        e.namaLengkap.toLowerCase().includes(q) ||
        e.jabatan.toLowerCase().includes(q)
    );
  }, [store.MASTER_PEGAWAI, loginNameQuery]);

  // Pegawai yang sedang terpilih di form Login (dari klik dropdown, kecocokan persis, atau hasil tunggal pencarian)
  const selectedLoginEmployee = useMemo(() => {
    if (selectedLoginEmployeeId) {
      const byId = store.MASTER_PEGAWAI.find((e) => e.idPegawai === selectedLoginEmployeeId);
      if (byId) return byId;
    }
    const q = loginNameQuery.trim().toLowerCase();
    if (!q) return null;
    const exact = store.MASTER_PEGAWAI.find(
      (e) => e.statusAktif === 'Aktif' && e.namaLengkap.trim().toLowerCase() === q
    );
    if (exact) return exact;
    if (matchingEmployees.length === 1) {
      return matchingEmployees[0];
    }
    return null;
  }, [store.MASTER_PEGAWAI, selectedLoginEmployeeId, loginNameQuery, matchingEmployees]);

  const unreadNotifCount = useMemo(() => {
    if (!currentUser) return 0;
    return store.NOTIFIKASI.filter(
      (n) =>
        (n.userId === currentUser.userId ||
          n.emailPenerima.toLowerCase() === currentUser.email.toLowerCase()) &&
        n.statusDibaca === 'BELUM DIBACA'
    ).length;
  }, [store.NOTIFIKASI, currentUser]);

  const myNotifications = useMemo(() => {
    if (!currentUser) return [];
    return store.NOTIFIKASI.filter(
      (n) =>
        n.userId === currentUser.userId ||
        n.emailPenerima.toLowerCase() === currentUser.email.toLowerCase() ||
        currentUser.role === 'ADMIN SDM' ||
        currentUser.role === 'SUPER ADMIN'
    );
  }, [store.NOTIFIKASI, currentUser]);

  const verifyEmployeeCredentials = (
    activeStore: FullDatabaseStore,
    qName: string,
    empId: string,
    cleanPass: string
  ) => {
    // Cari pegawai berdasarkan ID yang dipilih, nama persis, atau kandidat pertama yang cocok
    let targetEmployee =
      activeStore.MASTER_PEGAWAI.find(
        (emp) =>
          (empId && emp.idPegawai === empId) ||
          emp.namaLengkap.trim().toLowerCase() === qName
      ) || null;

    if (!targetEmployee && qName.length >= 2) {
      const candidates = activeStore.MASTER_PEGAWAI.filter(
        (emp) =>
          emp.statusAktif === 'Aktif' &&
          emp.namaLengkap.toLowerCase().includes(qName)
      );
      if (candidates.length === 1) {
        targetEmployee = candidates[0];
      } else if (candidates.length > 1) {
        // Coba cek apakah salah satu kandidat cocok password-nya
        for (const cand of candidates) {
          const check = checkPasswordForEmployee(activeStore, cand, cleanPass);
          if (check.matched) {
            targetEmployee = cand;
            break;
          }
        }
        if (!targetEmployee) {
          targetEmployee = candidates[0];
        }
      }
    }

    if (!targetEmployee) {
      return {
        ok: false as const,
        reason: 'NOT_FOUND' as const,
        message:
          'Nama pegawai tidak ditemukan. Ketik nama Anda lalu pilih dari daftar saran yang muncul.',
      };
    }

    if (targetEmployee.statusAktif !== 'Aktif') {
      return {
        ok: false as const,
        reason: 'INACTIVE' as const,
        message: 'Status kepegawaian Anda Nonaktif. Silakan hubungi bagian SDM.',
      };
    }

    const passCheck = checkPasswordForEmployee(activeStore, targetEmployee, cleanPass);
    if (!passCheck.matched) {
      return {
        ok: false as const,
        reason: 'WRONG_PASSWORD' as const,
        targetEmployee,
        message: `Password untuk "${targetEmployee.namaLengkap}" tidak sesuai. Gunakan tanggal lahir (ddmmyyyy) atau password terbaru dari Admin SDM.`,
      };
    }

    return {
      ok: true as const,
      targetEmployee,
      matchedUser: passCheck.matchedUser,
      paddedInput: passCheck.paddedInput,
      paddedInputHash: passCheck.paddedInputHash,
    };
  };

  const checkPasswordForEmployee = (
    activeStore: FullDatabaseStore,
    targetEmployee: FullDatabaseStore['MASTER_PEGAWAI'][number],
    cleanPass: string
  ) => {
    const matchedUser = activeStore.USERS.find(
      (u) =>
        u.idPegawai === targetEmployee.idPegawai ||
        u.idPegawai === targetEmployee.nip ||
        u.namaPengguna.trim().toLowerCase() === targetEmployee.namaLengkap.trim().toLowerCase() ||
        (targetEmployee.email &&
          u.email.trim().toLowerCase() === targetEmployee.email.trim().toLowerCase())
    );

    const paddedInput = /^\d{7}$/.test(cleanPass) ? '0' + cleanPass : cleanPass;
    const inputHash = hashPassword(cleanPass);
    const paddedInputHash = hashPassword(paddedInput);

    const empBirthDate = (targetEmployee.tanggalLahir || '').replace(/^'+/, '').trim();
    const userPlainPass = (matchedUser?.passwordPlain || '').replace(/^'+/, '').trim();

    const isBirthMatch =
      empBirthDate !== '' && (cleanPass === empBirthDate || paddedInput === empBirthDate);
    const isPlainMatch =
      userPlainPass !== '' && (cleanPass === userPlainPass || paddedInput === userPlainPass);
    const isHashMatch = matchedUser?.passwordHash
      ? matchedUser.passwordHash === inputHash ||
        matchedUser.passwordHash === paddedInputHash ||
        matchedUser.passwordHash.replace(/^'+/, '') === cleanPass ||
        matchedUser.passwordHash.replace(/^'+/, '') === paddedInput
      : false;

    return {
      matched: isBirthMatch || isPlainMatch || isHashMatch,
      matchedUser,
      paddedInput,
      paddedInputHash,
    };
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const qName = loginNameQuery.trim().toLowerCase();
    if (!qName && !selectedLoginEmployeeId) {
      setLoginError('Silakan ketik dan pilih Nama Pegawai terlebih dahulu.');
      return;
    }

    const cleanPass = loginPassword.trim();
    if (!cleanPass) {
      setLoginError('Silakan masukkan Password / Tanggal Lahir (ddmmyyyy) terlebih dahulu.');
      return;
    }

    setIsLoggingIn(true);

    try {
      let activeStore = store;
      // 1. Cek secara instan di data lokal terlebih dahulu agar respons login cepat (<50ms)
      let verification = verifyEmployeeCredentials(
        activeStore,
        qName,
        selectedLoginEmployeeId,
        cleanPass
      );

      // 2. Jika gagal di lokal (misal baru ganti password di Google Spreadsheet), tarik cepat dari Spreadsheet (batas waktu 2.5 detik)
      const gasUrl = store.status?.gasWebAppUrl;
      if (!verification.ok && gasUrl && gasUrl.startsWith('https://script.google.com/')) {
        const pullWithTimeout = Promise.race([
          syncPullFromGasSpreadsheet(gasUrl),
          new Promise<{ ok: false; store: FullDatabaseStore; message: string }>((resolve) =>
            setTimeout(
              () => resolve({ ok: false, store: activeStore, message: 'Timeout' }),
              2500
            )
          ),
        ]);
        const pulled = await pullWithTimeout;
        if (pulled.ok) {
          activeStore = pulled.store;
          setStore(pulled.store);
          verification = verifyEmployeeCredentials(
            activeStore,
            qName,
            selectedLoginEmployeeId,
            cleanPass
          );
        }
      } else if (gasUrl && gasUrl.startsWith('https://script.google.com/')) {
        // Sinkronisasi latar belakang tanpa memblokir tombol login
        syncPullFromGasSpreadsheet(gasUrl).then((res) => {
          if (res.ok) setStore(res.store);
        });
      }

      if (!verification.ok) {
        setLoginError(verification.message);
        setIsLoggingIn(false);
        return;
      }

      const { targetEmployee, matchedUser, paddedInput, paddedInputHash } = verification;
      const ts = getTimestamp();
      const updatedStore = { ...activeStore };

      let activeUserAccount: UserAccount;
      if (matchedUser) {
        activeUserAccount = {
          ...matchedUser,
          idPegawai: targetEmployee.idPegawai,
          namaPengguna: targetEmployee.namaLengkap,
          terakhirLogin: ts,
        };
        updatedStore.USERS = updatedStore.USERS.map((u) =>
          u.userId === matchedUser.userId ? activeUserAccount : u
        );
      } else {
        activeUserAccount = {
          userId: getNextUniqueUserId(updatedStore.USERS),
          idPegawai: targetEmployee.idPegawai,
          namaPengguna: targetEmployee.namaLengkap,
          email: targetEmployee.email || `${targetEmployee.nip}@alandalus.sch.id`,
          passwordPlain: paddedInput,
          passwordHash: paddedInputHash,
          role: 'PEGAWAI',
          unit: targetEmployee.unit,
          idAtasan: targetEmployee.idAtasanLangsung || '-',
          idMudir: targetEmployee.idMudirUnit || '-',
          statusAkun: 'Aktif',
          tanggalDibuat: ts,
          terakhirLogin: ts,
        };
        updatedStore.USERS = [...updatedStore.USERS, activeUserAccount];
      }

      recordActivity(
        updatedStore,
        activeUserAccount,
        'LOGIN_BERHASIL',
        'AUTH',
        targetEmployee.nip,
        `Pegawai ${targetEmployee.namaLengkap} (${activeUserAccount.role}) berhasil login.`
      );

      saveDatabase(updatedStore);
      setStore(updatedStore);
      const isAdmin = activeUserAccount.role === 'ADMIN SDM';
      setCurrentUser(activeUserAccount);
      setIsAdminSdmSession(isAdmin);
      saveUserSession(activeUserAccount, isAdmin);
      setLoginPassword('');
      setShowNameDropdown(false);
      // Jika login dari tautan cepat WhatsApp (?req=...), langsung buka menu Persetujuan & fokus suratnya
      if (deepLinkReqId) {
        setActiveMenu('persetujuan');
      } else {
        setActiveMenu('dashboard');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Ubah Password Mandiri oleh Pegawai (Langsung tersinkron ke sheet USERS & MASTER_PEGAWAI di Google Spreadsheet)
  const handleSaveMyNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassMsg(null);
    if (!currentUser) return;

    const cleanOld = oldPassInput.trim();
    const cleanNew = newPassInput.trim();
    const cleanConfirm = confirmPassInput.trim();

    if (!cleanOld || !cleanNew) {
      setChangePassMsg({
        type: 'error',
        text: 'Mohon isi password saat ini dan password baru.',
      });
      return;
    }

    if (cleanNew.length < 4) {
      setChangePassMsg({
        type: 'error',
        text: 'Password baru minimal terdiri dari 4 karakter/angka.',
      });
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setChangePassMsg({
        type: 'error',
        text: 'Konfirmasi password baru tidak cocok.',
      });
      return;
    }

    const linkedEmp = store.MASTER_PEGAWAI.find(
      (emp) =>
        emp.idPegawai === currentUser.idPegawai ||
        emp.nip === currentUser.idPegawai ||
        emp.namaLengkap.trim().toLowerCase() === currentUser.namaPengguna.trim().toLowerCase()
    );

    if (linkedEmp) {
      const check = checkPasswordForEmployee(store, linkedEmp, cleanOld);
      if (!check.matched) {
        setChangePassMsg({
          type: 'error',
          text: 'Password saat ini / Tanggal Lahir tidak sesuai.',
        });
        return;
      }
    }

    const newHash = hashPassword(cleanNew);
    const updatedStore: FullDatabaseStore = {
      ...store,
      USERS: store.USERS.map((u) =>
        u.userId === currentUser.userId
          ? { ...u, passwordPlain: cleanNew, passwordHash: newHash }
          : u
      ),
      MASTER_PEGAWAI: store.MASTER_PEGAWAI.map((emp) =>
        linkedEmp && emp.idPegawai === linkedEmp.idPegawai
          ? { ...emp, tanggalLahir: cleanNew }
          : emp
      ),
    };

    const updatedUser: UserAccount = {
      ...currentUser,
      passwordPlain: cleanNew,
      passwordHash: newHash,
    };

    recordActivity(
      updatedStore,
      updatedUser,
      'UBAH_PASSWORD_MANDIRI',
      'AUTH',
      updatedUser.userId,
      `Pegawai ${updatedUser.namaPengguna} memperbarui password akun secara mandiri (tersinkron ke Spreadsheet).`
    );

    saveDatabase(updatedStore);
    setStore(updatedStore);
    setCurrentUser(updatedUser);
    setOldPassInput('');
    setNewPassInput('');
    setConfirmPassInput('');
    setChangePassMsg({
      type: 'success',
      text: 'Alhamdulillah, password baru Anda berhasil disimpan dan disinkronkan ke Google Spreadsheet.',
    });
  };

  // Khusus Admin SDM: Pindah ke mode pegawai lain secara langsung tanpa perlu memasukkan Tanggal Lahir
  const handleRequestSwitchAccount = (userId: string) => {
    if (!currentUser || (currentUser.role !== 'ADMIN SDM' && !isAdminSdmSession)) return;
    const target = store.USERS.find((u) => u.userId === userId);
    if (!target) return;
    if (target.userId === currentUser.userId) return;

    const ts = getTimestamp();
    const updatedStore = { ...store };
    updatedStore.USERS = updatedStore.USERS.map((u) =>
      u.userId === target.userId ? { ...u, terakhirLogin: ts } : u
    );

    recordActivity(
      updatedStore,
      target,
      'GANTI_SESI_LOGIN_ADMIN_SDM',
      'AUTH',
      target.userId,
      `Admin SDM beralih ke mode pegawai ${target.namaPengguna} (${target.role}) tanpa password.`
    );

    setStore(updatedStore);
    const switchedUser = { ...target, terakhirLogin: ts };
    setCurrentUser(switchedUser);
    saveUserSession(switchedUser, true);
    setActiveMenu('dashboard');
  };

  const handleMarkNotificationRead = (idNotifikasi: string) => {
    const updatedStore = { ...store };
    updatedStore.NOTIFIKASI = updatedStore.NOTIFIKASI.map((n) =>
      n.idNotifikasi === idNotifikasi ? { ...n, statusDibaca: 'SUDAH DIBACA' } : n
    );
    setStore(updatedStore);
  };

  const handleMarkAllNotificationsRead = () => {
    if (!currentUser) return;
    const updatedStore = { ...store };
    updatedStore.NOTIFIKASI = updatedStore.NOTIFIKASI.map((n) =>
      n.userId === currentUser.userId ||
      n.emailPenerima.toLowerCase() === currentUser.email.toLowerCase()
        ? { ...n, statusDibaca: 'SUDAH DIBACA' }
        : n
    );
    setStore(updatedStore);
  };

  const deepLinkedRequestObj = useMemo(() => {
    if (!deepLinkReqId) return null;
    const fromStore =
      store.PERMOHONAN.find(
        (r) =>
          r.idPermohonan === deepLinkReqId || r.nomorPermohonan === deepLinkReqId
      ) || null;
    if (fromStore) return fromStore;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return decodeLeaveRequestFromUrl(params.get('d'));
    }
    return null;
  }, [store.PERMOHONAN, deepLinkReqId]);

  // Buka langsung surat & halaman tanda tangan dari tautan WhatsApp Atasan Langsung / Mudir Unit
  const handleQuickOpenDeepLinkedApproval = () => {
    const targetReq = deepLinkedRequestObj || store.PERMOHONAN[0] || null;
    const nextStore = { ...store };
    if (
      targetReq &&
      !nextStore.PERMOHONAN.some((r) => r.idPermohonan === targetReq.idPermohonan)
    ) {
      nextStore.PERMOHONAN = [targetReq, ...nextStore.PERMOHONAN];
    }

    const isWaitingMudir = targetReq?.statusPermohonan === 'MENUNGGU PERSETUJUAN MUDIR';
    const targetRole = isWaitingMudir ? 'MUDIR UNIT' : 'ATASAN LANGSUNG';

    // Jika pejabat sudah mengetik/memilih namanya di kotak pencarian, gunakan profil pegawai tersebut
    let approverAccount: UserAccount | undefined;
    if (selectedLoginEmployee) {
      approverAccount = nextStore.USERS.find(
        (u) =>
          u.idPegawai === selectedLoginEmployee.idPegawai ||
          u.namaPengguna.toLowerCase() === selectedLoginEmployee.namaLengkap.toLowerCase()
      );
      if (approverAccount) {
        approverAccount = {
          ...approverAccount,
          role:
            approverAccount.role === 'PEGAWAI'
              ? targetRole
              : approverAccount.role,
        };
      }
    }

    if (!approverAccount) {
      approverAccount =
        nextStore.USERS.find((u) => u.role === targetRole) ||
        nextStore.USERS.find((u) => u.role === 'ADMIN SDM') ||
        nextStore.USERS[0];
    }

    if (approverAccount) {
      saveDatabase(nextStore);
      setStore(nextStore);
      setCurrentUser(approverAccount);
      if (targetReq) {
        setDeepLinkReqId(targetReq.idPermohonan);
      }
      setActiveMenu('persetujuan');
    }
  };

  // ===========================================================================
  // TAMPILAN LOGIN RESPONSIF (HP & LAPTOP) DENGAN TEMA WHATSAPP WEB & MOBILE
  // ===========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen wa-chat-bg relative flex flex-col justify-between">
        {/* Pita Hijau Atas Khas WhatsApp Web (#00a884 / #008069) */}
        <div className="h-44 sm:h-52 bg-gradient-to-r from-[#008069] via-[#00a884] to-[#008069] w-full absolute top-0 left-0 z-0 shadow-xs" />

        {/* Kontainer Utama Login: 1 Kolom Ergonomis di HP, 2 Kolom Proporsional di Laptop */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-3.5 sm:px-6 py-3 sm:py-6">
          <div className="w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-[#d1d7db] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* PANEL KIRI (IDENTITAS RESMI PESANTREN AL-ANDALUS & PANDUAN WHATSAPP) */}
            <div className="lg:col-span-5 bg-gradient-to-b from-[#008069] via-[#0b6b53] to-[#075e54] text-white p-5 sm:p-7 flex flex-col justify-between border-b-4 lg:border-b-0 lg:border-r-4 border-[#d4a017]">
              <div className="text-center lg:text-left">
                {/* Logo Resmi Pesantren Islam Internasional Al-Andalus */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl border-[2.5px] border-[#eab308] shadow-md mx-auto lg:mx-0 flex items-center justify-center p-1.5 mb-3.5">
                  <img
                    src={AL_ANDALUS_LOGO_PATH}
                    alt="Logo Pesantren Islam Internasional Al-Andalus"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain select-none"
                  />
                </div>

                <h1 className="text-base sm:text-lg lg:text-xl font-extrabold tracking-wide text-white uppercase leading-snug">
                  SISTEM INFORMASI PERMOHONAN IZIN & CUTI PEGAWAI
                </h1>
                <p className="text-[11px] sm:text-xs font-bold tracking-widest text-[#facc15] uppercase mt-1">
                  PESANTREN ISLAM INTERNASIONAL AL-ANDALUS
                </p>

                {/* Alur Singkat (Tampil di Laptop & Tablet) */}
                <div className="hidden sm:block mt-5 pt-4 border-t border-white/15 space-y-2.5 text-left text-xs text-white/90">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#25D366] text-[#111b21] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <strong className="text-white block">Ketik & Pilih Nama Pegawai</strong>
                      <span className="text-white/80 text-[11px]">
                        Otomatis menampilkan Nama Lengkap & Jabatan Anda.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#25D366] text-[#111b21] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="text-white block">Masukkan Password / Tanggal Lahir</strong>
                      <span className="text-white/80 text-[11px]">
                        Format default <code className="font-mono text-[#facc15]">ddmmyyyy</code> atau sesuai Spreadsheet.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#25D366] text-[#111b21] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <strong className="text-white block">Ajukan & Teruskan ke WhatsApp</strong>
                      <span className="text-white/80 text-[11px]">
                        Tanda tangan digital & cetak surat resmi A4 <code className="font-mono text-[#facc15]">AIS-FRM-SEK.02.11</code>.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden lg:flex items-center justify-between pt-5 mt-5 border-t border-white/15 text-[11px] text-white/80">
                <span>Divisi SDM & Penjaminan Mutu</span>
                <span className="font-mono text-[#facc15]">AIS-FRM-SEK.02.11</span>
              </div>
            </div>

            {/* PANEL KANAN (JENDELA CHAT LOGIN WHATSAPP RESPONSIF) */}
            <div className="lg:col-span-7 flex flex-col bg-[#efeae2]/60">
              {/* Header Bar Jendela Chat ala WhatsApp */}
              <div className="bg-[#f0f2f5] px-4 sm:px-6 py-3 border-b border-[#d1d7db] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-[#111b21]">
                      Masuk Akun Pegawai
                    </h2>
                    <p className="text-[11px] text-[#54656f]">
                      Ketik nama Anda, pilih jabatan, lalu masukkan password
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#008069] font-semibold hidden sm:inline">
                  {store.MASTER_PEGAWAI.filter((e) => e.statusAktif === 'Aktif').length} Pegawai Aktif
                </span>
              </div>

              {/* Body Form di Atas Kanvas WhatsApp */}
              <div className="p-4 sm:p-6 flex-1 flex flex-col justify-center space-y-4">
                {/* Gelembung Kuning Info Singkat ala Enkripsi WhatsApp */}
                <div className="bg-[#fff5c4] border border-[#e6daa6] rounded-xl px-3.5 py-2 text-[11px] sm:text-xs text-[#54656f] text-center shadow-2xs">
                  🔒 Gunakan <strong>Nama Pegawai</strong> terdaftar dan <strong>Password / Tanggal Lahir (ddmmyyyy)</strong> untuk masuk.
                </div>

                <form
                  onSubmit={handleLoginSubmit}
                  className="bg-white border border-[#d1d7db] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4"
                >
                  {loginError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 font-medium flex items-start justify-between gap-2">
                      <span>{loginError}</span>
                      <button
                        type="button"
                        onClick={() => setLoginError(null)}
                        className="text-red-700 hover:text-red-950 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* INPUT 1: NAMA PEGAWAI */}
                  <div className="relative">
                    <label
                      htmlFor="login-employee-name"
                      className="block text-xs sm:text-sm font-bold text-[#111b21] mb-1.5"
                    >
                      Nama Pegawai
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#54656f] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-employee-name"
                        type="text"
                        autoComplete="off"
                        value={loginNameQuery}
                        onFocus={() => setShowNameDropdown(true)}
                        onKeyDown={(e) => {
                          if (!showNameDropdown || matchingEmployees.length === 0) return;
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setHighlightedIndex((prev) =>
                              prev + 1 < matchingEmployees.length ? prev + 1 : 0
                            );
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setHighlightedIndex((prev) =>
                              prev - 1 >= 0 ? prev - 1 : matchingEmployees.length - 1
                            );
                          } else if (e.key === 'Enter' && !selectedLoginEmployee) {
                            const chosen = matchingEmployees[highlightedIndex] || matchingEmployees[0];
                            if (chosen) {
                              e.preventDefault();
                              setLoginNameQuery(chosen.namaLengkap);
                              setSelectedLoginEmployeeId(chosen.idPegawai);
                              setShowNameDropdown(false);
                              setLoginError(null);
                            }
                          }
                        }}
                        onChange={(e) => {
                          setLoginNameQuery(e.target.value);
                          setSelectedLoginEmployeeId('');
                          setHighlightedIndex(0);
                          setShowNameDropdown(true);
                          setLoginError(null);
                        }}
                        placeholder="Ketik nama pegawai..."
                        className="w-full min-h-[46px] pl-10 pr-10 py-2.5 text-sm sm:text-base bg-[#f0f2f5] border border-[#d1d7db] rounded-xl text-[#111b21] placeholder:text-[#667781] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-[#00a884] transition-all"
                      />
                      {loginNameQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setLoginNameQuery('');
                            setSelectedLoginEmployeeId('');
                            setShowNameDropdown(false);
                            setLoginError(null);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#54656f] hover:text-[#111b21] rounded-full hover:bg-slate-200/70"
                          title="Hapus ketikan nama"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Autocomplete saat mengetik nama: cukup muncul Nama & Jabatan (tanpa NIP/NIY) */}
                    {showNameDropdown && loginNameQuery.trim().length > 0 && (
                      <div className="mt-1.5 w-full bg-white border border-[#d1d7db] rounded-xl shadow-lg max-h-56 overflow-y-auto z-30 divide-y divide-[#f0f2f5]">
                        {matchingEmployees.length === 0 ? (
                          <div className="p-3.5 text-xs text-red-800 bg-red-50">
                            <strong>Nama tidak ditemukan di Daftar Pegawai.</strong>
                            <div className="text-[11px] text-red-700 mt-0.5">
                              Pastikan ejaan nama sesuai atau hubungi Admin SDM.
                            </div>
                          </div>
                        ) : (
                          matchingEmployees.map((emp, idx) => {
                            const isSelected =
                              selectedLoginEmployee?.idPegawai === emp.idPegawai ||
                              idx === highlightedIndex;
                            return (
                              <button
                                key={`${emp.idPegawai}-${idx}`}
                                type="button"
                                onMouseDown={(e) => {
                                  // Gunakan onMouseDown agar di HP maupun Laptop pilihan langsung tereksekusi sebelum input blur
                                  e.preventDefault();
                                  setLoginNameQuery(emp.namaLengkap);
                                  setSelectedLoginEmployeeId(emp.idPegawai);
                                  setShowNameDropdown(false);
                                  setLoginError(null);
                                }}
                                onClick={() => {
                                  setLoginNameQuery(emp.namaLengkap);
                                  setSelectedLoginEmployeeId(emp.idPegawai);
                                  setShowNameDropdown(false);
                                  setLoginError(null);
                                }}
                                className={`w-full text-left px-3.5 py-2.5 min-h-[48px] flex items-center justify-between gap-3 transition-colors ${
                                  isSelected ? 'bg-[#d9fdd3]/70' : 'hover:bg-[#f0f2f5]'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-full bg-[#008069] text-white font-bold text-xs flex items-center justify-center shrink-0">
                                    {getInitials(emp.namaLengkap)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs sm:text-sm font-bold text-[#111b21] truncate">
                                      {emp.namaLengkap}
                                    </div>
                                    <div className="text-[11px] text-[#54656f] truncate">
                                      {emp.jabatan}
                                    </div>
                                  </div>
                                </div>
                                <CheckCheck className="w-4 h-4 text-[#00a884] shrink-0" />
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* Gelembung Hijau WhatsApp (#d9fdd3) saat Nama Pegawai Terpilih */}
                    {selectedLoginEmployee && !showNameDropdown && (
                      <div className="mt-2 p-2.5 rounded-xl bg-[#d9fdd3] border border-[#b7f0ad] flex items-center justify-between gap-3 text-xs shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#008069] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                            {getInitials(selectedLoginEmployee.namaLengkap)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[#111b21] text-xs sm:text-sm truncate">
                              {selectedLoginEmployee.namaLengkap}
                            </div>
                            <div className="text-[#54656f] text-[11px] truncate">
                              {selectedLoginEmployee.jabatan}
                            </div>
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-[#008069] shrink-0" />
                      </div>
                    )}
                  </div>

                  {/* INPUT 2: PASSWORD */}
                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs sm:text-sm font-bold text-[#111b21] mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#54656f] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onFocus={() => setShowNameDropdown(false)}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          setLoginError(null);
                        }}
                        placeholder="Password / Tanggal Lahir (ddmmyyyy)"
                        className="w-full min-h-[46px] pl-10 pr-11 py-2.5 text-sm sm:text-base font-mono tracking-wider bg-[#f0f2f5] border border-[#d1d7db] rounded-xl text-[#111b21] placeholder:text-[#667781] placeholder:font-sans placeholder:tracking-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-[#00a884] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#54656f] hover:text-[#111b21] rounded-full hover:bg-slate-200/70"
                        title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* TOMBOL MASUK WHATSAPP (SELALU AKTIF & RESPONSIF) */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full min-h-[48px] py-3 px-5 text-sm sm:text-base font-bold text-white bg-[#00a884] hover:bg-[#008069] active:scale-[0.99] disabled:opacity-70 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      {isLoggingIn ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Memverifikasi & Masuk...</span>
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          <span>Masuk ke Aplikasi</span>
                        </>
                      )}
                    </button>
                    <p className="text-center text-[11px] sm:text-xs text-[#54656f] mt-3">
                      Apabila gagal login silakan menghubungi Admin SDM Pesantren Al-Andalus
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Singkat Halaman Login */}
        <div className="relative z-10 text-center py-2.5 px-4 text-[11px] text-[#54656f]">
          Pesantren Islam Internasional Al-Andalus · Formulir Resmi AIS-FRM-SEK.02.11 Rev. 1
        </div>
      </div>
    );
  }

  // Filter menu berdasarkan Role Pengguna (dengan subtitle ala daftar chat WhatsApp)
  const navItems: {
    id: ActiveMenu;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    roles: string[];
    badge?: number;
  }[] = [
    {
      id: 'dashboard',
      label: 'Beranda & Chat Pengajuan',
      subtitle: 'Ringkasan status & gelembung riwayat izin/cuti',
      icon: <LayoutDashboard className="w-4 h-4" />,
      roles: ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN'],
    },
    {
      id: 'permohonan_baru',
      label: 'Kirim Permohonan Baru',
      subtitle: 'Formulir izin, cuti & tanda tangan digital',
      icon: <FilePlus2 className="w-4 h-4" />,
      roles: ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN'],
    },
    {
      id: 'persetujuan',
      label: 'Persetujuan & Disposisi',
      subtitle: 'Verifikasi Atasan Langsung & Mudir Unit',
      icon: <CheckSquare className="w-4 h-4" />,
      roles: ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN'],
    },
    {
      id: 'master_pegawai',
      label: 'Kontak Master Pegawai',
      subtitle: 'Database NIP/NIY, Tanggal Lahir & jabatan',
      icon: <Users className="w-4 h-4" />,
      roles: ['ADMIN SDM', 'SUPER ADMIN'],
    },
    {
      id: 'ketentuan',
      label: 'Ketentuan Izin & Cuti',
      subtitle: '16 aturan resmi Pesantren Al-Andalus',
      icon: <BookOpen className="w-4 h-4" />,
      roles: ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN'],
    },
    {
      id: 'arsip',
      label: 'Arsip Dokumen PDF',
      subtitle: 'Formulir resmi AIS-FRM-SEK.02.11 Rev. 1',
      icon: <Archive className="w-4 h-4" />,
      roles: ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN'],
    },
    {
      id: 'laporan',
      label: 'Laporan & Rekap SDM',
      subtitle: 'Ekspor rekapitulasi bulanan & tahunan',
      icon: <FileBarChart2 className="w-4 h-4" />,
      roles: ['ADMIN SDM', 'SUPER ADMIN'],
    },
    {
      id: 'notifikasi',
      label: 'Pesan Notifikasi Masuk',
      subtitle: 'Pemberitahuan persetujuan & status dokumen',
      icon: <Bell className="w-4 h-4" />,
      roles: ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN'],
      badge: unreadNotifCount,
    },
    {
      id: 'database_backend',
      label: 'Google Sheets & Koneksi',
      subtitle: 'Sinkronisasi 2 arah Spreadsheet (9 Sheet)',
      icon: <Database className="w-4 h-4" />,
      roles: ['ADMIN SDM', 'SUPER ADMIN'],
    },
  ];

  const allowedNavItems = navItems.filter((item) => item.roles.includes(currentUser.role));
  const currentMenuMeta =
    allowedNavItems.find((i) => i.id === activeMenu) || allowedNavItems[0];

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#efeae2] wa-chat-bg flex flex-col lg:flex-row">
      {/* OVERLAY MOBILE DRAWER */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* SIDEBAR KIRI GAYA DAFTAR CHAT WHATSAPP WEB */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[85vw] max-w-80 lg:w-80 xl:w-88 bg-white border-r border-[#d1d7db] flex flex-col justify-between transition-transform duration-200 lg:static lg:h-full lg:translate-x-0 shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header Profil Pengguna Sidebar Kiri ala WhatsApp Web (#f0f2f5) */}
          <div className="bg-[#f0f2f5] px-4 py-3 border-b border-[#d1d7db] flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#008069] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {getInitials(currentUser.namaPengguna)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#111b21] truncate">
                  {currentUser.namaPengguna}
                </div>
                <div className="text-[11px] text-[#54656f] truncate">
                  {currentUser.role} · {currentUser.unit}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-2 text-[#54656f] hover:text-[#111b21] rounded-full hover:bg-[#d1d7db]/40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-bar Identitas Pesantren dengan Logo Resmi Al-Andalus */}
          <div className="px-3.5 py-2.5 bg-[#f8f9fa] border-b border-[#e9edef] flex items-center justify-between text-[11px] text-[#54656f]">
            <div className="flex items-center gap-2 truncate">
              <img
                src={AL_ANDALUS_LOGO_PATH}
                alt="Logo Al-Andalus"
                referrerPolicy="no-referrer"
                className="w-4 h-5 object-contain shrink-0"
              />
              <span className="font-bold text-[#008069] truncate">
                SIM Izin & Cuti Al-Andalus
              </span>
            </div>
            <span className="font-mono text-[10px] text-[#667781] tabular-nums">{wibTime}</span>
          </div>

          {/* Daftar Menu Gaya Chat List WhatsApp */}
          <nav className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5]">
            {allowedNavItems.map((item) => {
              const isActive = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'permohonan_baru') {
                      setEditingRequest(null);
                    }
                    setActiveMenu(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-3 flex items-center justify-between gap-3 transition-colors ${
                    isActive
                      ? 'bg-[#e9edef] border-l-4 border-[#00a884]'
                      : 'bg-white hover:bg-[#f5f6f6]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'bg-[#00a884] text-white shadow-2xs'
                          : 'bg-[#f0f2f5] text-[#54656f]'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-xs truncate ${
                          isActive
                            ? 'font-bold text-[#008069]'
                            : 'font-semibold text-[#111b21]'
                        }`}
                      >
                        {item.label}
                      </div>
                      <div className="text-[11px] text-[#667781] truncate flex items-center gap-1 mt-0.5">
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                        <span className="truncate">{item.subtitle}</span>
                      </div>
                    </div>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="min-w-5 h-5 px-1.5 text-[10px] font-mono font-bold bg-[#25D366] text-white rounded-full flex items-center justify-center shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Sidebar Kiri: Beralih Mode Pegawai (Khusus ADMIN SDM, Langsung Tanpa Tanggal Lahir), Ubah Password & Keluar */}
        <div className="p-3.5 bg-[#f0f2f5] border-t border-[#d1d7db] space-y-2 text-xs">
          {(currentUser.role === 'ADMIN SDM' || isAdminSdmSession) && (
            <div>
              <label className="block text-[11px] font-semibold text-[#54656f] mb-1">
                Pindah Mode Pegawai / Role (Khusus Admin SDM):
              </label>
              <select
                value={currentUser.userId}
                onChange={(e) => handleRequestSwitchAccount(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-white text-[#111b21] border border-[#d1d7db] rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#00a884]"
              >
                {store.USERS.map((u, idx) => (
                  <option key={`${u.userId}-${idx}`} value={u.userId}>
                    {u.namaPengguna} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setChangePassMsg(null);
                setShowChangePassModal(true);
                setMobileSidebarOpen(false);
              }}
              className="min-h-[38px] flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold text-[#008069] bg-white border border-[#d1d7db] hover:bg-[#d9fdd3]/50 rounded-lg transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Ubah Password
            </button>

            <button
              type="button"
              onClick={() => {
                saveUserSession(null, false);
                setIsAdminSdmSession(false);
                setCurrentUser(null);
              }}
              className="min-h-[38px] flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-bold text-red-700 bg-white border border-[#d1d7db] hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar Sesi
            </button>
          </div>
        </div>
      </aside>

      {/* AREA CHAT / KONTEN UTAMA KANAN (SCROLL INDEPENDEN DI LAPTOP) */}
      <div className="flex-1 flex flex-col min-w-0 lg:h-full lg:overflow-y-auto pb-16 lg:pb-0">
        {/* TOP HEADER BAR KHAS WHATSAPP (#008069) */}
        <header className="bg-[#008069] text-white px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 shadow-xs sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 text-white/95 hover:text-white rounded-full hover:bg-white/10"
              aria-label="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-white/15 border border-white/30 flex items-center justify-center shrink-0">
              {currentMenuMeta?.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold tracking-tight text-white truncate">
                {currentMenuMeta?.label || 'SIM Izin & Cuti Al-Andalus'}
              </div>
              <div className="text-[11px] text-white/85 truncate">
                {currentUser.namaPengguna} · {currentUser.role} ({currentUser.unit})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingRequest(null);
                setActiveMenu('permohonan_baru');
              }}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#25D366] hover:bg-[#1da851] text-[#111b21] rounded-full transition-colors shadow-2xs"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>Ajukan Izin/Cuti</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChangePassMsg(null);
                setShowChangePassModal(true);
              }}
              className="p-2 text-white/90 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              title="Ubah Password Saya"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveMenu('notifikasi')}
              className="relative p-2 text-white/90 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              title="Pesan Notifikasi"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 text-[10px] font-mono font-bold bg-[#25D366] text-[#111b21] rounded-full">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAdminSdmSession(false);
                setCurrentUser(null);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors"
              title="Keluar Sesi"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* VIEWPORT KONTEN DINAMIS DI ATAS KANVAS CHAT WHATSAPP */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto">
          {activeMenu === 'dashboard' && (
            <DashboardView
              store={store}
              currentUser={currentUser}
              onNavigateNewRequest={() => {
                setEditingRequest(null);
                setActiveMenu('permohonan_baru');
              }}
              onNavigateMasterPegawai={() => setActiveMenu('master_pegawai')}
              onPreviewOfficialPdf={(req) => setPreviewPdfRequest(req)}
              onEditRevisionRequest={(req) => {
                setEditingRequest(req);
                setActiveMenu('permohonan_baru');
              }}
            />
          )}

          {activeMenu === 'permohonan_baru' && (
            <LeaveRequestFormView
              store={store}
              currentUser={currentUser}
              editingRequest={editingRequest}
              onStoreUpdate={setStore}
              onSuccessNavigate={() => {
                setEditingRequest(null);
                setActiveMenu('persetujuan');
              }}
            />
          )}

          {activeMenu === 'persetujuan' && (
            <ApprovalWorkflowView
              store={store}
              currentUser={currentUser}
              onStoreUpdate={setStore}
              onPreviewOfficialPdf={(req) => setPreviewPdfRequest(req)}
              onEditRevisionRequest={(req) => {
                setEditingRequest(req);
                setActiveMenu('permohonan_baru');
              }}
              initialFocusRequestId={deepLinkReqId}
              onClearFocusRequest={() => setDeepLinkReqId(null)}
            />
          )}

          {activeMenu === 'master_pegawai' && (
            <MasterDataPegawaiView
              store={store}
              currentUser={currentUser}
              onStoreUpdate={setStore}
            />
          )}

          {activeMenu === 'ketentuan' && (
            <ArchiveReportsPoliciesView
              mode="ketentuan"
              store={store}
              currentUser={currentUser}
              onStoreUpdate={setStore}
              onPreviewOfficialPdf={(req) => setPreviewPdfRequest(req)}
            />
          )}

          {activeMenu === 'arsip' && (
            <ArchiveReportsPoliciesView
              mode="arsip"
              store={store}
              currentUser={currentUser}
              onStoreUpdate={setStore}
              onPreviewOfficialPdf={(req) => setPreviewPdfRequest(req)}
            />
          )}

          {activeMenu === 'laporan' && (
            <ArchiveReportsPoliciesView
              mode="laporan"
              store={store}
              currentUser={currentUser}
              onStoreUpdate={setStore}
              onPreviewOfficialPdf={(req) => setPreviewPdfRequest(req)}
            />
          )}

          {activeMenu === 'notifikasi' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              {/* Banner Kuning ala Pesan Sistem WhatsApp */}
              <div className="bg-[#fff5c4] border border-[#e6daa6] rounded-xl px-4 py-2.5 text-center text-xs text-[#54656f] shadow-2xs">
                🔒 Pesan notifikasi pengajuan izin, persetujuan Atasan Langsung, dan keputusan Mudir Unit tercatat otomatis di Sheet <strong>NOTIFIKASI</strong>.
              </div>

              <div className="bg-white border border-[#d1d7db] rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div>
                  <h2 className="text-sm font-bold text-[#111b21]">
                    Riwayat Pesan Notifikasi Masuk ({myNotifications.length})
                  </h2>
                  <p className="text-xs text-[#667781]">
                    Klik Tandai Dibaca untuk mengubah centang menjadi biru (✓✓).
                  </p>
                </div>
                {unreadNotifCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-full shadow-2xs"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Tandai Semua Dibaca
                  </button>
                )}
              </div>

              {myNotifications.length === 0 ? (
                <div className="bg-white border border-[#d1d7db] rounded-xl p-8 text-center text-xs text-[#667781]">
                  Belum ada pesan notifikasi untuk akun Anda.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {myNotifications.map((n) => {
                    const isUnread = n.statusDibaca === 'BELUM DIBACA';
                    return (
                      <div
                        key={n.idNotifikasi}
                        className={`p-3.5 sm:p-4 rounded-xl border shadow-2xs flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                          isUnread
                            ? 'bg-[#d9fdd3] border-[#b7f0ad]'
                            : 'bg-white border-[#d1d7db]'
                        }`}
                      >
                        <div className="space-y-1 text-xs min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#008069]">{n.judul}</span>
                            {isUnread && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#25D366] text-white rounded-full">
                                PESAN BARU
                              </span>
                            )}
                          </div>
                          <p className="text-[#111b21] leading-relaxed">{n.pesan}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#667781] pt-1">
                            <span>Penerima: {n.emailPenerima}</span>
                            <span>·</span>
                            <span>Ref: {n.idPermohonan}</span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">{n.waktuDibuat}</span>
                            <CheckCheck
                              className={`w-4 h-4 ${
                                isUnread ? 'text-[#667781]' : 'text-[#53bdeb]'
                              }`}
                            />
                          </div>
                        </div>

                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => handleMarkNotificationRead(n.idNotifikasi)}
                            className="self-end sm:self-start px-3 py-1.5 text-xs font-bold text-[#008069] bg-white border border-[#00a884]/40 hover:bg-[#f0f2f5] rounded-full shrink-0"
                          >
                            Tandai Dibaca
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeMenu === 'database_backend' && (
            <SystemDatabaseBackendView
              store={store}
              currentUser={currentUser}
              onStoreUpdate={setStore}
            />
          )}
        </main>

        {/* FOOTER RESMI */}
        <footer className="bg-[#f0f2f5] border-t border-[#d1d7db] px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-[#54656f] gap-1.5 shrink-0">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <ShieldCheck className="w-4 h-4 text-[#008069] shrink-0" />
            <span>
              Sistem Informasi Permohonan Izin & Cuti Pegawai — Pesantren Islam Internasional Al-Andalus
            </span>
          </div>
          <div className="font-mono text-[11px]">
            Formulir: AIS-FRM-SEK.02.11 Rev. 1 · Database: 9 Sheet
          </div>
        </footer>
      </div>

      {/* NAVIGASI BAWAH KHUSUS MOBILE (GAYA TAB BAR WHATSAPP MOBILE) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#d1d7db] grid grid-cols-5 h-16 px-1 shadow-lg">
        <button
          type="button"
          onClick={() => setActiveMenu('dashboard')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
            activeMenu === 'dashboard' ? 'text-[#008069] font-bold' : 'text-[#54656f]'
          }`}
        >
          <div
            className={`px-3 py-1 rounded-full ${
              activeMenu === 'dashboard' ? 'bg-[#d9fdd3]' : ''
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <span>Chat</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingRequest(null);
            setActiveMenu('permohonan_baru');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
            activeMenu === 'permohonan_baru' ? 'text-[#008069] font-bold' : 'text-[#54656f]'
          }`}
        >
          <div
            className={`px-3 py-1 rounded-full ${
              activeMenu === 'permohonan_baru' ? 'bg-[#d9fdd3]' : ''
            }`}
          >
            <FilePlus2 className="w-4 h-4" />
          </div>
          <span>Ajukan</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMenu('persetujuan')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
            activeMenu === 'persetujuan' ? 'text-[#008069] font-bold' : 'text-[#54656f]'
          }`}
        >
          <div
            className={`px-3 py-1 rounded-full ${
              activeMenu === 'persetujuan' ? 'bg-[#d9fdd3]' : ''
            }`}
          >
            <CheckSquare className="w-4 h-4" />
          </div>
          <span>Approval</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMenu('arsip')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
            activeMenu === 'arsip' ? 'text-[#008069] font-bold' : 'text-[#54656f]'
          }`}
        >
          <div
            className={`px-3 py-1 rounded-full ${
              activeMenu === 'arsip' ? 'bg-[#d9fdd3]' : ''
            }`}
          >
            <Archive className="w-4 h-4" />
          </div>
          <span>Arsip</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-[#54656f]"
        >
          <div className="px-3 py-1 rounded-full">
            <Menu className="w-4 h-4" />
          </div>
          <span>Menu</span>
          {unreadNotifCount > 0 && (
            <span className="absolute top-1.5 right-3 px-1.5 text-[9px] font-bold bg-[#25D366] text-white rounded-full">
              {unreadNotifCount}
            </span>
          )}
        </button>
      </nav>

      {/* MODAL UBAH PASSWORD MANDIRI PEGAWAI */}
      {showChangePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-[#d1d7db] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-[#008069] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-[#d9fdd3]" />
                <div>
                  <h3 className="text-sm font-bold">Ubah Password Saya</h3>
                  <p className="text-[11px] text-white/85">
                    {currentUser.namaPengguna} ({currentUser.role})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePassModal(false)}
                className="p-1.5 text-white/80 hover:text-white rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMyNewPassword} className="p-5 space-y-3.5 text-xs">
              <div className="bg-[#fff5c4] border border-[#e6daa6] rounded-xl p-2.5 text-[#54656f]">
                🔒 Password baru yang Anda simpan akan langsung berlaku dan otomatis tersinkron ke sheet <strong>USERS</strong> di Google Spreadsheet.
              </div>

              {changePassMsg && (
                <div
                  className={`p-3 rounded-xl border font-medium ${
                    changePassMsg.type === 'success'
                      ? 'bg-[#d9fdd3] border-[#b7f0ad] text-[#111b21]'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  {changePassMsg.text}
                </div>
              )}

              <div>
                <label className="block font-bold text-[#111b21] mb-1">
                  Password Saat Ini / Tanggal Lahir (ddmmyyyy)
                </label>
                <input
                  type="password"
                  required
                  value={oldPassInput}
                  onChange={(e) => setOldPassInput(e.target.value)}
                  placeholder="Masukkan password lama..."
                  className="w-full px-3.5 py-2.5 bg-[#f0f2f5] border border-[#d1d7db] rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#111b21] mb-1">
                  Password Baru
                </label>
                <input
                  type="text"
                  required
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Minimal 4 karakter / angka..."
                  className="w-full px-3.5 py-2.5 bg-[#f0f2f5] border border-[#d1d7db] rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#111b21] mb-1">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="text"
                  required
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  placeholder="Ketik ulang password baru..."
                  className="w-full px-3.5 py-2.5 bg-[#f0f2f5] border border-[#d1d7db] rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePassModal(false)}
                  className="px-4 py-2 font-semibold text-[#54656f] bg-[#f0f2f5] hover:bg-[#e9edef] rounded-xl"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-xl"
                >
                  Simpan Password Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU & CETAK FORMULIR PDF RESMI */}
      {previewPdfRequest && (
        <OfficialFormModal
          request={previewPdfRequest}
          employee={store.MASTER_PEGAWAI.find(
            (e) => e.idPegawai === previewPdfRequest.idPegawai
          )}
          onClose={() => setPreviewPdfRequest(null)}
        />
      )}
    </div>
  );
}

export default App;
