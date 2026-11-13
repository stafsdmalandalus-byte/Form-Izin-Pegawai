import React, { useState } from 'react';
import {
  Employee,
  UserAccount,
  UserRole,
} from '../types';
import {
  ensureEmployeeUserSync,
  extractDdMmYyyyFromNip,
  FullDatabaseStore,
  getNextUniqueUserId,
  hashPassword,
  isValidDdMmYyyyPassword,
  normalizeBirthDateToDdMmYyyy,
  recordActivity,
  saveDatabase,
  validatePermission,
} from '../services/databaseService';
import {
  downloadEmployeeExcelTemplate,
  exportEmployeesToExcel,
  ExcelValidationResult,
  parseAndValidateEmployeeExcel,
} from '../utils/excelHelper';
import {
  UserPlus,
  Upload,
  Download,
  FileSpreadsheet,
  Search,
  Edit3,
  UserX,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

interface MasterDataPegawaiViewProps {
  store: FullDatabaseStore;
  currentUser: UserAccount;
  onStoreUpdate: (next: FullDatabaseStore) => void;
}

export const MasterDataPegawaiView: React.FC<MasterDataPegawaiViewProps> = ({
  store,
  currentUser,
  onStoreUpdate,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pegawai' | 'impor' | 'users'>('pegawai');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBidang, setFilterBidang] = useState('SEMUA');
  const [filterUnit, setFilterUnit] = useState('SEMUA');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Add / Edit Employee Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState<Employee>({
    idPegawai: '',
    nip: '',
    namaLengkap: '',
    jenisKelamin: 'Laki-laki',
    bidang: 'Pendidikan & Kurikulum',
    bagian: 'Pengajaran',
    jabatan: 'Guru / Pendidik',
    unit: 'Unit Putra',
    email: '',
    nomorTelepon: '',
    idAtasanLangsung: '-',
    idMudirUnit: '-',
    statusKepegawaian: 'Pegawai Tetap',
    statusAktif: 'Aktif',
    tanggalDibuat: new Date().toISOString().slice(0, 10),
    tanggalDiperbarui: new Date().toISOString().slice(0, 10),
  });

  // Excel Import State
  const [excelPreview, setExcelPreview] = useState<ExcelValidationResult | null>(null);
  const [excelFileName, setExcelFileName] = useState('');

  // Create User Account Form State
  const [newUserForm, setNewUserForm] = useState({
    idPegawai: '',
    email: '',
    namaPengguna: '',
    password: '',
    role: 'PEGAWAI' as UserRole,
    unit: 'Unit Putra',
    idAtasan: '-',
    idMudir: '-',
  });

  const bidangList = Array.from(new Set(store.MASTER_PEGAWAI.map((e) => e.bidang))).filter(Boolean);
  const unitList = Array.from(new Set(store.MASTER_PEGAWAI.map((e) => e.unit))).filter(Boolean);

  const filteredEmployees = store.MASTER_PEGAWAI.filter((emp) => {
    const matchSearch =
      emp.namaLengkap.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.idPegawai.toLowerCase().includes(searchQuery.toLowerCase());
    const matchBidang = filterBidang === 'SEMUA' || emp.bidang === filterBidang;
    const matchUnit = filterUnit === 'SEMUA' || emp.unit === filterUnit;
    return matchSearch && matchBidang && matchUnit;
  });

  const openAddEmployee = () => {
    setEditingId(null);
    setEmpForm({
      idPegawai: '',
      nip: '',
      namaLengkap: '',
      jenisKelamin: 'Laki-laki',
      bidang: 'Pendidikan & Kurikulum',
      bagian: 'Pengajaran',
      jabatan: 'Guru / Pendidik',
      unit: 'Unit Putra',
      email: '',
      nomorTelepon: '',
      idAtasanLangsung: '-',
      idMudirUnit: '-',
      statusKepegawaian: 'Pegawai Tetap',
      statusAktif: 'Aktif',
      tanggalDibuat: new Date().toISOString().slice(0, 10),
      tanggalDiperbarui: new Date().toISOString().slice(0, 10),
    });
    setIsFormOpen(true);
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingId(emp.idPegawai);
    setEmpForm({ ...emp });
    setIsFormOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const perm = validatePermission(currentUser, ['ADMIN SDM', 'SUPER ADMIN']);
    if (!perm.valid) {
      setFeedbackMsg({ type: 'error', text: perm.message || 'Akses ditolak' });
      return;
    }

    if (!empForm.nip.trim() || !empForm.namaLengkap.trim() || !empForm.email.trim()) {
      setFeedbackMsg({
        type: 'error',
        text: 'NIP, Nama Lengkap, dan Email wajib diisi.',
      });
      return;
    }

    // Check duplicate NIP
    const duplicateNip = store.MASTER_PEGAWAI.find(
      (item) =>
        item.nip.trim().toLowerCase() === empForm.nip.trim().toLowerCase() &&
        item.idPegawai !== editingId
    );
    if (duplicateNip) {
      setFeedbackMsg({
        type: 'error',
        text: `Duplikasi NIP: NIP ${empForm.nip} sudah terdaftar atas nama ${duplicateNip.namaLengkap}.`,
      });
      return;
    }

    const finalIdPegawai = empForm.idPegawai.trim() || empForm.nip.trim();
    const finalBirthPass = normalizeBirthDateToDdMmYyyy(empForm.tanggalLahir, empForm.nip) || '01011995';
    const finalEmp: Employee = {
      ...empForm,
      idPegawai: finalIdPegawai,
      nip: empForm.nip.trim(),
      tanggalLahir: finalBirthPass,
    };

    const updatedStore = { ...store };
    const now = new Date().toISOString().slice(0, 10);

    if (editingId) {
      updatedStore.MASTER_PEGAWAI = updatedStore.MASTER_PEGAWAI.map((item) =>
        item.idPegawai === editingId ? { ...finalEmp, tanggalDiperbarui: now } : item
      );
      recordActivity(
        updatedStore,
        currentUser,
        'EDIT_PEGAWAI',
        'MASTER_PEGAWAI',
        finalEmp.idPegawai,
        `Memperbarui data pegawai ${finalEmp.namaLengkap} (NIP/NIY: ${finalEmp.nip}, Password Tgl Lahir: ${finalBirthPass})`
      );
      setFeedbackMsg({
        type: 'success',
        text: `Data pegawai ${finalEmp.namaLengkap} berhasil diperbarui (Password Tanggal Lahir: ${finalBirthPass}).`,
      });
    } else {
      updatedStore.MASTER_PEGAWAI = [
        ...updatedStore.MASTER_PEGAWAI,
        { ...finalEmp, tanggalDibuat: now, tanggalDiperbarui: now },
      ];
      recordActivity(
        updatedStore,
        currentUser,
        'TAMBAH_PEGAWAI',
        'MASTER_PEGAWAI',
        finalEmp.idPegawai,
        `Menambahkan pegawai baru ${finalEmp.namaLengkap} (NIP/NIY: ${finalEmp.nip}, Password Tgl Lahir: ${finalBirthPass})`
      );
      setFeedbackMsg({
        type: 'success',
        text: `Pegawai ${finalEmp.namaLengkap} berhasil ditambahkan ke MASTER_PEGAWAI & langsung bisa login dengan Nama + Tanggal Lahir (${finalBirthPass}).`,
      });
    }

    ensureEmployeeUserSync(updatedStore);
    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    setIsFormOpen(false);
  };

  const handleDeactivateEmployee = (emp: Employee) => {
    const perm = validatePermission(currentUser, ['ADMIN SDM', 'SUPER ADMIN']);
    if (!perm.valid) {
      setFeedbackMsg({ type: 'error', text: perm.message || 'Akses ditolak' });
      return;
    }

    const nextStatus = emp.statusAktif === 'Aktif' ? 'Nonaktif' : 'Aktif';
    const updatedStore = { ...store };
    updatedStore.MASTER_PEGAWAI = updatedStore.MASTER_PEGAWAI.map((item) =>
      item.idPegawai === emp.idPegawai
        ? { ...item, statusAktif: nextStatus, tanggalDiperbarui: new Date().toISOString().slice(0, 10) }
        : item
    );

    recordActivity(
      updatedStore,
      currentUser,
      'UBAH_STATUS_PEGAWAI',
      'MASTER_PEGAWAI',
      emp.idPegawai,
      `Mengubah status aktif pegawai ${emp.namaLengkap} menjadi ${nextStatus}`
    );

    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    setFeedbackMsg({
      type: 'success',
      text: `Status pegawai ${emp.namaLengkap} diubah menjadi ${nextStatus}.`,
    });
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);
    try {
      const result = await parseAndValidateEmployeeExcel(file, store.MASTER_PEGAWAI);
      setExcelPreview(result);
      setFeedbackMsg(null);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: `Gagal membaca file Excel: ${err?.message || 'Format tidak didukung'}`,
      });
    }
  };

  const handleConfirmExcelImport = () => {
    if (!excelPreview) return;
    const validRows = excelPreview.rows.filter((r) => r.isValid).map((r) => r.data);
    if (validRows.length === 0) {
      setFeedbackMsg({
        type: 'error',
        text: 'Tidak ada baris data valid yang dapat diimpor. Perbaiki kesalahan pada file Excel terlebih dahulu.',
      });
      return;
    }

    const updatedStore = { ...store };
    updatedStore.MASTER_PEGAWAI = [...updatedStore.MASTER_PEGAWAI, ...validRows];
    ensureEmployeeUserSync(updatedStore);

    recordActivity(
      updatedStore,
      currentUser,
      'IMPOR_EXCEL_PEGAWAI',
      'MASTER_PEGAWAI',
      excelFileName,
      `Mengimpor ${validRows.length} data pegawai tervalidasi dari file Excel ${excelFileName} beserta sinkronisasi login Tanggal Lahir`
    );

    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    setExcelPreview(null);
    setExcelFileName('');
    setActiveSubTab('pegawai');
    setFeedbackMsg({
      type: 'success',
      text: `Berhasil mengimpor ${validRows.length} data pegawai ke sheet MASTER_PEGAWAI.`,
    });
  };

  const handleCreateUserAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const perm = validatePermission(currentUser, ['ADMIN SDM', 'SUPER ADMIN']);
    if (!perm.valid) {
      setFeedbackMsg({ type: 'error', text: perm.message || 'Akses ditolak' });
      return;
    }

    if (!newUserForm.idPegawai || !newUserForm.email || !newUserForm.password) {
      setFeedbackMsg({
        type: 'error',
        text: 'Pilih Pegawai, isi Email, dan masukkan Password akun berformat ddmmyyyy.',
      });
      return;
    }

    if (!isValidDdMmYyyyPassword(newUserForm.password)) {
      setFeedbackMsg({
        type: 'error',
        text: 'Format Password wajib 8 digit angka ddmmyyyy (TanggalBulanTahun, contoh: 15081990).',
      });
      return;
    }

    const exists = store.USERS.find(
      (u) => u.email.toLowerCase() === newUserForm.email.trim().toLowerCase()
    );
    if (exists) {
      setFeedbackMsg({
        type: 'error',
        text: `Akun dengan email ${newUserForm.email} sudah terdaftar di sheet USERS.`,
      });
      return;
    }

    const updatedStore = { ...store };
    const nextUserId = getNextUniqueUserId(updatedStore.USERS);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const created: UserAccount = {
      userId: nextUserId,
      idPegawai: newUserForm.idPegawai,
      namaPengguna: newUserForm.namaPengguna,
      email: newUserForm.email.trim(),
      passwordHash: hashPassword(newUserForm.password.trim()),
      passwordPlain: newUserForm.password.trim(),
      role: newUserForm.role,
      unit: newUserForm.unit,
      idAtasan: newUserForm.idAtasan || '-',
      idMudir: newUserForm.idMudir || '-',
      statusAkun: 'Aktif',
      tanggalDibuat: now,
      terakhirLogin: '-',
    };

    updatedStore.USERS = [...updatedStore.USERS, created];
    recordActivity(
      updatedStore,
      currentUser,
      'BUAT_AKUN_PENGGUNA',
      'USERS',
      nextUserId,
      `Membuat akun login untuk ${created.namaPengguna} (${created.email}) dengan role ${created.role} dan password format ddmmyyyy`
    );

    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    setNewUserForm({
      idPegawai: '',
      email: '',
      namaPengguna: '',
      password: '',
      role: 'PEGAWAI',
      unit: 'Unit Putra',
      idAtasan: '-',
      idMudir: '-',
    });
    setFeedbackMsg({
      type: 'success',
      text: `Akun pengguna ${created.namaPengguna} (${created.role}) berhasil disimpan ke sheet USERS dengan password format ddmmyyyy (terenkripsi SHA-256).`,
    });
  };

  const handleSelectEmployeeForUser = (idPegawai: string) => {
    const emp = store.MASTER_PEGAWAI.find((e) => e.idPegawai === idPegawai);
    if (!emp) {
      setNewUserForm((prev) => ({ ...prev, idPegawai }));
      return;
    }
    const autoPasswordFromNip = extractDdMmYyyyFromNip(emp.nip);
    setNewUserForm({
      idPegawai: emp.idPegawai,
      namaPengguna: emp.namaLengkap,
      email: emp.email,
      password: autoPasswordFromNip,
      role: 'PEGAWAI',
      unit: emp.unit,
      idAtasan: emp.idAtasanLangsung || '-',
      idMudir: emp.idMudirUnit || '-',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Master Data Pegawai & Manajemen Akun Pengguna
          </h2>
          <p className="text-sm text-slate-600">
            Kelola sheet <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5">MASTER_PEGAWAI</code>, impor validasi Excel, serta akun dan relasi persetujuan pada sheet <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5">USERS</code>.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('pegawai')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'pegawai'
                ? 'bg-emerald-900 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Daftar Pegawai ({store.MASTER_PEGAWAI.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('impor')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'impor'
                ? 'bg-emerald-900 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Impor & Template Excel
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('users')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'users'
                ? 'bg-emerald-900 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Akun Pengguna & Role ({store.USERS.length})
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-lg border text-sm flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-semibold underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* TAB 1: DAFTAR MASTER_PEGAWAI */}
      {activeSubTab === 'pegawai' && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama pegawai, NIP, atau ID Pegawai..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-800"
                />
              </div>

              <select
                value={filterBidang}
                onChange={(e) => setFilterBidang(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="SEMUA">Semua Bidang</option>
                {bidangList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <select
                value={filterUnit}
                onChange={(e) => setFilterUnit(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="SEMUA">Semua Unit</option>
                {unitList.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={downloadEmployeeExcelTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Unduh Template Excel
              </button>
              <button
                type="button"
                onClick={() => exportEmployeesToExcel(store.MASTER_PEGAWAI)}
                disabled={store.MASTER_PEGAWAI.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                Ekspor ke Excel
              </button>
              <button
                type="button"
                onClick={openAddEmployee}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                Tambah Pegawai
              </button>
            </div>
          </div>

          {/* Empty State if no employees imported yet (Strictly following Section F: No fake employee names) */}
          {store.MASTER_PEGAWAI.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Data Pegawai pada Sheet MASTER_PEGAWAI Masih Kosong
              </h3>
              <p className="text-sm text-slate-600 max-w-xl mx-auto mb-5">
                Sesuai ketentuan sistem, aplikasi tidak membuat nama pegawai fiktif. Admin SDM harus
                mengimpor data pegawai dari file Excel resmi atau menambahkan data pegawai terlebih
                dahulu agar dapat digunakan secara otomatis oleh formulir permohonan izin dan cuti.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openAddEmployee}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-md transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Tambah Data Pegawai Pertama
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('impor')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Impor Data Pegawai dari Excel
                </button>
                <button
                  type="button"
                  onClick={downloadEmployeeExcelTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Unduh Template Excel MASTER_PEGAWAI
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                    <th className="py-3 px-3">ID Pegawai</th>
                    <th className="py-3 px-3">NIP</th>
                    <th className="py-3 px-3">Nama Lengkap</th>
                    <th className="py-3 px-3">Bidang / Bagian</th>
                    <th className="py-3 px-3">Jabatan</th>
                    <th className="py-3 px-3">Unit</th>
                    <th className="py-3 px-3">ID Atasan / Mudir</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEmployees.map((emp, idx) => (
                    <tr key={`${emp.idPegawai}-${idx}`} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900 tabular-nums">
                        {emp.idPegawai}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 tabular-nums">
                        {emp.nip}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {emp.namaLengkap}
                        <div className="text-[11px] font-normal text-slate-500">
                          {emp.email} · {emp.jenisKelamin}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {emp.bidang}
                        <div className="text-[11px] text-slate-500">{emp.bagian}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{emp.jabatan}</td>
                      <td className="py-2.5 px-3 text-slate-700">{emp.unit}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        <div>Atasan: {emp.idAtasanLangsung}</div>
                        <div>Mudir: {emp.idMudirUnit}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            emp.statusAktif === 'Aktif' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {emp.statusAktif}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditEmployee(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded mr-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivateEmployee(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 rounded"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          {emp.statusAktif === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal / Panel Form Tambah & Edit Pegawai */}
          {isFormOpen && (
            <div className="bg-white border border-slate-300 rounded-lg p-6">
              <h3 className="text-base font-bold text-slate-900 mb-4">
                {editingId ? `Edit Data Pegawai (${editingId})` : 'Tambah Data Pegawai Baru (MASTER_PEGAWAI)'}
              </h3>
              <form onSubmit={handleSaveEmployee} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIP / NIY (Wajib & Unik)
                  </label>
                  <input
                    type="text"
                    required
                    value={empForm.nip}
                    onChange={(e) => {
                      const val = e.target.value;
                      const autoBirth = extractDdMmYyyyFromNip(val);
                      setEmpForm({
                        ...empForm,
                        nip: val,
                        idPegawai: !editingId || empForm.idPegawai === empForm.nip ? val : empForm.idPegawai,
                        tanggalLahir: empForm.tanggalLahir || autoBirth,
                      });
                    }}
                    placeholder="Contoh: 199204152019011001"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap (Sesuai SK)
                  </label>
                  <input
                    type="text"
                    required
                    value={empForm.namaLengkap}
                    onChange={(e) => setEmpForm({ ...empForm, namaLengkap: e.target.value })}
                    placeholder="Masukkan nama lengkap pegawai"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Lahir (Password Login: <code className="font-mono text-emerald-900">ddmmyyyy</code>)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    inputMode="numeric"
                    value={empForm.tanggalLahir || ''}
                    onChange={(e) =>
                      setEmpForm({
                        ...empForm,
                        tanggalLahir: e.target.value.replace(/\D/g, '').slice(0, 8),
                      })
                    }
                    placeholder="Contoh: 15041992 (8 digit)"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono tracking-widest"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={empForm.jenisKelamin}
                    onChange={(e) =>
                      setEmpForm({
                        ...empForm,
                        jenisKelamin: e.target.value as 'Laki-laki' | 'Perempuan',
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bidang
                  </label>
                  <input
                    type="text"
                    required
                    value={empForm.bidang}
                    onChange={(e) => setEmpForm({ ...empForm, bidang: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bagian
                  </label>
                  <input
                    type="text"
                    required
                    value={empForm.bagian}
                    onChange={(e) => setEmpForm({ ...empForm, bagian: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jabatan
                  </label>
                  <input
                    type="text"
                    required
                    value={empForm.jabatan}
                    onChange={(e) => setEmpForm({ ...empForm, jabatan: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Kerja
                  </label>
                  <input
                    type="text"
                    required
                    value={empForm.unit}
                    onChange={(e) => setEmpForm({ ...empForm, unit: e.target.value })}
                    placeholder="Contoh: Unit Putra / Unit Putri / Pusat"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Pegawai
                  </label>
                  <input
                    type="email"
                    required
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    placeholder="nama@alandalus.sch.id"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={empForm.nomorTelepon}
                    onChange={(e) => setEmpForm({ ...empForm, nomorTelepon: e.target.value })}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Atasan Langsung
                  </label>
                  <select
                    value={empForm.idAtasanLangsung}
                    onChange={(e) => setEmpForm({ ...empForm, idAtasanLangsung: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="-">-- Pilih / Ketik ID Atasan Langsung --</option>
                    {store.MASTER_PEGAWAI.map((p) => (
                      <option key={p.idPegawai} value={p.idPegawai}>
                        {p.idPegawai} — {p.namaLengkap} ({p.jabatan})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Mudir Unit
                  </label>
                  <select
                    value={empForm.idMudirUnit}
                    onChange={(e) => setEmpForm({ ...empForm, idMudirUnit: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                  >
                    <option value="-">-- Pilih / Ketik ID Mudir Unit --</option>
                    {store.MASTER_PEGAWAI.map((p) => (
                      <option key={p.idPegawai} value={p.idPegawai}>
                        {p.idPegawai} — {p.namaLengkap} ({p.jabatan})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3 flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-md"
                  >
                    Simpan ke MASTER_PEGAWAI
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IMPOR DATA PEGAWAI DARI EXCEL DENGAN VALIDASI */}
      {activeSubTab === 'impor' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Impor Massal Data Pegawai dari Excel (.xlsx / .xls)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Sistem akan memeriksa kelengkapan 16 kolom <code className="font-mono">MASTER_PEGAWAI</code>, mendeteksi duplikasi NIP, dan memvalidasi data kosong sebelum diimpor.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadEmployeeExcelTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Unduh Template Excel MASTER_PEGAWAI
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center bg-slate-50">
            <Upload className="w-7 h-7 text-slate-500 mx-auto mb-2" />
            <label className="cursor-pointer">
              <span className="text-sm font-semibold text-emerald-900 underline">
                Pilih File Excel (.xlsx)
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-slate-500 mt-1">
              Pastikan kolom sesuai dengan template <code className="font-mono">MASTER_PEGAWAI</code>.
            </p>
          </div>

          {excelPreview && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-900">
                    Hasil Pemeriksaan File: {excelFileName}
                  </div>
                  <div className="text-slate-600">
                    Total Baris: <strong className="tabular-nums">{excelPreview.totalRows}</strong> ·
                    Lolos Validasi:{' '}
                    <strong className="text-emerald-700 tabular-nums">
                      {excelPreview.validCount}
                    </strong>{' '}
                    · Tidak Valid:{' '}
                    <strong className="text-red-700 tabular-nums">
                      {excelPreview.invalidCount}
                    </strong>
                  </div>
                  {excelPreview.missingRequiredHeaders.length > 0 && (
                    <div className="text-red-700 font-semibold">
                      Kolom wajib yang belum ada: {excelPreview.missingRequiredHeaders.join(', ')}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={excelPreview.validCount === 0}
                  onClick={handleConfirmExcelImport}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 disabled:opacity-40 rounded-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Konfirmasi Impor ({excelPreview.validCount} Pegawai Valid)
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="py-2.5 px-3">Baris</th>
                      <th className="py-2.5 px-3">ID Pegawai</th>
                      <th className="py-2.5 px-3">NIP</th>
                      <th className="py-2.5 px-3">Nama Lengkap</th>
                      <th className="py-2.5 px-3">Bidang / Jabatan</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3">Status Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {excelPreview.rows.map((r) => (
                      <tr key={r.rowNumber} className={r.isValid ? 'bg-white' : 'bg-red-50/50'}>
                        <td className="py-2 px-3 font-mono tabular-nums">#{r.rowNumber}</td>
                        <td className="py-2 px-3 font-mono">{r.data.idPegawai}</td>
                        <td className="py-2 px-3 font-mono">{r.data.nip || '-'}</td>
                        <td className="py-2 px-3 font-medium">{r.data.namaLengkap || '-'}</td>
                        <td className="py-2 px-3">
                          {r.data.bidang} / {r.data.jabatan}
                        </td>
                        <td className="py-2 px-3">{r.data.unit}</td>
                        <td className="py-2 px-3">
                          {r.isValid ? (
                            <span className="text-emerald-700 font-semibold">
                              Valid — Siap Diimpor
                            </span>
                          ) : (
                            <ul className="text-red-700 list-disc list-inside">
                              {r.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MANAJEMEN AKUN PENGGUNA & ROLE (SHEET USERS) */}
      {activeSubTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Buat Akun Pengguna oleh Admin */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-emerald-900" />
              <h3 className="text-sm font-bold text-slate-900">
                Buat Akun Pengguna Baru (Sheet USERS)
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Sesuai ketentuan keamanan, pengguna tidak dapat mendaftar sendiri. Admin SDM menghubungkan akun dengan <code className="font-mono">ID Pegawai</code> dan menetapkan Role.
            </p>

            <form onSubmit={handleCreateUserAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hubungkan dengan Pegawai (MASTER_PEGAWAI)
                </label>
                <select
                  value={newUserForm.idPegawai}
                  onChange={(e) => handleSelectEmployeeForUser(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="">-- Pilih Pegawai dari MASTER_PEGAWAI --</option>
                  {store.MASTER_PEGAWAI.map((emp) => (
                    <option key={emp.idPegawai} value={emp.idPegawai}>
                      {emp.idPegawai} — {emp.namaLengkap} ({emp.jabatan})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ID Pegawai
                </label>
                <input
                  type="text"
                  required
                  value={newUserForm.idPegawai}
                  onChange={(e) => setNewUserForm({ ...newUserForm, idPegawai: e.target.value })}
                  placeholder="Contoh: PEG-001"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Pengguna
                </label>
                <input
                  type="text"
                  required
                  value={newUserForm.namaPengguna}
                  onChange={(e) => setNewUserForm({ ...newUserForm, namaPengguna: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Akun Google / Login
                </label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password Pegawai (Wajib Format <code className="font-mono">ddmmyyyy</code>)
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={newUserForm.password}
                  onChange={(e) =>
                    setNewUserForm({
                      ...newUserForm,
                      password: e.target.value.replace(/\D/g, '').slice(0, 8),
                    })
                  }
                  placeholder="Contoh: 15081990 (TanggalBulanTahun)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono tracking-wider"
                />
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  8 digit angka Tanggal-Bulan-Tahun (otomatis terisi jika NIP memuat tgl lahir)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Pengguna
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="PEGAWAI">PEGAWAI</option>
                  <option value="ATASAN LANGSUNG">ATASAN LANGSUNG / KEPALA BIDANG</option>
                  <option value="MUDIR UNIT">MUDIR UNIT</option>
                  <option value="ADMIN SDM">ADMIN SDM & PENJAMINAN MUTU</option>
                  <option value="SUPER ADMIN">SUPER ADMIN</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Atasan Langsung
                  </label>
                  <input
                    type="text"
                    value={newUserForm.idAtasan}
                    onChange={(e) => setNewUserForm({ ...newUserForm, idAtasan: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Mudir Unit
                  </label>
                  <input
                    type="text"
                    value={newUserForm.idMudir}
                    onChange={(e) => setNewUserForm({ ...newUserForm, idMudir: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-md transition-colors"
              >
                Simpan Akun ke Sheet USERS
              </button>
            </form>
          </div>

          {/* Tabel Daftar Akun pada Sheet USERS */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-900" />
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Akun Terdaftar (Sheet USERS)
                </h3>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                Total: {store.USERS.length} Akun
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3">User ID</th>
                    <th className="py-2.5 px-3">ID Pegawai</th>
                    <th className="py-2.5 px-3">Nama Pengguna & Email</th>
                    <th className="py-2.5 px-3">Role Hak Akses</th>
                    <th className="py-2.5 px-3">Relasi Persetujuan</th>
                    <th className="py-2.5 px-3">Terakhir Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {store.USERS.map((u, idx) => (
                    <tr key={`${u.userId}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        {u.userId}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{u.idPegawai}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{u.namaPengguna}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-900">{u.role}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        Atasan: {u.idAtasan} · Mudir: {u.idMudir}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 tabular-nums">
                        {u.terakhirLogin}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
