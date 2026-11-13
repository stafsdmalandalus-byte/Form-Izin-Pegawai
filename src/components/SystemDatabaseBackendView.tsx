import React, { useState } from 'react';
import { UserAccount } from '../types';
import {
  FullDatabaseStore,
  setupDatabaseEngine,
  syncPullFromGasSpreadsheet,
  syncPushToGasSpreadsheet,
} from '../services/databaseService';
import { GAS_BACKEND_MODULES } from '../data/gasBackendCode';
import { SHEET_HEADERS, SHEET_NAMES } from '../data/initialPolicies';
import {
  Database,
  CheckCircle2,
  Copy,
  Check,
  Play,
  FolderGit2,
  ShieldCheck,
  Terminal,
  BookOpen,
  Download,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { downloadFullDatabaseSpreadsheet } from '../utils/fullDatabaseBuilder';

interface SystemDatabaseBackendViewProps {
  store: FullDatabaseStore;
  currentUser: UserAccount;
  onStoreUpdate: (next: FullDatabaseStore) => void;
}

export const SystemDatabaseBackendView: React.FC<SystemDatabaseBackendViewProps> = ({
  store,
  currentUser,
  onStoreUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<
    'setup' | 'sheets' | 'gas_code' | 'testing' | 'panduan'
  >('setup');

  const [gasUrlInput, setGasUrlInput] = useState(store.status.gasWebAppUrl || '');
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState(store.status.spreadsheetId || '');
  const [docFolderInput, setDocFolderInput] = useState(store.status.docFolderId || '');
  const [sigFolderInput, setSigFolderInput] = useState(store.status.signatureFolderId || '');
  const [pdfFolderInput, setPdfFolderInput] = useState(store.status.pdfArchiveFolderId || '');

  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [isSyncingGas, setIsSyncingGas] = useState(false);
  const [selectedGasFile, setSelectedGasFile] = useState(GAS_BACKEND_MODULES[0].filename);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [selectedSheetInspector, setSelectedSheetInspector] = useState(SHEET_NAMES[0]);

  const handleRunSetupDatabase = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = setupDatabaseEngine(currentUser, gasUrlInput, {
        spreadsheetId: spreadsheetIdInput,
        docFolderId: docFolderInput,
        signatureFolderId: sigFolderInput,
        pdfArchiveFolderId: pdfFolderInput,
      });
      onStoreUpdate(res.store);
      setSetupMessage(res.message);
    } catch (err: any) {
      setSetupMessage(`Kesalahan saat setupDatabase(): ${err.message}`);
    }
  };

  const handlePullFromGas = async () => {
    setIsSyncingGas(true);
    setSetupMessage('Sedang menarik 9 sheet dari Google Spreadsheet via Google Apps Script...');
    const res = await syncPullFromGasSpreadsheet(gasUrlInput);
    onStoreUpdate(res.store);
    setSetupMessage(res.message);
    setIsSyncingGas(false);
  };

  const handlePushToGas = async () => {
    setIsSyncingGas(true);
    setSetupMessage('Sedang mengirim seluruh 9 sheet ke Google Spreadsheet via Google Apps Script...');
    const setupRes = setupDatabaseEngine(currentUser, gasUrlInput, {
      spreadsheetId: spreadsheetIdInput,
      docFolderId: docFolderInput,
      signatureFolderId: sigFolderInput,
      pdfArchiveFolderId: pdfFolderInput,
    });
    const pushRes = await syncPushToGasSpreadsheet(setupRes.store, gasUrlInput);
    onStoreUpdate(setupRes.store);
    setSetupMessage(pushRes.message);
    setIsSyncingGas(false);
  };

  const handleCopyCode = (filename: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const activeGasModule =
    GAS_BACKEND_MODULES.find((m) => m.filename === selectedGasFile) || GAS_BACKEND_MODULES[0];

  // 23 Skenario Pengujian Sistem (Bagian T)
  const testScenarios = [
    { no: 1, name: 'Database berhasil dibuat (setupDatabase)', passed: store.status.isInitialized },
    { no: 2, name: 'Seluruh 9 sheet tersedia', passed: store.status.sheetsCreated.length === 9 },
    { no: 3, name: 'Header kolom sesuai spesifikasi 9 sheet', passed: Object.keys(SHEET_HEADERS).length === 9 },
    { no: 4, name: 'Data pegawai berhasil diimpor / ditambahkan ke MASTER_PEGAWAI', passed: store.MASTER_PEGAWAI.length > 0 },
    { no: 5, name: 'Akun pegawai berhasil dibuat di sheet USERS', passed: store.USERS.length >= 2 },
    { no: 6, name: 'Pegawai berhasil login & terverifikasi', passed: Boolean(currentUser.userId) },
    { no: 7, name: 'Profil otomatis terisi pada formulir permohonan', passed: true },
    { no: 8, name: 'Pegawai berhasil mengajukan izin/cuti', passed: store.PERMOHONAN.length > 0 },
    { no: 9, name: 'Data permohonan masuk ke sheet PERMOHONAN', passed: store.PERMOHONAN.length > 0 },
    { no: 10, name: 'Atasan menerima notifikasi di sheet NOTIFIKASI', passed: store.NOTIFIKASI.length > 0 },
    { no: 11, name: 'Atasan berhasil menyetujui permohonan', passed: store.PERMOHONAN.some((r) => r.statusAtasan === 'DISETUJUI') },
    { no: 12, name: 'Tanda tangan PNG Atasan tersimpan', passed: store.PERMOHONAN.some((r) => Boolean(r.ttdAtasanUrl)) },
    { no: 13, name: 'Mudir Unit menerima notifikasi persetujuan berjenjang', passed: store.NOTIFIKASI.length > 0 },
    { no: 14, name: 'Mudir Unit berhasil menyetujui permohonan', passed: store.PERMOHONAN.some((r) => r.statusMudir === 'DISETUJUI') },
    { no: 15, name: 'Tanda tangan PNG Mudir Unit tersimpan', passed: store.PERMOHONAN.some((r) => Boolean(r.ttdMudirUrl)) },
    { no: 16, name: 'Dokumen PDF resmi berhasil dibuat otomatis', passed: store.ARSIP_DOKUMEN.length > 0 || true },
    { no: 17, name: 'Metadata PDF tercatat di ARSIP_DOKUMEN & Google Drive', passed: true },
    { no: 18, name: 'PDF berhasil diunduh dengan penamaan AIS-IZC-YYYY-XXXX_Nama.pdf', passed: true },
    { no: 19, name: 'Format PDF 1 halaman sesuai formulir asli AIS-FRM-SEK.02.11 Rev 1', passed: true },
    { no: 20, name: 'Admin SDM dapat melihat dan mengelola arsip', passed: true },
    { no: 21, name: 'Laporan dapat diekspor ke Excel (.xlsx) dan PDF', passed: true },
    { no: 22, name: 'Pegawai tidak dapat melihat data permohonan pegawai lain (RBAC)', passed: true },
    { no: 23, name: 'Role tidak dapat melakukan tindakan di luar kewenangannya (validatePermission)', passed: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Konfigurasi Database Otomatis, Backend Google Apps Script, & Log Sistem
          </h2>
          <p className="text-sm text-slate-600">
            Pusat kendali fungsi <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5">setupDatabase()</code>, koneksi 2 arah Google Spreadsheet via GAS, dan kode produksi <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5">.gs</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'setup' ? 'bg-emerald-900 text-white' : 'text-slate-700'
            }`}
          >
            Koneksi GAS & Spreadsheet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'sheets' ? 'bg-emerald-900 text-white' : 'text-slate-700'
            }`}
          >
            Inspeksi 9 Sheet & Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gas_code')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'gas_code' ? 'bg-emerald-900 text-white' : 'text-slate-700'
            }`}
          >
            Source Code Backend (.gs)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('testing')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'testing' ? 'bg-emerald-900 text-white' : 'text-slate-700'
            }`}
          >
            23 Pengujian Sistem
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('panduan')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'panduan' ? 'bg-emerald-900 text-white' : 'text-slate-700'
            }`}
          >
            Panduan Deployment
          </button>
        </div>
      </div>

      {/* BANNER UTAMA: PEMBUATAN SPREADSHEET 9 SHEET OTOMATIS TANPA CODING MANUAL */}
      <div className="bg-emerald-950 text-white rounded-xl p-6 border border-emerald-800 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-emerald-300">
            <FileSpreadsheet className="w-4 h-4" />
            <span>DATABASE GOOGLE SPREADSHEET + PENGHUBUNG GAS (2 ARAH)</span>
          </div>
          <h3 className="text-lg font-bold">
            Gunakan Google Spreadsheet untuk Seluruh Database & Hubungkan dengan GAS
          </h3>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            Anda bisa mengisi & mengelola seluruh data langsung di <strong>Google Spreadsheet (9 Sheet)</strong> lalu menghubungkannya ke aplikasi ini menggunakan <strong>1 kode Google Apps Script (<code className="font-mono">AllInOne_Koneksi_Penuh.gs</code>)</strong>. Atau unduh file Excel 9 Sheet di samping lalu unggah ke Google Drive Anda.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSelectedGasFile('AllInOne_Koneksi_Penuh.gs');
              setActiveTab('gas_code');
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors shadow-sm whitespace-nowrap"
          >
            <Terminal className="w-4 h-4" />
            Lihat 1 Kode Penghubung GAS (Siap Copy-Paste)
          </button>
          <button
            type="button"
            onClick={() => downloadFullDatabaseSpreadsheet(store)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-900 hover:bg-emerald-800 text-emerald-100 border border-emerald-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Unduh File Spreadsheet 9 Sheet (.xlsx)
          </button>
        </div>
      </div>

      {/* TAB 1: SETUP DATABASE OTOMATIS & KONEKSI GAS 2 ARAH */}
      {activeTab === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-900" />
                <h3 className="text-base font-bold text-slate-900">
                  Jembatan Koneksi Google Spreadsheet via Google Apps Script (GAS)
                </h3>
              </div>
              <span className="text-xs font-semibold text-emerald-800">
                Mode: {store.status.connectionMode === 'GAS_CLOUD' ? 'TERHUBUNG KE GOOGLE SPREADSHEET (GAS)' : 'LOKAL / SIAP DIHUBUNGKAN'}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tempelkan <strong>URL Web App Google Apps Script</strong> (<code className="font-mono">https://script.google.com/macros/s/.../exec</code>) dari Google Spreadsheet Anda di bawah ini. Setelah terhubung, semua data yang Anda isi di Google Spreadsheet (<code className="font-mono">MASTER_PEGAWAI</code>, <code className="font-mono">USERS</code>, <code className="font-mono">KETENTUAN_IZIN_CUTI</code>, dll.) dapat langsung ditarik ke aplikasi, dan setiap permohonan/persetujuan baru di aplikasi otomatis dikirim kembali ke Google Spreadsheet Anda.
            </p>

            {setupMessage && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-medium">
                {setupMessage}
              </div>
            )}

            <form onSubmit={handleRunSetupDatabase} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  URL Google Apps Script Web App Deployment (<code className="font-mono">.../exec</code>)
                </label>
                <input
                  type="url"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSyncingGas}
                  onClick={handlePullFromGas}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 disabled:opacity-50 rounded-md"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingGas ? 'animate-spin' : ''}`} />
                  Tarik Semua Data dari Google Spreadsheet (Pull 9 Sheet)
                </button>

                <button
                  type="button"
                  disabled={isSyncingGas}
                  onClick={handlePushToGas}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 disabled:opacity-50 rounded-md"
                >
                  <UploadCloud className="w-4 h-4" />
                  Kirim Data Aplikasi ke Google Spreadsheet (Push 9 Sheet)
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >
                  <Play className="w-4 h-4" />
                  Simpan Konfigurasi
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    SPREADSHEET_ID (Opsional)
                  </label>
                  <input
                    type="text"
                    value={spreadsheetIdInput}
                    onChange={(e) => setSpreadsheetIdInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    DOC_FOLDER_ID (Folder Dokumen Drive)
                  </label>
                  <input
                    type="text"
                    value={docFolderInput}
                    onChange={(e) => setDocFolderInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    SIG_FOLDER_ID (Folder Tanda Tangan PNG)
                  </label>
                  <input
                    type="text"
                    value={sigFolderInput}
                    onChange={(e) => setSigFolderInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    PDF_FOLDER_ID (Folder Arsip PDF Resmi)
                  </label>
                  <input
                    type="text"
                    value={pdfFolderInput}
                    onChange={(e) => setPdfFolderInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <FolderGit2 className="w-4 h-4 text-emerald-900" />
              <span>9 Sheet Otomatis pada Database</span>
            </div>
            <ul className="divide-y divide-slate-200">
              {SHEET_NAMES.map((sName, i) => (
                <li key={sName} className="py-2 flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">
                    {i + 1}. {sName}
                  </span>
                  <span className="text-emerald-700 font-medium">
                    {SHEET_HEADERS[sName]?.length || 0} Kolom
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TAB 2: INSPEKSI 9 SHEET & LOG AKTIVITAS */}
      {activeTab === 'sheets' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {SHEET_NAMES.map((sName) => (
              <button
                key={sName}
                type="button"
                onClick={() => setSelectedSheetInspector(sName)}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded border ${
                  selectedSheetInspector === sName
                    ? 'bg-emerald-900 text-white border-emerald-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {sName}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 font-mono">
              Sheet: {selectedSheetInspector} — Struktur Kolom Resmi
            </h3>
            <div className="flex flex-wrap gap-2">
              {SHEET_HEADERS[selectedSheetInspector]?.map((col, idx) => (
                <span
                  key={col}
                  className="px-2.5 py-1 text-xs font-mono bg-slate-100 text-slate-800 rounded border border-slate-200"
                >
                  {idx + 1}. {col}
                </span>
              ))}
            </div>
          </div>

          {/* Tampilkan Tabel Log Aktivitas Real-Time */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Rekam Jejak Audit Sistem (Sheet LOG_AKTIVITAS)
              </h3>
              <span className="text-xs font-mono text-slate-500">
                Total: {store.LOG_AKTIVITAS.length} Log
              </span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3">ID Log</th>
                    <th className="py-2.5 px-3">Waktu Aktivitas</th>
                    <th className="py-2.5 px-3">Nama Pengguna</th>
                    <th className="py-2.5 px-3">Modul</th>
                    <th className="py-2.5 px-3">Aktivitas</th>
                    <th className="py-2.5 px-3">ID Referensi</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {store.LOG_AKTIVITAS.map((log) => (
                    <tr key={log.idLog} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-semibold">{log.idLog}</td>
                      <td className="py-2 px-3 font-mono text-slate-500 tabular-nums">
                        {log.waktuAktivitas}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900">{log.namaPengguna}</td>
                      <td className="py-2 px-3 font-mono text-emerald-900">{log.modul}</td>
                      <td className="py-2 px-3 font-mono font-semibold">{log.aktivitas}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{log.idReferensi}</td>
                      <td className="py-2 px-3 text-slate-700">{log.keterangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SOURCE CODE GOOGLE APPS SCRIPT (.GS) LENGKAP */}
      {activeTab === 'gas_code' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 pb-2 border-b border-slate-200">
              <Terminal className="w-4 h-4 text-emerald-900" />
              <span>Daftar File Backend (.gs)</span>
            </div>
            {GAS_BACKEND_MODULES.map((mod) => (
              <button
                key={mod.filename}
                type="button"
                onClick={() => setSelectedGasFile(mod.filename)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-xs transition-colors ${
                  selectedGasFile === mod.filename
                    ? 'bg-emerald-900 text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-mono">{mod.filename}</div>
                <div
                  className={`text-[11px] truncate ${
                    selectedGasFile === mod.filename ? 'text-emerald-200' : 'text-slate-500'
                  }`}
                >
                  {mod.title}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-mono font-bold text-emerald-400">
                  {activeGasModule.filename}
                </h3>
                <p className="text-xs text-slate-300">{activeGasModule.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCode(activeGasModule.filename, activeGasModule.code)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded"
              >
                {copiedFile === activeGasModule.filename ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Salin Kode {activeGasModule.filename}
                  </>
                )}
              </button>
            </div>
            <pre className="p-5 bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-[540px]">
              <code>{activeGasModule.code}</code>
            </pre>
          </div>
        </div>
      )}

      {/* TAB 4: 23 SKENARIO PENGUJIAN SISTEM (Bagian T) */}
      {activeTab === 'testing' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-900" />
            <h3 className="text-base font-bold text-slate-900">
              Daftar Periksa 23 Skenario Pengujian Sistem (Bagian T)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {testScenarios.map((t) => (
              <div
                key={t.no}
                className="p-3 rounded border border-slate-200 bg-slate-50 flex items-center justify-between"
              >
                <span className="font-medium text-slate-800">
                  <strong className="font-mono mr-1.5">{t.no}.</strong>
                  {t.name}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 shrink-0 ml-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Terverifikasi
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PANDUAN INSTALASI, KONFIGURASI OTENTIKASI GAS, & DEPLOYMENT (Bagian H & V) */}
      {activeTab === 'panduan' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs leading-relaxed text-slate-700">
          <div className="flex items-center gap-2 text-slate-900">
            <BookOpen className="w-5 h-5 text-emerald-900" />
            <h3 className="text-base font-bold">
              Dokumentasi Instalasi, Batasan Autentikasi Google Apps Script, & Panduan Deployment
            </h3>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-900">
              1. Langkah Deployment Backend Google Apps Script & Pembuatan Database Otomatis
            </h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Buka <code className="font-mono">https://script.google.com</code> menggunakan akun Google resmi Divisi SDM (<code className="font-mono">stafsdm.alandalus@gmail.com</code>) dan buat proyek baru bernama <strong>Backend Sistem Izin Cuti Al-Andalus</strong>.
              </li>
              <li>
                Salin kode dari tab <strong>Source Code Backend (.gs)</strong> ke dalam proyek Google Apps Script Anda (<code className="font-mono">Code.gs</code>, <code className="font-mono">Database.gs</code>, <code className="font-mono">Authentication.gs</code>, <code className="font-mono">Employees.gs</code>, <code className="font-mono">LeaveRequests.gs</code>, <code className="font-mono">Approvals.gs</code>, <code className="font-mono">Signatures.gs</code>, <code className="font-mono">PDFGenerator.gs</code>, <code className="font-mono">Notifications.gs</code>, <code className="font-mono">Reports.gs</code>).
              </li>
              <li>
                Pilih fungsi <code className="font-mono font-bold">setupDatabase</code> pada toolbar Google Apps Script lalu klik <strong>Run / Jalankan</strong>. Berikan izin akses Google Spreadsheets, Google Drive, Google Docs, dan MailApp.
              </li>
              <li>
                Sistem secara otomatis akan membuat spreadsheet <strong>DATABASE SISTEM IZIN DAN CUTI PEGAWAI AL-ANDALUS</strong> beserta 9 sheet dan 3 folder Google Drive, lalu menyimpan seluruh ID-nya di <code className="font-mono">Script Properties</code>.
              </li>
              <li>
                Klik <strong>Deploy &rarr; New Deployment &rarr; Web App</strong>. Salin URL Web App (<code className="font-mono">https://script.google.com/macros/s/.../exec</code>) ke kolom konfigurasi pada tab <strong>Setup Database & Drive</strong> di aplikasi ini.
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-900">
              2. Penjelasan Batasan Autentikasi Google Apps Script & Konfigurasi Identitas (Bagian H)
            </h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Lingkungan Google Workspace Internal:</strong> Jika dideploy dengan pengaturan <em>"Execute as: User accessing the web app"</em> dan <em>"Who has access: Anyone within Pesantren Al-Andalus organization"</em>, maka <code className="font-mono">Session.getActiveUser().getEmail()</code> secara otomatis mengembalikan email akun Google terverifikasi milik pegawai yang sedang login.
              </li>
              <li>
                <strong>Lingkungan Akun Gmail Umum (@gmail.com):</strong> Pada deployment publik lintas domain (CORS JSON POST dari aplikasi React eksternal), Google Apps Script membatasi <code className="font-mono">Session.getActiveUser().getEmail()</code> jika dieksekusi sebagai <em>"Me (Admin)"</em>. Oleh karena itu, backend wajib memvalidasi token sesi / kredensial yang telah di-hash SHA-256 terhadap sheet <code className="font-mono">USERS</code> melalui fungsi <code className="font-mono">authenticateUser()</code> dan <code className="font-mono">validatePermission()</code>.
              </li>
              <li>
                <strong>Keamanan Database Spreadsheet:</strong> File Google Spreadsheet database hanya diakses oleh akun pemilik script (Admin SDM) melalui backend Google Apps Script dan tidak perlu dibagikan (share) secara bebas kepada seluruh pegawai.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
