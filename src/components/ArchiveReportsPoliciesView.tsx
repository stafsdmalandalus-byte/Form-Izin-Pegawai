import React, { useState, useMemo } from 'react';
import { LeavePolicy, LeaveRequest, UserAccount } from '../types';
import {
  ARSIP_IZIN_ISO_FOLDER_NAME,
  ARSIP_IZIN_ISO_FOLDER_URL,
  FullDatabaseStore,
  getPesantrenHolidays,
  getTimestamp,
  getVisibleLeaveRequests,
  recordActivity,
  resolveClearArchiveUrl,
  saveDatabase,
  savePesantrenHolidays,
  uploadPdfToGasDriveFolder,
  validatePermission,
} from '../services/databaseService';
import {
  exportLeavePoliciesToExcel,
  exportLeaveReportToExcel,
} from '../utils/excelHelper';
import {
  formatOfficialPdfFilename,
  generateOfficialLeavePDF,
  generateOfficialLeaveWord,
} from '../utils/pdfGenerator';
import { jsPDF } from 'jspdf';
import {
  Search,
  Eye,
  Download,
  Printer,
  FileSpreadsheet,
  Edit3,
  FileText,
  FolderOpen,
  ExternalLink,
  Copy,
  CheckCheck,
  Link2,
  CalendarPlus,
  Trash2,
  UploadCloud,
  Loader2,
} from 'lucide-react';

interface ArchiveReportsPoliciesViewProps {
  mode: 'arsip' | 'laporan' | 'ketentuan';
  store: FullDatabaseStore;
  currentUser: UserAccount;
  onStoreUpdate: (next: FullDatabaseStore) => void;
  onPreviewOfficialPdf: (req: LeaveRequest) => void;
}

export const ArchiveReportsPoliciesView: React.FC<ArchiveReportsPoliciesViewProps> = ({
  mode,
  store,
  currentUser,
  onStoreUpdate,
  onPreviewOfficialPdf,
}) => {
  const [searchNameOrNo, setSearchNameOrNo] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterBidang, setFilterBidang] = useState('SEMUA');
  const [filterUnit, setFilterUnit] = useState('SEMUA');
  const [filterKategori, setFilterKategori] = useState('SEMUA');
  const [filterStatus, setFilterStatus] = useState('SEMUA');
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [uploadingReqId, setUploadingReqId] = useState<string | null>(null);
  const [driveUploadFeedback, setDriveUploadFeedback] = useState<string | null>(null);

  // State Kalender Libur Resmi Pesantren
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');

  // Policy edit state (Admin SDM only, logged in LOG_AKTIVITAS)
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);
  const [policyNoteMessage, setPolicyNoteMessage] = useState<string | null>(null);

  const isAdminSdm =
    currentUser.role === 'ADMIN SDM' || currentUser.role === 'SUPER ADMIN';

  const pesantrenHolidays = useMemo(() => getPesantrenHolidays(store), [store]);

  const handleAddPesantrenHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminSdm || !newHolidayDate || !newHolidayLabel.trim()) return;
    const filtered = pesantrenHolidays.filter((h) => h.tanggal !== newHolidayDate);
    const nextHolidays = [
      ...filtered,
      { tanggal: newHolidayDate, keterangan: newHolidayLabel.trim() },
    ];
    const nextStore = savePesantrenHolidays(store, nextHolidays, currentUser);
    onStoreUpdate(nextStore);
    setNewHolidayDate('');
    setNewHolidayLabel('');
    setPolicyNoteMessage(
      `Tanggal libur pesantren (${newHolidayDate} — ${newHolidayLabel.trim()}) berhasil disimpan dan tidak akan memotong kuota cuti tahunan.`
    );
  };

  const handleDeletePesantrenHoliday = (tanggal: string) => {
    if (!isAdminSdm) return;
    const nextHolidays = pesantrenHolidays.filter((h) => h.tanggal !== tanggal);
    const nextStore = savePesantrenHolidays(store, nextHolidays, currentUser);
    onStoreUpdate(nextStore);
  };

  const handleUploadSinglePdfToDrive = async (req: LeaveRequest) => {
    setUploadingReqId(req.idPermohonan);
    setDriveUploadFeedback(null);
    try {
      const emp = store.MASTER_PEGAWAI.find((e) => e.idPegawai === req.idPegawai);
      const pdfFileName = formatOfficialPdfFilename(req);
      const pdfBase64 = generateOfficialLeavePDF(req, emp, 'base64');
      const res = await uploadPdfToGasDriveFolder(store, req, pdfBase64, pdfFileName);
      onStoreUpdate(res.updatedStore);
      setDriveUploadFeedback(res.message);
    } finally {
      setUploadingReqId(null);
    }
  };

  const handleCopyUrl = (url: string, idKey: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedUrlId(idKey);
    setTimeout(() => {
      setCopiedUrlId((prev) => (prev === idKey ? null : prev));
    }, 2000);
  };

  const visibleRequests = useMemo(() => {
    const base = getVisibleLeaveRequests(store, currentUser);
    // Pada menu Arsip Dokumen, Pegawai (selain Admin SDM) hanya bisa melihat arsip dokumen milik mereka sendiri
    if (mode === 'arsip' && !isAdminSdm) {
      return store.PERMOHONAN.filter(
        (r) =>
          r.idPegawai === currentUser.idPegawai ||
          r.nip === currentUser.idPegawai ||
          r.namaPegawai.trim().toLowerCase() ===
            currentUser.namaPengguna.trim().toLowerCase()
      );
    }
    return base;
  }, [store, currentUser, mode, isAdminSdm]);

  const filteredRequests = useMemo(() => {
    return visibleRequests.filter((r) => {
      const q = searchNameOrNo.toLowerCase();
      const matchQuery =
        !q ||
        r.namaPegawai.toLowerCase().includes(q) ||
        r.nomorPermohonan.toLowerCase().includes(q) ||
        r.kategoriKeperluan.toLowerCase().includes(q);
      const matchStart = !filterStartDate || r.tanggalMulai >= filterStartDate;
      const matchEnd = !filterEndDate || r.tanggalSelesai <= filterEndDate;
      const matchBidang = filterBidang === 'SEMUA' || r.bidang === filterBidang;
      const matchUnit = filterUnit === 'SEMUA' || r.unit === filterUnit;
      const matchKat = filterKategori === 'SEMUA' || r.kategoriKeperluan === filterKategori;
      const matchStatus = filterStatus === 'SEMUA' || r.statusPermohonan === filterStatus;
      return (
        matchQuery &&
        matchStart &&
        matchEnd &&
        matchBidang &&
        matchUnit &&
        matchKat &&
        matchStatus
      );
    });
  }, [
    visibleRequests,
    searchNameOrNo,
    filterStartDate,
    filterEndDate,
    filterBidang,
    filterUnit,
    filterKategori,
    filterStatus,
  ]);

  const bidangOptions = Array.from(new Set(store.MASTER_PEGAWAI.map((e) => e.bidang))).filter(
    Boolean
  );

  // Export Summary Report to PDF (Section P: Laporan dan Rekapitulasi)
  const handleExportReportToPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.text(
      'LAPORAN DAN REKAPITULASI PERMOHONAN IZIN DAN CUTI PEGAWAI',
      148.5,
      14,
      { align: 'center' }
    );
    doc.setFontSize(10);
    doc.text(
      'PESANTREN ISLAM INTERNASIONAL AL-ANDALUS — DIVISI SDM & PENJAMINAN MUTU',
      148.5,
      20,
      { align: 'center' }
    );
    doc.setFontSize(8.5);
    doc.setFont('times', 'normal');
    doc.text(
      `Folder Arsip Izin ISO: ${ARSIP_IZIN_ISO_FOLDER_URL}`,
      148.5,
      25,
      { align: 'center' }
    );

    let y = 32;
    doc.setFont('times', 'bold');
    doc.setFontSize(7.5);
    const cols = [
      { label: 'No. Permohonan', x: 10 },
      { label: 'Nama Pegawai', x: 40 },
      { label: 'NIP', x: 76 },
      { label: 'Bidang/Bagian', x: 104 },
      { label: 'Jenis & Kategori', x: 140 },
      { label: 'Mulai - Selesai', x: 184 },
      { label: 'Hari', x: 215 },
      { label: 'Status', x: 230 },
      { label: 'Folder Arsip ISO', x: 262 },
    ];
    cols.forEach((c) => doc.text(c.label, c.x, y));
    doc.line(10, y + 2, 287, y + 2);
    y += 7;

    doc.setFont('times', 'normal');
    filteredRequests.forEach((r) => {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
      doc.text(r.nomorPermohonan, 10, y);
      doc.text(r.namaPegawai.slice(0, 20), 40, y);
      doc.text(r.nip || '-', 76, y);
      doc.text(`${r.bidang}/${r.bagian}`.slice(0, 20), 104, y);
      doc.text(`${r.jenisPermohonan}: ${r.kategoriKeperluan}`.slice(0, 25), 140, y);
      doc.text(`${r.tanggalMulai} - ${r.tanggalSelesai}`, 184, y);
      doc.text(String(r.jumlahHari).slice(0, 8), 215, y);
      doc.text(r.statusPermohonan.slice(0, 18), 230, y);
      doc.text(ARSIP_IZIN_ISO_FOLDER_NAME, 262, y);
      y += 6;
    });

    doc.save(`Laporan_Rekapitulasi_Izin_Cuti_AlAndalus_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleSavePolicyNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;
    const perm = validatePermission(currentUser, ['ADMIN SDM', 'SUPER ADMIN']);
    if (!perm.valid) return;

    const updatedStore = { ...store };
    const ts = getTimestamp();
    updatedStore.KETENTUAN_IZIN_CUTI = updatedStore.KETENTUAN_IZIN_CUTI.map((p) =>
      p.idKategori === editingPolicy.idKategori ? { ...editingPolicy, tanggalDiperbarui: ts } : p
    );

    recordActivity(
      updatedStore,
      currentUser,
      'UPDATE_KETENTUAN_IZIN_CUTI',
      'KETENTUAN_IZIN_CUTI',
      editingPolicy.idKategori,
      `Memperbarui catatan/status kebijakan: ${editingPolicy.namaKeperluan}`
    );

    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    setEditingPolicy(null);
    setPolicyNoteMessage(
      `Perubahan pada ketentuan "${editingPolicy.namaKeperluan}" telah disimpan dan dicatat ke LOG_AKTIVITAS.`
    );
  };

  // ===========================================================================
  // MODE 1: KETENTUAN RESMI IZIN & CUTI PEGAWAI (RESPONSIF HP & LAPTOP)
  // ===========================================================================
  if (mode === 'ketentuan') {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-[#d1d7db] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#008069]">
              PEDOMAN RESMI SDM AL-ANDALUS
            </span>
            <h2 className="text-base sm:text-lg font-bold text-[#111b21] mt-0.5">
              Ketentuan Resmi Izin dan Cuti Pegawai (16 Kategori)
            </h2>
            <p className="text-xs text-[#667781] mt-0.5">
              Sumber Data: <code className="font-mono bg-[#f0f2f5] px-1.5 py-0.5 rounded">Ketentuan_Izin_Cuti_Pegawai.xlsx</code> (Sheet: <code className="font-mono bg-[#f0f2f5] px-1.5 py-0.5 rounded">KETENTUAN_IZIN_CUTI</code>)
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportLeavePoliciesToExcel(store.KETENTUAN_IZIN_CUTI)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-full whitespace-nowrap shrink-0 shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Unduh Ketentuan (.xlsx)
          </button>
        </div>

        {policyNoteMessage && (
          <div className="p-3.5 rounded-xl bg-[#d9fdd3] border border-[#b7f0ad] text-[#111b21] text-xs flex items-center justify-between gap-3">
            <span>{policyNoteMessage}</span>
            <button
              type="button"
              onClick={() => setPolicyNoteMessage(null)}
              className="font-bold text-[#008069] underline shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {editingPolicy && (
          <form
            onSubmit={handleSavePolicyNote}
            className="bg-white border-2 border-[#008069] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm"
          >
            <h3 className="text-sm font-bold text-[#111b21]">
              Kelola Kebijakan (Khusus Admin SDM) — {editingPolicy.idKategori}
            </h3>
            <p className="text-xs text-[#667781]">
              Nama kategori, durasi, dan minimal pengajuan asli dipertahankan sesuai dokumen resmi. Admin SDM dapat memperbarui keterangan operasional atau status aktif.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[#111b21] mb-1">
                  Keperluan Izin/Cuti
                </label>
                <input
                  type="text"
                  readOnly
                  value={editingPolicy.namaKeperluan}
                  className="w-full px-3 py-2 bg-[#f0f2f5] border border-[#d1d7db] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111b21] mb-1">
                  Durasi Resmi
                </label>
                <input
                  type="text"
                  readOnly
                  value={editingPolicy.durasi}
                  className="w-full px-3 py-2 bg-[#f0f2f5] border border-[#d1d7db] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111b21] mb-1">
                  Pengajuan Minimal
                </label>
                <input
                  type="text"
                  readOnly
                  value={editingPolicy.minimalPengajuan}
                  className="w-full px-3 py-2 bg-[#f0f2f5] border border-[#d1d7db] rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="md:col-span-3">
                <label className="block font-semibold text-[#111b21] mb-1">
                  Keterangan Pemeriksaan SDM
                </label>
                <input
                  type="text"
                  value={editingPolicy.keterangan}
                  onChange={(e) =>
                    setEditingPolicy({ ...editingPolicy, keterangan: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#d1d7db] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#111b21] mb-1">Status Aktif</label>
                <select
                  value={editingPolicy.statusAktif}
                  onChange={(e) =>
                    setEditingPolicy({
                      ...editingPolicy,
                      statusAktif: e.target.value as 'Aktif' | 'Nonaktif',
                    })
                  }
                  className="w-full px-3 py-2 border border-[#d1d7db] rounded-lg bg-white"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPolicy(null)}
                className="px-4 py-2 text-xs font-semibold bg-[#f0f2f5] rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-lg"
              >
                Simpan & Catat Log
              </button>
            </div>
          </form>
        )}

        {/* Tampilan Kartu Gelembung di HP (Mobile) */}
        <div className="md:hidden space-y-2.5">
          {store.KETENTUAN_IZIN_CUTI.map((pol, index) => (
            <div
              key={pol.idKategori}
              className="bg-white border border-[#d1d7db] rounded-xl p-3.5 space-y-2 shadow-2xs text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] text-[#008069] font-bold">
                    #{index + 1} · {pol.idKategori}
                  </span>
                  <h3 className="font-bold text-[#111b21] text-sm mt-0.5">
                    {pol.namaKeperluan}
                  </h3>
                </div>
                {isAdminSdm && (
                  <button
                    type="button"
                    onClick={() => setEditingPolicy(pol)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#008069] bg-[#f0f2f5] rounded-lg shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Kelola
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#d9fdd3]/60 border border-[#b7f0ad]">
                <div>
                  <span className="text-[10px] text-[#54656f] block">Hak Durasi:</span>
                  <strong className="text-[#008069]">{pol.durasi}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#54656f] block">Minimal Pengajuan:</span>
                  <strong className="text-[#111b21]">{pol.minimalPengajuan}</strong>
                </div>
              </div>
              <p className="text-[#54656f] leading-relaxed">{pol.keterangan}</p>
            </div>
          ))}
        </div>

        {/* Tampilan Tabel di Laptop (Desktop) */}
        <div className="hidden md:block bg-white border border-[#d1d7db] rounded-xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#008069] text-white font-semibold">
                <th className="py-3 px-4 w-12">No</th>
                <th className="py-3 px-4">ID Kategori</th>
                <th className="py-3 px-4">Keperluan Izin/Cuti</th>
                <th className="py-3 px-4">Durasi</th>
                <th className="py-3 px-4">Pengajuan Minimal</th>
                <th className="py-3 px-4">Keterangan</th>
                {isAdminSdm && <th className="py-3 px-4 text-right">Aksi SDM</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9edef]">
              {store.KETENTUAN_IZIN_CUTI.map((pol, index) => (
                <tr key={pol.idKategori} className="hover:bg-[#f0f2f5]/60">
                  <td className="py-3 px-4 font-mono font-semibold text-[#54656f] tabular-nums">
                    {index + 1}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#54656f]">{pol.idKategori}</td>
                  <td className="py-3 px-4 font-bold text-[#111b21]">{pol.namaKeperluan}</td>
                  <td className="py-3 px-4 font-bold text-[#008069]">{pol.durasi}</td>
                  <td className="py-3 px-4 text-[#111b21]">{pol.minimalPengajuan}</td>
                  <td className="py-3 px-4 text-[#54656f]">{pol.keterangan}</td>
                  {isAdminSdm && (
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingPolicy(pol)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#008069] bg-[#f0f2f5] hover:bg-[#e9edef] rounded-lg"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Kelola
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* KALENDER HARI LIBUR RESMI PESANTREN (TIDAK MEMOTONG KUOTA CUTI TAHUNAN 12 HARI) */}
        <div className="bg-white border border-[#d1d7db] rounded-xl p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e9edef] pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#008069]">
                KALENDER HARI EFEKTIF & LIBUR RESMI PESANTREN
              </span>
              <h3 className="text-sm sm:text-base font-bold text-[#111b21] mt-0.5">
                Daftar Hari Libur / Hari Raya Pesantren (Tidak Memotong Kuota Cuti 12 Hari)
              </h3>
              <p className="text-xs text-[#667781] mt-0.5">
                Tanggal yang terdaftar di bawah ini secara otomatis dikecualikan saat pegawai mengajukan rentang tanggal izin/cuti.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#d9fdd3] text-[#008069] font-mono text-xs font-bold shrink-0">
              {pesantrenHolidays.length} Hari Libur Terdaftar
            </span>
          </div>

          {isAdminSdm && (
            <form
              onSubmit={handleAddPesantrenHoliday}
              className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#d1d7db] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs"
            >
              <div className="sm:col-span-4">
                <label className="block font-bold text-[#111b21] mb-1">
                  Tanggal Libur Resmi
                </label>
                <input
                  type="date"
                  required
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#d1d7db] rounded-lg font-mono"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="block font-bold text-[#111b21] mb-1">
                  Nama Hari Libur / Keterangan
                </label>
                <input
                  type="text"
                  required
                  value={newHolidayLabel}
                  onChange={(e) => setNewHolidayLabel(e.target.value)}
                  placeholder="Contoh: Libur Semester / Hari Raya Idul Fitri..."
                  className="w-full px-3 py-2 bg-white border border-[#d1d7db] rounded-lg"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-[#00a884] hover:bg-[#008069] text-white font-bold rounded-lg inline-flex items-center justify-center gap-1.5"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Tambah Hari Libur
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {pesantrenHolidays.map((h) => (
              <div
                key={h.tanggal}
                className="p-3 rounded-xl bg-[#f8f9fa] border border-[#d1d7db] flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-mono font-bold text-[#008069]">{h.tanggal}</div>
                  <div className="text-[#111b21] font-medium truncate">{h.keterangan}</div>
                </div>
                {isAdminSdm && (
                  <button
                    type="button"
                    onClick={() => handleDeletePesantrenHoliday(h.tanggal)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                    title="Hapus tanggal libur"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // MODE 2 & 3: ARSIP DOKUMEN PDF (TERPUSAT DI "Arsip izin ISO") & LAPORAN SDM
  // ===========================================================================
  return (
    <div className="space-y-4">
      {/* Header Arsip atau Laporan */}
      <div className="bg-white border border-[#d1d7db] rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#008069]">
            {mode === 'arsip'
              ? 'PENYIMPANAN DOKUMEN RESMI ISO (AIS-FRM-SEK.02.11)'
              : 'REKAPITULASI & EKSPOR DATA SDM'}
          </span>
          <h2 className="text-base sm:text-lg font-bold text-[#111b21] mt-0.5">
            {mode === 'arsip'
              ? isAdminSdm
                ? 'Arsip Permohonan & Dokumen PDF Seluruh Pegawai'
                : `Arsip Dokumen PDF Saya — ${currentUser.namaPengguna}`
              : 'Laporan dan Rekapitulasi Izin / Cuti Pegawai'}
          </h2>
          <p className="text-xs text-[#667781] mt-0.5">
            {mode === 'arsip'
              ? isAdminSdm
                ? 'Seluruh dokumen izin & cuti resmi diletakkan terpusat di dalam satu folder Google Drive: Arsip izin ISO.'
                : 'Menampilkan khusus arsip dokumen permohonan izin dan cuti milik Anda sendiri beserta tautan Arsip izin ISO.'
              : 'Rekapitulasi lengkap permohonan izin/cuti pegawai dengan fitur ekspor ke Excel (.xlsx) dan PDF.'}
          </p>
        </div>

        {mode === 'laporan' && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportLeaveReportToExcel(filteredRequests, store.MASTER_PEGAWAI)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#008069] bg-[#d9fdd3] border border-[#b7f0ad] hover:bg-[#b7f0ad] rounded-full whitespace-nowrap shrink-0 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Ekspor Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={handleExportReportToPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-full whitespace-nowrap shrink-0 transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4" />
              Ekspor Rekap PDF
            </button>
          </div>
        )}
      </div>

      {driveUploadFeedback && (
        <div className="p-3.5 rounded-xl bg-[#d9fdd3] border border-[#b7f0ad] text-[#111b21] text-xs flex items-center justify-between gap-3">
          <span>{driveUploadFeedback}</span>
          <button
            type="button"
            onClick={() => setDriveUploadFeedback(null)}
            className="font-bold text-[#008069] underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* KARTU UTAMA FOLDER GOOGLE DRIVE TERPUSAT: "Arsip izin ISO" (SERTAKAN URL YANG JELAS) */}
      <div className="bg-[#d9fdd3] border border-[#b7f0ad] rounded-xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#008069] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-[#111b21]">
                  Folder Terpusat Google Drive: {ARSIP_IZIN_ISO_FOLDER_NAME}
                </span>
                <span className="text-[11px] font-mono text-[#008069] font-semibold">
                  · Kode: AIS-FRM-SEK.02.11 Rev. 1
                </span>
              </div>
              <p className="text-xs text-[#54656f] mt-0.5">
                Seluruh dokumen PDF/Word permohonan izin dan cuti yang telah disetujui ditempatkan di dalam satu folder resmi <strong>{ARSIP_IZIN_ISO_FOLDER_NAME}</strong> pada URL berikut:
              </p>
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 bg-white/90 border border-[#00a884]/40 rounded-lg px-3 py-2">
                <Link2 className="w-4 h-4 text-[#008069] shrink-0 hidden sm:block" />
                <a
                  href={ARSIP_IZIN_ISO_FOLDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono font-semibold text-[#008069] hover:underline break-all flex-1"
                >
                  {ARSIP_IZIN_ISO_FOLDER_URL}
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyUrl(ARSIP_IZIN_ISO_FOLDER_URL, 'MAIN_FOLDER')}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-[#111b21] bg-white border border-[#d1d7db] hover:bg-[#f0f2f5] rounded-xl transition-colors"
            >
              {copiedUrlId === 'MAIN_FOLDER' ? (
                <>
                  <CheckCheck className="w-4 h-4 text-[#00a884]" />
                  <span>URL Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#008069]" />
                  <span>Salin URL Folder</span>
                </>
              )}
            </button>

            <a
              href={ARSIP_IZIN_ISO_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#008069] hover:bg-[#075e54] rounded-xl shadow-xs transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka Folder &ldquo;{ARSIP_IZIN_ISO_FOLDER_NAME}&rdquo;</span>
            </a>
          </div>
        </div>
      </div>

      {/* Filter Bar Pencarian Lengkap */}
      <div
        className={`bg-white border border-[#d1d7db] rounded-xl p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-2 ${
          isAdminSdm ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
        } gap-3 text-xs shadow-2xs`}
      >
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-[11px] font-bold text-[#54656f] mb-1">
            {isAdminSdm
              ? 'Cari Nama Pegawai / Nomor Permohonan'
              : 'Cari Nomor Permohonan / Keperluan Saya'}
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#54656f] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchNameOrNo}
              onChange={(e) => setSearchNameOrNo(e.target.value)}
              placeholder={
                isAdminSdm
                  ? 'Contoh: AIS-IZC-2026-0001 atau Nama...'
                  : 'Contoh: AIS-IZC-2026-0001...'
              }
              className="w-full pl-8 pr-3 py-2 bg-[#f0f2f5] border border-[#d1d7db] rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#54656f] mb-1">
            Dari Tanggal
          </label>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="w-full px-2.5 py-2 bg-[#f0f2f5] border border-[#d1d7db] rounded-lg font-mono"
          />
        </div>

        {isAdminSdm && (
          <div>
            <label className="block text-[11px] font-bold text-[#54656f] mb-1">
              Bidang / Unit
            </label>
            <select
              value={filterBidang}
              onChange={(e) => setFilterBidang(e.target.value)}
              className="w-full px-2.5 py-2 bg-[#f0f2f5] border border-[#d1d7db] rounded-lg"
            >
              <option value="SEMUA">Semua Bidang</option>
              {bidangOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-[#54656f] mb-1">
            Kategori Izin/Cuti
          </label>
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="w-full px-2.5 py-2 bg-[#f0f2f5] border border-[#d1d7db] rounded-lg"
          >
            <option value="SEMUA">Semua Kategori</option>
            {store.KETENTUAN_IZIN_CUTI.map((k) => (
              <option key={k.idKategori} value={k.namaKeperluan}>
                {k.namaKeperluan}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-[#54656f] mb-1">
            Status Dokumen
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-2.5 py-2 bg-[#f0f2f5] border border-[#d1d7db] rounded-lg"
          >
            <option value="SEMUA">Semua Status</option>
            <option value="DISETUJUI">DISETUJUI</option>
            <option value="DIARSIPKAN">DIARSIPKAN</option>
            <option value="MENUNGGU PERSETUJUAN ATASAN">MENUNGGU ATASAN</option>
            <option value="MENUNGGU PERSETUJUAN MUDIR">MENUNGGU MUDIR</option>
            <option value="PERLU REVISI ATASAN">REVISI ATASAN</option>
            <option value="DITOLAK ATASAN">DITOLAK ATASAN</option>
            <option value="DITOLAK MUDIR">DITOLAK MUDIR</option>
          </select>
        </div>
      </div>

      {/* TAMPILAN KARTU GELEMBUNG CHAT DI HP (MOBILE VIEW < 768px) */}
      <div className="md:hidden space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="bg-white border border-[#d1d7db] rounded-xl p-6 text-center text-xs text-[#667781]">
            Tidak ada dokumen arsip yang sesuai dengan filter pencarian.
          </div>
        ) : (
          filteredRequests.map((req) => {
            const emp = store.MASTER_PEGAWAI.find((e) => e.idPegawai === req.idPegawai);
            const pdfFileName = formatOfficialPdfFilename(req);
            const clearDriveUrl = resolveClearArchiveUrl(req.urlPdf);
            const isApproved =
              req.statusPermohonan === 'DISETUJUI' || req.statusPermohonan === 'DIARSIPKAN';

            return (
              <div
                key={req.idPermohonan}
                className="bg-white border border-[#d1d7db] rounded-xl p-4 shadow-2xs space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2 border-b border-[#f0f2f5] pb-2.5">
                  <div>
                    <span className="font-mono font-bold text-[#008069] text-xs">
                      {req.nomorPermohonan}
                    </span>
                    <h3 className="font-bold text-[#111b21] text-sm mt-0.5">
                      {req.namaPegawai}
                    </h3>
                    <p className="text-[11px] text-[#667781]">
                      {req.bidang} / {req.bagian} ({req.unit})
                    </p>
                  </div>
                  <span
                    className={`font-bold text-[11px] px-2 py-0.5 rounded ${
                      isApproved
                        ? 'bg-[#d9fdd3] text-[#008069]'
                        : 'bg-[#f0f2f5] text-[#54656f]'
                    }`}
                  >
                    {req.statusPermohonan}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-[#667781] block">Jenis & Kategori:</span>
                    <strong className="text-[#111b21]">{req.jenisPermohonan}</strong> —{' '}
                    {req.kategoriKeperluan}
                  </div>
                  <div>
                    <span className="text-[11px] text-[#667781] block">Tanggal & Durasi:</span>
                    <span className="font-mono font-semibold text-[#111b21]">
                      {req.tanggalMulai} s/d {req.tanggalSelesai} ({req.jumlahHari})
                    </span>
                  </div>
                </div>

                {/* Kotak URL Jelas File Arsip izin ISO */}
                <div className="p-2.5 rounded-lg bg-[#f0f2f5] border border-[#d1d7db] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#008069] flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5" />
                      File di Folder &ldquo;{ARSIP_IZIN_ISO_FOLDER_NAME}&rdquo;:
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#111b21] truncate">
                      {pdfFileName}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#54656f] break-all font-mono bg-white px-2.5 py-1.5 rounded border border-[#d1d7db]">
                    <a
                      href={clearDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#008069] hover:underline font-semibold"
                    >
                      {clearDriveUrl}
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={clearDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 text-[11px] font-bold text-white bg-[#008069] hover:bg-[#075e54] rounded-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Buka di Arsip izin ISO
                    </a>
                    <button
                      type="button"
                      onClick={() => handleUploadSinglePdfToDrive(req)}
                      disabled={uploadingReqId === req.idPermohonan}
                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 text-[11px] font-bold text-[#008069] bg-[#d9fdd3] border border-[#b7f0ad] rounded-lg"
                    >
                      {uploadingReqId === req.idPermohonan ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5" />
                      )}
                      Upload ke Drive
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(clearDriveUrl, req.idPermohonan)}
                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 text-[11px] font-semibold text-[#111b21] bg-white border border-[#d1d7db] rounded-lg"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#008069]" />
                      {copiedUrlId === req.idPermohonan ? 'Tersalin' : 'Salin URL'}
                    </button>
                  </div>
                </div>

                {/* Tombol Aksi Dokumen di HP */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onPreviewOfficialPdf(req)}
                    className="inline-flex items-center justify-center gap-1 py-2 px-2 text-xs font-semibold text-[#111b21] bg-[#f0f2f5] hover:bg-[#e9edef] rounded-lg"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Pratinjau
                  </button>
                  <button
                    type="button"
                    onClick={() => generateOfficialLeavePDF(req, emp, 'download')}
                    className="inline-flex items-center justify-center gap-1 py-2 px-2 text-xs font-bold text-[#008069] bg-[#d9fdd3] border border-[#b7f0ad] rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF (A4)
                  </button>
                  <button
                    type="button"
                    onClick={() => generateOfficialLeaveWord(req, emp)}
                    className="inline-flex items-center justify-center gap-1 py-2 px-2 text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Word (A4)
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* TAMPILAN TABEL LENGKAP DI LAPTOP (DESKTOP VIEW >= 768px) */}
      <div className="hidden md:block bg-white border border-[#d1d7db] rounded-xl overflow-x-auto shadow-2xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#008069] text-white font-semibold">
              <th className="py-3 px-3">Nomor & Tanggal</th>
              <th className="py-3 px-3">Nama Pegawai</th>
              <th className="py-3 px-3">Bidang / Unit</th>
              <th className="py-3 px-3">Jenis & Keperluan</th>
              <th className="py-3 px-3">Tanggal Cuti/Izin</th>
              <th className="py-3 px-3">Status & Penyetuju</th>
              <th className="py-3 px-3">File & URL Folder &ldquo;{ARSIP_IZIN_ISO_FOLDER_NAME}&rdquo;</th>
              <th className="py-3 px-3 text-right">Unduh / Cetak A4</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9edef]">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#667781]">
                  Tidak ada data permohonan yang sesuai dengan filter pencarian.
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => {
                const emp = store.MASTER_PEGAWAI.find((e) => e.idPegawai === req.idPegawai);
                const pdfFileName = formatOfficialPdfFilename(req);
                const clearDriveUrl = resolveClearArchiveUrl(req.urlPdf);

                return (
                  <tr key={req.idPermohonan} className="hover:bg-[#f0f2f5]/60 align-top">
                    <td className="py-3 px-3 font-mono font-bold text-[#008069] tabular-nums">
                      {req.nomorPermohonan}
                      <div className="text-[11px] font-normal text-[#667781] mt-0.5">
                        {req.tanggalPengajuan}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#111b21]">{req.namaPegawai}</div>
                      <div className="text-[11px] text-[#667781]">{req.jabatan}</div>
                    </td>
                    <td className="py-3 px-3 text-[#111b21]">
                      {req.bidang} / {req.bagian}
                      <div className="text-[11px] text-[#667781]">{req.unit}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#008069]">{req.jenisPermohonan}</div>
                      <div className="text-[11px] text-[#54656f]">{req.kategoriKeperluan}</div>
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-[#111b21]">
                      <div>
                        {req.tanggalMulai} s/d {req.tanggalSelesai}
                      </div>
                      <div className="font-sans font-bold text-[#008069]">{req.jumlahHari}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#111b21]">{req.statusPermohonan}</div>
                      <div className="text-[11px] text-[#667781] mt-0.5">
                        Atasan: {req.namaAtasan || req.statusAtasan}
                      </div>
                      <div className="text-[11px] text-[#667781]">
                        Mudir: {req.namaMudir || req.statusMudir}
                      </div>
                    </td>
                    {/* Kolom URL Jelas di Folder Arsip izin ISO */}
                    <td className="py-3 px-3 max-w-xs">
                      <div className="font-mono font-bold text-[11px] text-[#111b21] truncate">
                        {pdfFileName}
                      </div>
                      <div className="text-[10px] font-semibold text-[#008069] mt-0.5">
                        Folder: {ARSIP_IZIN_ISO_FOLDER_NAME}
                      </div>
                      <a
                        href={clearDriveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-mono text-[10px] text-blue-700 hover:underline break-all mt-0.5"
                        title="Klik untuk membuka Folder Arsip izin ISO di Google Drive"
                      >
                        {clearDriveUrl}
                      </a>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <a
                          href={clearDriveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white bg-[#008069] hover:bg-[#075e54] rounded"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Buka Drive
                        </a>
                        <button
                          type="button"
                          onClick={() => handleUploadSinglePdfToDrive(req)}
                          disabled={uploadingReqId === req.idPermohonan}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#008069] bg-[#d9fdd3] hover:bg-[#b7f0ad] border border-[#b7f0ad] rounded"
                          title="Simpan / Upload file PDF ini langsung ke dalam Folder Google Drive Arsip izin ISO"
                        >
                          {uploadingReqId === req.idPermohonan ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UploadCloud className="w-3 h-3" />
                          )}
                          Upload Drive
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(clearDriveUrl, req.idPermohonan)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[#111b21] bg-[#f0f2f5] hover:bg-[#e9edef] border border-[#d1d7db] rounded"
                        >
                          <Copy className="w-3 h-3 text-[#008069]" />
                          {copiedUrlId === req.idPermohonan ? 'Tersalin!' : 'Salin URL'}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onPreviewOfficialPdf(req)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#111b21] bg-[#f0f2f5] hover:bg-[#e9edef] rounded-lg"
                          title="Lihat Detail & Pratinjau PDF"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Pratinjau
                        </button>
                        <button
                          type="button"
                          onClick={() => generateOfficialLeavePDF(req, emp, 'download')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#008069] bg-[#d9fdd3] border border-[#b7f0ad] hover:bg-[#b7f0ad] rounded-lg"
                          title="Download PDF Resmi (A4)"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => generateOfficialLeaveWord(req, emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg"
                          title="Download Word Resmi (.doc A4)"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Word
                        </button>
                        <button
                          type="button"
                          onClick={() => onPreviewOfficialPdf(req)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-[#54656f] bg-[#f0f2f5] hover:bg-[#e9edef] rounded-lg"
                          title="Cetak Dokumen"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
