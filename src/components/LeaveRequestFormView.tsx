import React, { useState, useMemo } from 'react';
import {
  ApprovalRecord,
  Employee,
  LeaveRequest,
  UserAccount,
} from '../types';
import {
  createNotification,
  FullDatabaseStore,
  generateRequestNumber,
  getTimestamp,
  recordActivity,
  saveDatabase,
} from '../services/databaseService';
import { SignaturePad } from './SignaturePad';
import { OfficialLetterPaper } from './OfficialFormModal';
import {
  formatWhatsAppUrl,
  generateFollowUpMessageText,
} from '../utils/messageShareHelper';
import { triggerWhatsAppAutomation } from '../services/whatsappNotificationService';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Save,
  Send,
  ShieldAlert,
  Info,
  Smartphone,
} from 'lucide-react';

interface LeaveRequestFormViewProps {
  store: FullDatabaseStore;
  currentUser: UserAccount;
  editingRequest?: LeaveRequest | null;
  onStoreUpdate: (next: FullDatabaseStore) => void;
  onSuccessNavigate: () => void;
}

export const LeaveRequestFormView: React.FC<LeaveRequestFormViewProps> = ({
  store,
  currentUser,
  editingRequest,
  onStoreUpdate,
  onSuccessNavigate,
}) => {
  // Cari profil pegawai dari MASTER_PEGAWAI berdasarkan akun yang sedang login
  const linkedEmployee: Employee | undefined = useMemo(() => {
    return store.MASTER_PEGAWAI.find(
      (e) =>
        e.idPegawai === currentUser.idPegawai ||
        e.email.toLowerCase() === currentUser.email.toLowerCase()
    );
  }, [store.MASTER_PEGAWAI, currentUser]);

  const activePolicies = useMemo(
    () => store.KETENTUAN_IZIN_CUTI.filter((p) => p.statusAktif === 'Aktif'),
    [store.KETENTUAN_IZIN_CUTI]
  );

  const [jenisPermohonan, setJenisPermohonan] = useState<
    'Izin' | 'Cuti' | 'Izin Kondisional/Khusus'
  >(editingRequest?.jenisPermohonan || 'Izin');

  const [kategoriKeperluan, setKategoriKeperluan] = useState<string>(
    editingRequest?.kategoriKeperluan || activePolicies[0]?.namaKeperluan || ''
  );

  const [tanggalMulai, setTanggalMulai] = useState<string>(
    editingRequest?.tanggalMulai || new Date().toISOString().slice(0, 10)
  );
  const [tanggalSelesai, setTanggalSelesai] = useState<string>(
    editingRequest?.tanggalSelesai || new Date().toISOString().slice(0, 10)
  );
  const [alasan, setAlasan] = useState<string>(editingRequest?.alasan || '');
  const [keteranganTambahan, setKeteranganTambahan] = useState<string>(
    editingRequest?.keteranganTambahan || ''
  );
  const [lampiranName, setLampiranName] = useState<string>(editingRequest?.lampiran || '');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>(
    editingRequest?.ttdPemohonUrl || ''
  );

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cari data Atasan Langsung untuk pengiriman langsung ke WhatsApp saat klik Konfirmasi & Kirim Sekarang
  const supervisorEmployee: Employee | undefined = useMemo(() => {
    if (!linkedEmployee) return undefined;
    return (
      store.MASTER_PEGAWAI.find((e) => e.idPegawai === linkedEmployee.idAtasanLangsung) ||
      store.MASTER_PEGAWAI.find(
        (e) =>
          e.unit === linkedEmployee.unit &&
          e.idPegawai !== linkedEmployee.idPegawai &&
          (e.jabatan.toLowerCase().includes('kepala') ||
            e.jabatan.toLowerCase().includes('kabid') ||
            e.jabatan.toLowerCase().includes('atasan'))
      )
    );
  }, [store.MASTER_PEGAWAI, linkedEmployee]);

  const [supervisorWaPhone, setSupervisorWaPhone] = useState<string>(() =>
    supervisorEmployee?.nomorTelepon && supervisorEmployee.nomorTelepon !== '-'
      ? supervisorEmployee.nomorTelepon
      : ''
  );

  const selectedPolicy = useMemo(
    () => activePolicies.find((p) => p.namaKeperluan === kategoriKeperluan),
    [activePolicies, kategoriKeperluan]
  );

  // Periksa apakah kategori memiliki durasi Kebijaksanaan atau Pemeriksaan Medis Manual (Bagian I & J)
  const requiresDiscretionOrMedical = useMemo(() => {
    if (!selectedPolicy) return false;
    const d = selectedPolicy.durasi.toLowerCase();
    return (
      d.includes('kebijaksanaan') ||
      d.includes('sesuai sakit umum') ||
      jenisPermohonan === 'Izin Kondisional/Khusus'
    );
  }, [selectedPolicy, jenisPermohonan]);

  // Hitung jumlah hari secara otomatis, KECUALI untuk durasi Kebijaksanaan / Sesuai sakit umum (Aturan J.6)
  const calculatedJumlahHari = useMemo(() => {
    if (selectedPolicy?.durasi === 'Kebijaksanaan') {
      return 'Kebijaksanaan Pimpinan (Pemeriksaan Manual)';
    }
    if (selectedPolicy?.durasi === 'Sesuai sakit umum') {
      return 'Sesuai Pemeriksaan Medis Resmi';
    }
    if (!tanggalMulai || !tanggalSelesai) return '-';
    const start = new Date(tanggalMulai);
    const end = new Date(tanggalSelesai);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return 'Tanggal tidak valid';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return `${days} Hari`;
  }, [tanggalMulai, tanggalSelesai, selectedPolicy]);

  // Jika data pegawai belum ada di MASTER_PEGAWAI (Aturan Bagian F: Jangan buat nama pegawai fiktif)
  if (!linkedEmployee) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 max-w-2xl mx-auto text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">
          Profil Pegawai Belum Terhubung di MASTER_PEGAWAI
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Akun Anda (<strong>{currentUser.namaPengguna}</strong> · <code className="font-mono">{currentUser.idPegawai}</code>) belum memiliki data profil pada sheet <code className="font-mono">MASTER_PEGAWAI</code>. Sesuai aturan sistem, formulir permohonan mengisi nama, NIP, bidang, bagian, dan jabatan secara otomatis dari database pegawai.
        </p>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 text-left">
          <strong>Petunjuk Tindakan:</strong> Admin SDM harus mengimpor data pegawai dari Excel atau menambahkan data pegawai dengan ID Pegawai <code className="font-mono font-bold">{currentUser.idPegawai}</code> atau email <code className="font-mono font-bold">{currentUser.email}</code> pada menu <strong>Master Data Pegawai</strong> terlebih dahulu.
        </div>
      </div>
    );
  }

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLampiranName(`${file.name} (${Math.round(file.size / 1024)} KB)`);
    }
  };

  const handleSaveAsDraft = () => {
    setErrorMsg(null);
    const updatedStore = { ...store };
    const ts = getTimestamp();
    const nomor = editingRequest?.nomorPermohonan || generateRequestNumber(updatedStore);
    const idPermohonan = editingRequest?.idPermohonan || `REQ-${Date.now()}`;

    const draftReq: LeaveRequest = {
      idPermohonan,
      nomorPermohonan: nomor,
      idPegawai: linkedEmployee.idPegawai,
      namaPegawai: linkedEmployee.namaLengkap,
      nip: linkedEmployee.nip,
      bidang: linkedEmployee.bidang,
      bagian: linkedEmployee.bagian,
      jabatan: linkedEmployee.jabatan,
      unit: linkedEmployee.unit,
      jenisPermohonan,
      kategoriKeperluan,
      tanggalMulai,
      tanggalSelesai,
      jumlahHari: calculatedJumlahHari,
      alasan: alasan || '-',
      keteranganTambahan: keteranganTambahan || '-',
      lampiran: lampiranName || '-',
      tanggalPengajuan: ts,
      statusPermohonan: 'DRAFT',
      statusAtasan: 'BELUM DIPROSES',
      statusMudir: 'BELUM DIPROSES',
      catatanAtasan: editingRequest?.catatanAtasan || '-',
      catatanMudir: editingRequest?.catatanMudir || '-',
      catatanSdm: editingRequest?.catatanSdm || '-',
      urlPdf: '-',
      tanggalDisetujui: '-',
      tanggalDiarsipkan: '-',
      ttdPemohonUrl: signatureDataUrl,
      waktuTtdPemohon: signatureDataUrl ? ts : undefined,
    };

    if (editingRequest) {
      updatedStore.PERMOHONAN = updatedStore.PERMOHONAN.map((r) =>
        r.idPermohonan === editingRequest.idPermohonan ? draftReq : r
      );
    } else {
      updatedStore.PERMOHONAN = [draftReq, ...updatedStore.PERMOHONAN];
    }

    recordActivity(
      updatedStore,
      currentUser,
      'SIMPAN_DRAFT',
      'PERMOHONAN',
      nomor,
      `Menyimpan draft permohonan ${jenisPermohonan} (${kategoriKeperluan})`
    );

    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    onSuccessNavigate();
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (new Date(tanggalSelesai) < new Date(tanggalMulai)) {
      setErrorMsg('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }
    if (!alasan.trim()) {
      setErrorMsg('Alasan permohonan izin/cuti wajib diisi.');
      return;
    }
    if (!signatureDataUrl) {
      setErrorMsg('Tanda tangan digital pemohon wajib diisi sebelum mengirim permohonan.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleFinalSubmit = () => {
    const updatedStore = { ...store };
    const ts = getTimestamp();
    const nomor = editingRequest?.nomorPermohonan || generateRequestNumber(updatedStore);
    const idPermohonan = editingRequest?.idPermohonan || `REQ-${Date.now()}`;

    const submittedReq: LeaveRequest = {
      idPermohonan,
      nomorPermohonan: nomor,
      idPegawai: linkedEmployee.idPegawai,
      namaPegawai: linkedEmployee.namaLengkap,
      nip: linkedEmployee.nip,
      bidang: linkedEmployee.bidang,
      bagian: linkedEmployee.bagian,
      jabatan: linkedEmployee.jabatan,
      unit: linkedEmployee.unit,
      jenisPermohonan,
      kategoriKeperluan,
      tanggalMulai,
      tanggalSelesai,
      jumlahHari: calculatedJumlahHari,
      alasan: alasan.trim(),
      keteranganTambahan: keteranganTambahan.trim() || '-',
      lampiran: lampiranName || '-',
      tanggalPengajuan: ts,
      statusPermohonan: 'MENUNGGU PERSETUJUAN ATASAN',
      statusAtasan: 'MENUNGGU',
      statusMudir: 'BELUM DIPROSES',
      catatanAtasan: editingRequest?.catatanAtasan || '-',
      catatanMudir: editingRequest?.catatanMudir || '-',
      catatanSdm: editingRequest?.catatanSdm || '-',
      urlPdf: '-',
      tanggalDisetujui: '-',
      tanggalDiarsipkan: '-',
      ttdPemohonUrl: signatureDataUrl,
      waktuTtdPemohon: ts,
    };

    if (editingRequest) {
      updatedStore.PERMOHONAN = updatedStore.PERMOHONAN.map((r) =>
        r.idPermohonan === editingRequest.idPermohonan ? submittedReq : r
      );
    } else {
      updatedStore.PERMOHONAN = [submittedReq, ...updatedStore.PERMOHONAN];
    }

    // Catat tanda tangan pemohon ke sheet PERSETUJUAN
    const approvalEntry: ApprovalRecord = {
      idPersetujuan: `APR-${String(updatedStore.PERSETUJUAN.length + 1).padStart(4, '0')}`,
      idPermohonan,
      namaPenyetuju: linkedEmployee.namaLengkap,
      emailPenyetuju: linkedEmployee.email,
      rolePenyetuju: currentUser.role,
      keputusan: 'PENGAJUAN',
      catatan: 'Pengajuan permohonan ditandatangani oleh pemohon.',
      urlTandaTangan: `DRIVE://TANDA_TANGAN_DIGITAL/TTD_${linkedEmployee.idPegawai}_${nomor}.png`,
      waktuPersetujuan: ts,
    };
    updatedStore.PERSETUJUAN = [approvalEntry, ...updatedStore.PERSETUJUAN];

    // Kirim notifikasi ke Pemohon & Atasan Langsung
    createNotification(
      updatedStore,
      currentUser.userId,
      currentUser.email,
      'Permohonan Berhasil Dikirim',
      `Permohonan ${nomor} (${kategoriKeperluan}) telah dikirim dan berstatus MENUNGGU PERSETUJUAN ATASAN.`,
      idPermohonan
    );

    const supervisorUser = updatedStore.USERS.find(
      (u) =>
        u.idPegawai === linkedEmployee.idAtasanLangsung ||
        u.role === 'ATASAN LANGSUNG'
    );
    if (supervisorUser) {
      createNotification(
        updatedStore,
        supervisorUser.userId,
        supervisorUser.email,
        'Permohonan Izin/Cuti Baru Menunggu Persetujuan',
        `${linkedEmployee.namaLengkap} mengajukan ${jenisPermohonan} (${kategoriKeperluan}) dengan nomor ${nomor}.`,
        idPermohonan
      );
    }

    recordActivity(
      updatedStore,
      currentUser,
      'KIRIM_PERMOHONAN',
      'PERMOHONAN',
      nomor,
      `Mengirim permohonan ${jenisPermohonan} - ${kategoriKeperluan} (${calculatedJumlahHari})`
    );

    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    setShowConfirmModal(false);

    // 1. Kirim notifikasi WhatsApp otomatis melalui API (/api/whatsapp/send — Twilio / Fonnte / Gateway) ke Atasan Langsung
    triggerWhatsAppAutomation(
      updatedStore,
      submittedReq,
      'PERMOHONAN_BARU',
      currentUser,
      supervisorWaPhone || supervisorEmployee?.nomorTelepon
    ).then(() => {
      onStoreUpdate({ ...updatedStore });
    });

    // 2. Langsung arahkan ke WhatsApp Atasan Langsung saat klik "Konfirmasi & Kirim Sekarang"
    const waMessage = generateFollowUpMessageText(
      submittedReq,
      'ATASAN LANGSUNG',
      supervisorEmployee
    );
    const waUrl = formatWhatsAppUrl(
      supervisorWaPhone || supervisorEmployee?.nomorTelepon,
      waMessage
    );
    const a = document.createElement('a');
    a.href = waUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onSuccessNavigate();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">
          {editingRequest ? `Perbaiki / Edit Permohonan (${editingRequest.nomorPermohonan})` : 'Buat Permohonan Izin / Cuti Baru'}
        </h2>
        <p className="text-sm text-slate-600">
          Formulir Resmi <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5">AIS-FRM-SEK.02.11 Rev. 1</code> — Data identitas pegawai terisi otomatis dari <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5">MASTER_PEGAWAI</code>.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleProceedToConfirm} className="space-y-6">
        {/* BAGIAN 1: IDENTITAS PEGAWAI OTOMATIS (READ-ONLY) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            01. Identitas Pemohon (Terisi Otomatis Berdasarkan Akun Login)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">Nama Pegawai</span>
              <strong className="text-slate-900 text-sm">{linkedEmployee.namaLengkap}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">NIP</span>
              <strong className="text-slate-900 text-sm font-mono tabular-nums">
                {linkedEmployee.nip}
              </strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">Bidang</span>
              <strong className="text-slate-900 text-sm">{linkedEmployee.bidang}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">Bagian</span>
              <strong className="text-slate-900 text-sm">{linkedEmployee.bagian}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">Jabatan</span>
              <strong className="text-slate-900 text-sm">{linkedEmployee.jabatan}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 block">Unit Kerja</span>
              <strong className="text-slate-900 text-sm">{linkedEmployee.unit}</strong>
            </div>
          </div>
        </div>

        {/* BAGIAN 2: RINCIAN PERMOHONAN & KETENTUAN RESMI */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            02. Rincian Permohonan & Ketentuan Izin/Cuti
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jenis Permohonan
              </label>
              <select
                value={jenisPermohonan}
                onChange={(e) =>
                  setJenisPermohonan(
                    e.target.value as 'Izin' | 'Cuti' | 'Izin Kondisional/Khusus'
                  )
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="Izin">Izin</option>
                <option value="Cuti">Cuti</option>
                <option value="Izin Kondisional/Khusus">Izin Kondisional/Khusus</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori Keperluan (Sesuai Ketentuan_Izin_Cuti_Pegawai.xlsx)
              </label>
              <select
                value={kategoriKeperluan}
                onChange={(e) => setKategoriKeperluan(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                {activePolicies.map((pol) => (
                  <option key={pol.idKategori} value={pol.namaKeperluan}>
                    {pol.namaKeperluan}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Info Box Ketentuan Resmi dari Spreadsheet */}
          {selectedPolicy && (
            <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-950">
                <Info className="w-4 h-4 text-emerald-800 shrink-0" />
                <span>Ketentuan Resmi: {selectedPolicy.namaKeperluan}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-700">
                <div>
                  Hak Durasi Maksimal:{' '}
                  <strong className="text-emerald-950">{selectedPolicy.durasi}</strong>
                </div>
                <div>
                  Batas Minimal Pengajuan:{' '}
                  <strong className="text-emerald-950">{selectedPolicy.minimalPengajuan}</strong>
                </div>
              </div>
              <p className="text-slate-600">{selectedPolicy.keterangan}</p>
            </div>
          )}

          {/* Peringatan Khusus untuk Durasi Kebijaksanaan / Pemeriksaan Medis / Kondisional */}
          {requiresDiscretionOrMedical && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">
                  Peringatan Pemeriksaan Khusus / Kebijaksanaan Pimpinan
                </div>
                <p>
                  Kategori <strong>{kategoriKeperluan}</strong> atau jenis{' '}
                  <strong>{jenisPermohonan}</strong> memerlukan kebijaksanaan pimpinan atau pemeriksaan dokumen medis secara manual oleh Atasan Langsung, Mudir Unit, dan Divisi SDM. Sistem tidak membatasi angka hari secara kaku; pastikan Anda melampirkan dokumen pendukung/medis.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Mulai
              </label>
              <input
                type="date"
                required
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Selesai
              </label>
              <input
                type="date"
                required
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jumlah Hari (Otomatis)
              </label>
              <input
                type="text"
                readOnly
                value={calculatedJumlahHari}
                className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-100 text-slate-900 font-semibold rounded-md font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alasan Permohonan Izin / Cuti (Wajib Diisi)
            </label>
            <textarea
              rows={3}
              required
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Tuliskan alasan lengkap pengajuan izin atau cuti..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Keterangan Tambahan / Pendelegasian Tugas
              </label>
              <input
                type="text"
                value={keteranganTambahan}
                onChange={(e) => setKeteranganTambahan(e.target.value)}
                placeholder="Contoh: Tugas mengajar didelegasikan kepada Ustadz..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lampiran Dokumen Pendukung / Surat Dokter (Opsional)
              </label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-300 whitespace-nowrap shrink-0">
                  <FileText className="w-4 h-4" />
                  Pilih Berkas
                  <input type="file" onChange={handleAttachmentUpload} className="hidden" />
                </label>
                <span className="text-xs text-slate-600 truncate">
                  {lampiranName || 'Belum ada berkas dipilih'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BAGIAN 3: TANDA TANGAN DIGITAL PEMOHON */}
        <SignaturePad
          label="03. Tanda Tangan Digital Pemohon"
          signerName={linkedEmployee.namaLengkap}
          signerRole={`${linkedEmployee.jabatan} (${linkedEmployee.unit})`}
          value={signatureDataUrl}
          onChange={setSignatureDataUrl}
        />

        {/* TOMBOL AKSI: SIMPAN DRAFT ATAU LANJUT KONFIRMASI */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleSaveAsDraft}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Save className="w-4 h-4" />
            Simpan sebagai Draft
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-md transition-colors"
          >
            <Send className="w-4 h-4" />
            Periksa & Kirim Permohonan
          </button>
        </div>
      </form>

      {/* MODAL KONFIRMASI SEBELUM DIKIRIM -> KLIK KONFIRMASI & KIRIM SEKARANG LANGSUNG KE WA ATASAN LANGSUNG */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#008069] text-white flex items-center gap-2.5 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-[#d9fdd3] shrink-0" />
              <div>
                <h3 className="text-sm sm:text-base font-bold">
                  Konfirmasi Pengajuan & Kirim ke WhatsApp Atasan Langsung
                </h3>
                <p className="text-xs text-white/85">
                  Periksa surat permohonan yang telah Anda tandatangani di bawah ini. Klik &ldquo;Konfirmasi &amp; Kirim Sekarang&rdquo; untuk menyimpan dan langsung mengirim ke WhatsApp Atasan Langsung.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Nomor WhatsApp Atasan Langsung */}
              <div className="bg-[#f0f2f5] border border-[#d1d7db] rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#111b21] mb-1">
                    Atasan Langsung Penerima
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={
                      supervisorEmployee
                        ? `${supervisorEmployee.namaLengkap} (${supervisorEmployee.jabatan})`
                        : `Atasan Langsung (${linkedEmployee.unit})`
                    }
                    className="w-full px-3 py-2 bg-white border border-[#d1d7db] rounded-lg font-semibold text-[#111b21]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#111b21] mb-1">
                    Nomor WhatsApp Atasan Langsung (Opsional)
                  </label>
                  <div className="relative">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={supervisorWaPhone}
                      onChange={(e) => setSupervisorWaPhone(e.target.value)}
                      placeholder="Kosongkan untuk pilih kontak langsung di WA"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-[#d1d7db] rounded-lg font-mono text-[#111b21]"
                    />
                  </div>
                </div>
              </div>

              {/* Pratinjau Surat Resmi AIS-FRM-SEK.02.11 yang Sudah Ditandatangani Pemohon (Times New Roman) */}
              <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 sm:p-4">
                <OfficialLetterPaper
                  compact
                  employee={linkedEmployee}
                  request={{
                    idPermohonan: editingRequest?.idPermohonan || 'PREVIEW',
                    nomorPermohonan:
                      editingRequest?.nomorPermohonan || 'AIS-IZC-2026-XXXX',
                    idPegawai: linkedEmployee.idPegawai,
                    namaPegawai: linkedEmployee.namaLengkap,
                    nip: linkedEmployee.nip,
                    bidang: linkedEmployee.bidang,
                    bagian: linkedEmployee.bagian,
                    jabatan: linkedEmployee.jabatan,
                    unit: linkedEmployee.unit,
                    jenisPermohonan,
                    kategoriKeperluan,
                    tanggalMulai,
                    tanggalSelesai,
                    jumlahHari: calculatedJumlahHari,
                    alasan: alasan.trim(),
                    keteranganTambahan: keteranganTambahan.trim() || '-',
                    lampiran: lampiranName || '-',
                    tanggalPengajuan: getTimestamp(),
                    statusPermohonan: 'MENUNGGU PERSETUJUAN ATASAN',
                    statusAtasan: 'MENUNGGU',
                    statusMudir: 'BELUM DIPROSES',
                    catatanAtasan: '-',
                    catatanMudir: '-',
                    catatanSdm: '-',
                    urlPdf: '-',
                    tanggalDisetujui: '-',
                    tanggalDiarsipkan: '-',
                    ttdPemohonUrl: signatureDataUrl,
                  }}
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#f0f2f5] border-t border-[#d1d7db] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
              >
                Kembali & Perbaiki
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#25D366] hover:bg-[#1da851] rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Konfirmasi & Kirim Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
