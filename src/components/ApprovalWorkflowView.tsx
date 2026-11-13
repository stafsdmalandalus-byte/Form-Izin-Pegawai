import React, { useState, useEffect } from 'react';
import {
  ApprovalRecord,
  DocumentArchive,
  LeaveRequest,
  UserAccount,
} from '../types';
import {
  ARSIP_IZIN_ISO_FOLDER_NAME,
  ARSIP_IZIN_ISO_FOLDER_URL,
  createNotification,
  FullDatabaseStore,
  getTimestamp,
  getVisibleLeaveRequests,
  recordActivity,
  saveDatabase,
  uploadPdfToGasDriveFolder,
  validatePermission,
} from '../services/databaseService';
import { SignaturePad } from './SignaturePad';
import { OfficialLetterPaper } from './OfficialFormModal';
import { formatOfficialPdfFilename, generateOfficialLeavePDF } from '../utils/pdfGenerator';
import {
  fetchWhatsAppServerStatus,
  triggerWhatsAppAutomation,
  WhatsAppServerStatus,
} from '../services/whatsappNotificationService';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  Archive,
  Eye,
  Download,
  MessageSquareShare,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { ShareMessageModal } from './ShareMessageModal';

interface ApprovalWorkflowViewProps {
  store: FullDatabaseStore;
  currentUser: UserAccount;
  onStoreUpdate: (next: FullDatabaseStore) => void;
  onPreviewOfficialPdf: (req: LeaveRequest) => void;
  onEditRevisionRequest?: (req: LeaveRequest) => void;
  initialFocusRequestId?: string | null;
  onClearFocusRequest?: () => void;
}

export const ApprovalWorkflowView: React.FC<ApprovalWorkflowViewProps> = ({
  store,
  currentUser,
  onStoreUpdate,
  onPreviewOfficialPdf,
  onEditRevisionRequest,
  initialFocusRequestId,
  onClearFocusRequest,
}) => {
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [shareMessageRequest, setShareMessageRequest] = useState<LeaveRequest | null>(null);
  const [decisionType, setDecisionType] = useState<'SETUJUI' | 'TOLAK' | 'MINTA REVISI'>('SETUJUI');
  const [catatan, setCatatan] = useState('');
  const [approverSignature, setApproverSignature] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [waServerStatus, setWaServerStatus] = useState<WhatsAppServerStatus | null>(null);

  const refreshWaStatus = () => {
    fetchWhatsAppServerStatus().then((st) => {
      if (st) setWaServerStatus(st);
    });
  };

  useEffect(() => {
    refreshWaStatus();
  }, [store.PERMOHONAN.length]);

  const visibleRequests = getVisibleLeaveRequests(store, currentUser);

  const canActAsSupervisor = (req: LeaveRequest): boolean => {
    if (req.statusPermohonan !== 'MENUNGGU PERSETUJUAN ATASAN') return false;
    return currentUser.statusAkun === 'Aktif';
  };

  const canActAsMudir = (req: LeaveRequest): boolean => {
    if (req.statusPermohonan !== 'MENUNGGU PERSETUJUAN MUDIR') return false;
    return currentUser.statusAkun === 'Aktif';
  };

  const canActAsAdminSdmArchive = (req: LeaveRequest): boolean => {
    if (req.statusPermohonan !== 'DISETUJUI') return false;
    return currentUser.role === 'ADMIN SDM' || currentUser.role === 'SUPER ADMIN';
  };

  const handleOpenDecisionPanel = (
    req: LeaveRequest,
    defaultDecision: 'SETUJUI' | 'TOLAK' | 'MINTA REVISI'
  ) => {
    setSelectedRequest(req);
    setDecisionType(defaultDecision);
    setCatatan('');
    setApproverSignature('');
    setFeedback(null);
  };

  // Otomatis buka panel tanda tangan / fokus surat jika dibuka dari tautan cepat WhatsApp (?req=...)
  useEffect(() => {
    if (!initialFocusRequestId) return;
    const targetReq = store.PERMOHONAN.find(
      (r) =>
        r.idPermohonan === initialFocusRequestId ||
        r.nomorPermohonan === initialFocusRequestId
    );
    if (targetReq) {
      if (
        targetReq.statusPermohonan === 'MENUNGGU PERSETUJUAN ATASAN' ||
        targetReq.statusPermohonan === 'MENUNGGU PERSETUJUAN MUDIR'
      ) {
        handleOpenDecisionPanel(targetReq, 'SETUJUI');
      } else {
        onPreviewOfficialPdf(targetReq);
      }
      if (onClearFocusRequest) onClearFocusRequest();
    }
  }, [initialFocusRequestId, currentUser.userId, store.PERMOHONAN]);

  const handleExecuteSupervisorDecision = () => {
    if (!selectedRequest) return;
    const perm = validatePermission(currentUser, [
      'PEGAWAI',
      'ATASAN LANGSUNG',
      'MUDIR UNIT',
      'ADMIN SDM',
      'SUPER ADMIN',
    ]);
    if (!perm.valid) {
      setFeedback({ type: 'error', text: perm.message || 'Akses ditolak' });
      return;
    }

    if (decisionType === 'SETUJUI' && !approverSignature) {
      setFeedback({
        type: 'error',
        text: 'Atasan Langsung wajib membubuhkan tanda tangan digital untuk menyetujui permohonan.',
      });
      return;
    }

    if ((decisionType === 'TOLAK' || decisionType === 'MINTA REVISI') && !catatan.trim()) {
      setFeedback({
        type: 'error',
        text: `Atasan Langsung wajib mengisi catatan alasan untuk keputusan ${decisionType}.`,
      });
      return;
    }

    const updatedStore = { ...store };
    const ts = getTimestamp();

    const nextStatusPermohonan =
      decisionType === 'SETUJUI'
        ? 'MENUNGGU PERSETUJUAN MUDIR'
        : decisionType === 'TOLAK'
        ? 'DITOLAK ATASAN'
        : 'PERLU REVISI ATASAN';

    const nextStatusAtasan =
      decisionType === 'SETUJUI'
        ? 'DISETUJUI'
        : decisionType === 'TOLAK'
        ? 'DITOLAK'
        : 'REVISI';

    const nextStatusMudir = decisionType === 'SETUJUI' ? 'MENUNGGU' : 'BELUM DIPROSES';

    updatedStore.PERMOHONAN = updatedStore.PERMOHONAN.map((r) =>
      r.idPermohonan === selectedRequest.idPermohonan
        ? {
            ...r,
            statusPermohonan: nextStatusPermohonan,
            statusAtasan: nextStatusAtasan,
            statusMudir: nextStatusMudir,
            catatanAtasan: catatan.trim() || 'Disetujui oleh Atasan Langsung',
            ttdAtasanUrl: decisionType === 'SETUJUI' ? approverSignature : r.ttdAtasanUrl,
            namaAtasan: currentUser.namaPengguna,
            waktuTtdAtasan: ts,
          }
        : r
    );

    const approvalRecord: ApprovalRecord = {
      idPersetujuan: `APR-${String(updatedStore.PERSETUJUAN.length + 1).padStart(4, '0')}`,
      idPermohonan: selectedRequest.idPermohonan,
      namaPenyetuju: currentUser.namaPengguna,
      emailPenyetuju: currentUser.email,
      rolePenyetuju: 'ATASAN LANGSUNG',
      keputusan: decisionType,
      catatan: catatan.trim() || 'Disetujui oleh Atasan Langsung',
      urlTandaTangan:
        decisionType === 'SETUJUI'
          ? `DRIVE://TANDA_TANGAN_DIGITAL/TTD_ATASAN_${selectedRequest.nomorPermohonan}.png`
          : '-',
      waktuPersetujuan: ts,
    };
    updatedStore.PERSETUJUAN = [approvalRecord, ...updatedStore.PERSETUJUAN];

    // Kirim notifikasi ke Pegawai
    const applicantUser = updatedStore.USERS.find(
      (u) => u.idPegawai === selectedRequest.idPegawai
    );
    if (applicantUser) {
      createNotification(
        updatedStore,
        applicantUser.userId,
        applicantUser.email,
        `Keputusan Atasan Langsung: ${decisionType}`,
        `Permohonan ${selectedRequest.nomorPermohonan} telah diproses oleh Atasan Langsung (${currentUser.namaPengguna}) dengan status: ${nextStatusPermohonan}. Catatan: ${catatan || '-'}`,
        selectedRequest.idPermohonan
      );
    }

    // Jika disetujui, kirim notifikasi ke Mudir Unit
    if (decisionType === 'SETUJUI') {
      const mudirUser = updatedStore.USERS.find((u) => u.role === 'MUDIR UNIT');
      if (mudirUser) {
        createNotification(
          updatedStore,
          mudirUser.userId,
          mudirUser.email,
          'Permohonan Menunggu Persetujuan Mudir Unit',
          `Permohonan ${selectedRequest.nomorPermohonan} atas nama ${selectedRequest.namaPegawai} telah disetujui Atasan Langsung dan menunggu persetujuan Mudir Unit.`,
          selectedRequest.idPermohonan
        );
      }
    }

    recordActivity(
      updatedStore,
      currentUser,
      `KEPUTUSAN_ATASAN_${decisionType}`,
      'PERSETUJUAN',
      selectedRequest.nomorPermohonan,
      `Atasan Langsung memberikan keputusan ${decisionType} pada permohonan ${selectedRequest.nomorPermohonan}`
    );

    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    const updatedReqObj = updatedStore.PERMOHONAN.find(
      (r) => r.idPermohonan === selectedRequest.idPermohonan
    );
    setSelectedRequest(null);

    if (updatedReqObj) {
      triggerWhatsAppAutomation(
        updatedStore,
        updatedReqObj,
        'KEPUTUSAN_ATASAN',
        currentUser
      ).then((waRes) => {
        onStoreUpdate({ ...updatedStore });
        refreshWaStatus();
        setFeedback({
          type: 'success',
          text: `Keputusan Atasan Langsung (${decisionType}) untuk nomor ${updatedReqObj.nomorPermohonan} berhasil disimpan. ${waRes.summaryText}`,
        });
      });
    } else {
      setFeedback({
        type: 'success',
        text: `Keputusan Atasan Langsung (${decisionType}) untuk nomor ${selectedRequest.nomorPermohonan} berhasil disimpan.`,
      });
    }
  };

  const handleExecuteMudirDecision = () => {
    if (!selectedRequest) return;
    const perm = validatePermission(currentUser, [
      'PEGAWAI',
      'ATASAN LANGSUNG',
      'MUDIR UNIT',
      'ADMIN SDM',
      'SUPER ADMIN',
    ]);
    if (!perm.valid) {
      setFeedback({ type: 'error', text: perm.message || 'Akses ditolak' });
      return;
    }

    if (decisionType === 'SETUJUI' && !approverSignature) {
      setFeedback({
        type: 'error',
        text: 'Mudir Unit wajib membubuhkan tanda tangan digital untuk menyetujui permohonan.',
      });
      return;
    }

    if ((decisionType === 'TOLAK' || decisionType === 'MINTA REVISI') && !catatan.trim()) {
      setFeedback({
        type: 'error',
        text: `Mudir Unit wajib mengisi catatan alasan untuk keputusan ${decisionType}.`,
      });
      return;
    }

    const updatedStore = { ...store };
    const ts = getTimestamp();

    const nextStatusPermohonan =
      decisionType === 'SETUJUI'
        ? 'DISETUJUI'
        : decisionType === 'TOLAK'
        ? 'DITOLAK MUDIR'
        : 'PERLU REVISI MUDIR';

    const nextStatusMudir =
      decisionType === 'SETUJUI'
        ? 'DISETUJUI'
        : decisionType === 'TOLAK'
        ? 'DITOLAK'
        : 'REVISI';

    const pdfFilename = formatOfficialPdfFilename(selectedRequest);
    const generatedDrivePdfUrl =
      decisionType === 'SETUJUI' ? ARSIP_IZIN_ISO_FOLDER_URL : '-';

    updatedStore.PERMOHONAN = updatedStore.PERMOHONAN.map((r) =>
      r.idPermohonan === selectedRequest.idPermohonan
        ? {
            ...r,
            statusPermohonan: nextStatusPermohonan,
            statusMudir: nextStatusMudir,
            catatanMudir: catatan.trim() || 'Disetujui oleh Mudir Unit',
            ttdMudirUrl: decisionType === 'SETUJUI' ? approverSignature : r.ttdMudirUrl,
            namaMudir: currentUser.namaPengguna,
            waktuTtdMudir: ts,
            urlPdf: generatedDrivePdfUrl,
            tanggalDisetujui: decisionType === 'SETUJUI' ? ts : '-',
          }
        : r
    );

    const approvalRecord: ApprovalRecord = {
      idPersetujuan: `APR-${String(updatedStore.PERSETUJUAN.length + 1).padStart(4, '0')}`,
      idPermohonan: selectedRequest.idPermohonan,
      namaPenyetuju: currentUser.namaPengguna,
      emailPenyetuju: currentUser.email,
      rolePenyetuju: 'MUDIR UNIT',
      keputusan: decisionType,
      catatan: catatan.trim() || 'Disetujui oleh Mudir Unit',
      urlTandaTangan:
        decisionType === 'SETUJUI'
          ? `DRIVE://TANDA_TANGAN_DIGITAL/TTD_MUDIR_${selectedRequest.nomorPermohonan}.png`
          : '-',
      waktuPersetujuan: ts,
    };
    updatedStore.PERSETUJUAN = [approvalRecord, ...updatedStore.PERSETUJUAN];

    // Jika disetujui Mudir: Otomatis buat Arsip Dokumen PDF & kirim notifikasi ke Pegawai dan Admin SDM (Tahap 4)
    if (decisionType === 'SETUJUI') {
      const archiveEntry: DocumentArchive = {
        idDokumen: `DOC-${String(updatedStore.ARSIP_DOKUMEN.length + 1).padStart(4, '0')}`,
        idPermohonan: selectedRequest.idPermohonan,
        nomorPermohonan: selectedRequest.nomorPermohonan,
        namaPegawai: selectedRequest.namaPegawai,
        namaFile: pdfFilename,
        urlGoogleDrive: generatedDrivePdfUrl,
        jenisDokumen: 'FORMULIR_PDF',
        tanggalArsip: ts,
      };
      updatedStore.ARSIP_DOKUMEN = [archiveEntry, ...updatedStore.ARSIP_DOKUMEN];

      const sdmUsers = updatedStore.USERS.filter((u) => u.role === 'ADMIN SDM');
      sdmUsers.forEach((sdm) => {
        createNotification(
          updatedStore,
          sdm.userId,
          sdm.email,
          'Permohonan Disetujui Mudir — Siap Diarsipkan SDM',
          `Permohonan ${selectedRequest.nomorPermohonan} (${selectedRequest.namaPegawai}) telah disetujui Mudir Unit. Dokumen PDF ${pdfFilename} telah dibuat otomatis.`,
          selectedRequest.idPermohonan
        );
      });
    }

    const applicantUser = updatedStore.USERS.find(
      (u) => u.idPegawai === selectedRequest.idPegawai
    );
    if (applicantUser) {
      createNotification(
        updatedStore,
        applicantUser.userId,
        applicantUser.email,
        `Keputusan Mudir Unit: ${decisionType}`,
        decisionType === 'SETUJUI'
          ? `Alhamdulillah, permohonan ${selectedRequest.nomorPermohonan} telah DISETUJUI oleh Mudir Unit. Dokumen PDF resmi (${pdfFilename}) siap diunduh.`
          : `Permohonan ${selectedRequest.nomorPermohonan} diproses oleh Mudir Unit dengan status ${nextStatusPermohonan}. Catatan: ${catatan}`,
        selectedRequest.idPermohonan
      );
    }

    recordActivity(
      updatedStore,
      currentUser,
      `KEPUTUSAN_MUDIR_${decisionType}`,
      'PERSETUJUAN',
      selectedRequest.nomorPermohonan,
      `Mudir Unit memberikan keputusan ${decisionType} pada permohonan ${selectedRequest.nomorPermohonan}`
    );

    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    const updatedReqObj = updatedStore.PERMOHONAN.find(
      (r) => r.idPermohonan === selectedRequest.idPermohonan
    );
    setSelectedRequest(null);

    if (updatedReqObj) {
      // 1. Jika DISETUJUI Mudir: Otomatis generate PDF A4 & upload ke Folder Google Drive "Arsip izin ISO" via GAS
      if (decisionType === 'SETUJUI') {
        try {
          const applicantEmp = updatedStore.MASTER_PEGAWAI.find(
            (e) => e.idPegawai === updatedReqObj.idPegawai
          );
          const pdfBase64 = generateOfficialLeavePDF(updatedReqObj, applicantEmp, 'base64');
          uploadPdfToGasDriveFolder(updatedStore, updatedReqObj, pdfBase64, pdfFilename).then(
            (driveRes) => {
              onStoreUpdate(driveRes.updatedStore);
            }
          );
        } catch {
          // fallback tetap mengarah ke folder Arsip izin ISO
        }
      }

      // 2. Kirim notifikasi WhatsApp otomatis ke Pemohon, Atasan & Pegawai Pengganti
      triggerWhatsAppAutomation(
        updatedStore,
        updatedReqObj,
        'KEPUTUSAN_MUDIR',
        currentUser
      ).then((waRes) => {
        onStoreUpdate({ ...updatedStore });
        refreshWaStatus();
        setFeedback({
          type: 'success',
          text:
            decisionType === 'SETUJUI'
              ? `Permohonan ${updatedReqObj.nomorPermohonan} berhasil DISETUJUI, PDF resmi (${pdfFilename}) dibuat & diarsipkan ke folder "${ARSIP_IZIN_ISO_FOLDER_NAME}". ${waRes.summaryText}`
              : `Keputusan Mudir Unit (${decisionType}) berhasil disimpan. ${waRes.summaryText}`,
        });
      });
    } else {
      setFeedback({
        type: 'success',
        text:
          decisionType === 'SETUJUI'
            ? `Permohonan ${selectedRequest.nomorPermohonan} berhasil DISETUJUI. Dokumen PDF resmi (${pdfFilename}) otomatis dibuat.`
            : `Keputusan Mudir Unit (${decisionType}) berhasil disimpan.`,
      });
    }
  };

  const handleArchiveBySdm = (req: LeaveRequest) => {
    const perm = validatePermission(currentUser, ['ADMIN SDM', 'SUPER ADMIN']);
    if (!perm.valid) return;

    const updatedStore = { ...store };
    const ts = getTimestamp();

    updatedStore.PERMOHONAN = updatedStore.PERMOHONAN.map((r) =>
      r.idPermohonan === req.idPermohonan
        ? {
            ...r,
            statusPermohonan: 'DIARSIPKAN',
            catatanSdm: 'Dokumen PDF diverifikasi dan diarsipkan oleh Divisi SDM & Penjaminan Mutu.',
            tanggalDiarsipkan: ts,
          }
        : r
    );

    recordActivity(
      updatedStore,
      currentUser,
      'ARSIPKAN_PERMOHONAN',
      'ARSIP_DOKUMEN',
      req.nomorPermohonan,
      `Admin SDM mengarsipkan permohonan ${req.nomorPermohonan} (${req.namaPegawai})`
    );

    saveDatabase(updatedStore);
    onStoreUpdate(updatedStore);
    const updatedReqObj = updatedStore.PERMOHONAN.find((r) => r.idPermohonan === req.idPermohonan);
    if (updatedReqObj) {
      triggerWhatsAppAutomation(
        updatedStore,
        updatedReqObj,
        'DIARSIPKAN_SDM',
        currentUser
      ).then((waRes) => {
        onStoreUpdate({ ...updatedStore });
        refreshWaStatus();
        setFeedback({
          type: 'success',
          text: `Permohonan ${req.nomorPermohonan} telah resmi diarsipkan oleh Divisi SDM. ${waRes.summaryText}`,
        });
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-900">
          Daftar Permohonan & Alur Tanda Tangan Berjenjang via HP
        </h2>
        <p className="text-sm text-slate-600">
          Pegawai tidak perlu meminta tanda tangan kertas secara tatap muka. Seluruh tanda tangan dilakukan langsung di layar HP masing-masing pejabat secara berurutan.
        </p>
      </div>

      {/* ALUR VISUAL 4 TAHAP BAGAIMANA PEGAWAI MENDAPATKAN TTD ATASAN & MUDIR VIA HP */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wide mb-3">
          Bagaimana Cara Pegawai Mendapatkan Tanda Tangan Atasan Langsung & Persetujuan Mudir Unit?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="font-mono font-bold text-emerald-900 mb-1">TAHAP 1 · HP PEGAWAI</div>
            <div className="font-semibold text-slate-900 mb-1">
              Pegawai Mengajukan & TTD di Layar HP
            </div>
            <p className="text-slate-600 leading-relaxed">
              Pegawai membuka aplikasi di HP, mengisi alasan izin/cuti, menggoreskan tanda tangan jari di layar HP, lalu klik <strong>Kirim Permohonan</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="font-mono font-bold text-emerald-900 mb-1">
              TAHAP 2 · HP ATASAN LANGSUNG
            </div>
            <div className="font-semibold text-slate-900 mb-1">
              Notifikasi Masuk & TTD Atasan di HP
            </div>
            <p className="text-slate-600 leading-relaxed">
              Sistem otomatis mengirim notifikasi ke akun <strong>Atasan Langsung</strong> (sesuai kolom <code className="font-mono">ID Atasan Langsung</code>). Atasan membuka HP, klik <strong>Proses Atasan</strong>, lalu tanda tangan di layar HP-nya.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="font-mono font-bold text-emerald-900 mb-1">
              TAHAP 3 · HP MUDIR UNIT
            </div>
            <div className="font-semibold text-slate-900 mb-1">
              Persetujuan & TTD Mudir Unit di HP
            </div>
            <p className="text-slate-600 leading-relaxed">
              Begitu disetujui Atasan, permohonan otomatis diteruskan ke akun <strong>Mudir Unit</strong>. Mudir membuka HP, klik <strong>Keputusan Mudir</strong>, dan membubuhkan tanda tangan di layar HP.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
            <div className="font-mono font-bold text-emerald-950 mb-1">
              TAHAP 4 · OTOMATIS JADI PDF RESMI
            </div>
            <div className="font-semibold text-emerald-950 mb-1">
              3 Tanda Tangan Terkumpul di PDF
            </div>
            <p className="text-slate-700 leading-relaxed">
              Saat Mudir menyetujui, sistem otomatis menyatukan ke-3 tanda tangan (Pemohon, Atasan, Mudir) ke formulir resmi <code className="font-mono">AIS-FRM-SEK.02.11</code>. Pegawai & SDM langsung bisa mengunduh PDF-nya.
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-lg border text-sm flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* STATUS GATEWAY NOTIFIKASI WHATSAPP OTOMATIS (API SERVER TWILIO / FONNTE) */}
      {waServerStatus && (
        <div className="bg-white border border-emerald-200 rounded-lg p-4 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-emerald-950">
              <Smartphone className="w-4 h-4 text-[#008069]" />
              <span>
                Integrasi Notifikasi WhatsApp Otomatis (API Endpoint:{' '}
                <code className="font-mono">/api/whatsapp/send</code>)
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-semibold">
              Provider: {waServerStatus.provider}
            </span>
          </div>
          <p className="text-slate-600">
            Setiap kali <strong>permohonan baru dibuat</strong> atau <strong>status berubah</strong> (Disetujui/Ditolak/Revisi oleh Atasan Langsung maupun Mudir Unit), sistem secara otomatis mengirimkan pesan WhatsApp ke nomor penerima melalui API server.
          </p>
          {waServerStatus.recentDispatches.length > 0 && (
            <div className="pt-1 border-t border-slate-100 space-y-1">
              <div className="font-semibold text-slate-700">
                Riwayat Pengiriman Notifikasi WhatsApp Otomatis Terbaru:
              </div>
              <div className="max-h-28 overflow-y-auto divide-y divide-slate-100">
                {waServerStatus.recentDispatches.slice(0, 5).map((d) => (
                  <div key={d.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div>
                      <span className="font-mono font-bold text-emerald-900">{d.nomorPermohonan}</span>
                      {' · '}
                      <span className="font-semibold text-slate-800">
                        Ke: {d.recipientRole} ({d.recipientName} / {d.recipientPhone})
                      </span>
                      {' — '}
                      <span className="text-slate-500">{d.detail}</span>
                    </div>
                    <span className="font-mono text-slate-400">{d.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL TINDAKAN PERSETUJUAN ATASAN / MUDIR (DILENGKAPI SURAT PERMOHONAN RESMI AIS-FRM-SEK.02.11) */}
      {selectedRequest && (
        <div className="bg-white border-2 border-[#008069] rounded-xl p-4 sm:p-6 space-y-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#d9fdd3] text-[#008069] text-[11px] font-bold mb-1">
                {selectedRequest.statusPermohonan === 'MENUNGGU PERSETUJUAN ATASAN'
                  ? 'TAHAP 2 · PERSETUJUAN & TANDA TANGAN ATASAN LANGSUNG'
                  : 'TAHAP 3 · KEPUTUSAN & TANDA TANGAN MUDIR UNIT'}
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Surat Permohonan Izin / Cuti — {selectedRequest.nomorPermohonan}
              </h3>
              <p className="text-xs text-slate-600">
                Pemohon: <strong>{selectedRequest.namaPegawai}</strong> ({selectedRequest.bidang} /{' '}
                {selectedRequest.unit}) · Keperluan:{' '}
                <strong>
                  {selectedRequest.jenisPermohonan} — {selectedRequest.kategoriKeperluan}
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRequest(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              Tutup Panel
            </button>
          </div>

          {/* TAMPILAN SURAT RESMI LENGKAP AGAR ATASAN / MUDIR LANGSUNG MELIHAT ISI SURAT YANG DITANDATANGANI */}
          <div className="bg-slate-100 border border-slate-300 rounded-xl p-2.5 sm:p-4 max-h-[420px] overflow-y-auto">
            <OfficialLetterPaper
              compact
              employee={store.MASTER_PEGAWAI.find(
                (e) => e.idPegawai === selectedRequest.idPegawai
              )}
              request={{
                ...selectedRequest,
                ttdAtasanUrl:
                  selectedRequest.statusPermohonan === 'MENUNGGU PERSETUJUAN ATASAN' &&
                  decisionType === 'SETUJUI' &&
                  approverSignature
                    ? approverSignature
                    : selectedRequest.ttdAtasanUrl,
                namaAtasan:
                  selectedRequest.statusPermohonan === 'MENUNGGU PERSETUJUAN ATASAN'
                    ? currentUser.namaPengguna
                    : selectedRequest.namaAtasan,
                ttdMudirUrl:
                  selectedRequest.statusPermohonan === 'MENUNGGU PERSETUJUAN MUDIR' &&
                  decisionType === 'SETUJUI' &&
                  approverSignature
                    ? approverSignature
                    : selectedRequest.ttdMudirUrl,
                namaMudir:
                  selectedRequest.statusPermohonan === 'MENUNGGU PERSETUJUAN MUDIR'
                    ? currentUser.namaPengguna
                    : selectedRequest.namaMudir,
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              1. Pilih Keputusan ({selectedRequest.statusPermohonan === 'MENUNGGU PERSETUJUAN ATASAN' ? 'Atasan Langsung' : 'Mudir Unit'}):
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {(['SETUJUI', 'MINTA REVISI', 'TOLAK'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDecisionType(opt)}
                  className={`px-4 py-2.5 text-xs font-bold rounded-lg border transition-colors ${
                    decisionType === opt
                      ? opt === 'SETUJUI'
                        ? 'bg-[#008069] text-white border-[#008069]'
                        : opt === 'MINTA REVISI'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-red-700 text-white border-red-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {opt === 'SETUJUI' ? '✓ SETUJUI SURAT INI' : opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              2. Catatan / Disposisi{' '}
              {(decisionType === 'TOLAK' || decisionType === 'MINTA REVISI') && (
                <span className="text-red-600">(Wajib Diisi)</span>
              )}
            </label>
            <textarea
              rows={2}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={
                decisionType === 'SETUJUI'
                  ? 'Catatan persetujuan (opsional)...'
                  : 'Tuliskan alasan penolakan atau poin yang harus direvisi oleh pegawai...'
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>

          {decisionType === 'SETUJUI' && (
            <SignaturePad
              label={`3. Goreskan Tanda Tangan Digital (${
                selectedRequest.statusPermohonan === 'MENUNGGU PERSETUJUAN ATASAN'
                  ? 'Atasan Langsung'
                  : 'Mudir Unit'
              }: ${currentUser.namaPengguna})`}
              signerName={currentUser.namaPengguna}
              signerRole={
                selectedRequest.statusPermohonan === 'MENUNGGU PERSETUJUAN ATASAN'
                  ? 'ATASAN LANGSUNG'
                  : 'MUDIR UNIT'
              }
              value={approverSignature}
              onChange={setApproverSignature}
            />
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedRequest(null)}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            {selectedRequest.statusPermohonan === 'MENUNGGU PERSETUJUAN ATASAN' ? (
              <button
                type="button"
                onClick={handleExecuteSupervisorDecision}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-lg shadow-xs"
              >
                Simpan Keputusan & Tanda Tangan Atasan Langsung
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecuteMudirDecision}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-lg shadow-xs"
              >
                Simpan Keputusan Mudir Unit & Terbitkan PDF Resmi
              </button>
            )}
          </div>
        </div>
      )}

      {/* DAFTAR PERMOHONAN: KARTU RESPONSIF DI HP & TABEL DI LAPTOP */}
      {visibleRequests.length === 0 ? (
        <div className="bg-white border border-[#d1d7db] rounded-xl p-8 text-center shadow-2xs">
          <FileText className="w-8 h-8 text-[#008069] mx-auto mb-2" />
          <p className="text-sm font-bold text-[#111b21]">
            Belum Ada Data Permohonan Izin / Cuti
          </p>
          <p className="text-xs text-[#667781] mt-1">
            Permohonan yang diajukan sesuai hak akses Anda akan tampil di sini.
          </p>
        </div>
      ) : (
        <>
          {/* TAMPILAN KARTU GELEMBUNG WHATSAPP DI HP (MOBILE VIEW < 768px) */}
          <div className="md:hidden space-y-3">
            {visibleRequests.map((req) => {
              const isApproved =
                req.statusPermohonan === 'DISETUJUI' || req.statusPermohonan === 'DIARSIPKAN';
              return (
                <div
                  key={req.idPermohonan}
                  className="bg-white border border-[#d1d7db] rounded-xl p-4 shadow-2xs space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-[#f0f2f5] pb-2.5">
                    <div>
                      <span className="font-mono font-bold text-[#008069]">
                        {req.nomorPermohonan}
                      </span>
                      <h4 className="font-bold text-[#111b21] text-sm mt-0.5">
                        {req.namaPegawai}
                      </h4>
                      <p className="text-[11px] text-[#667781]">
                        {req.bidang} · {req.unit}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        isApproved
                          ? 'bg-[#d9fdd3] text-[#008069]'
                          : 'bg-[#fff5c4] text-[#54656f]'
                      }`}
                    >
                      {req.statusPermohonan}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-[#667781] block">Keperluan:</span>
                      <strong className="text-[#008069]">{req.jenisPermohonan}</strong> —{' '}
                      {req.kategoriKeperluan}
                    </div>
                    <div>
                      <span className="text-[11px] text-[#667781] block">Tanggal & Durasi:</span>
                      <span className="font-mono font-semibold text-[#111b21]">
                        {req.tanggalMulai} s/d {req.tanggalSelesai} ({req.jumlahHari})
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#54656f] bg-[#f0f2f5] p-2.5 rounded-lg space-y-1">
                    <div>
                      Atasan: <strong>{req.statusAtasan}</strong> · Mudir:{' '}
                      <strong>{req.statusMudir}</strong>
                    </div>
                    {req.namaPegawaiPengganti && req.namaPegawaiPengganti !== '-' && (
                      <div className="text-[#008069] font-semibold flex items-center gap-1 pt-1 border-t border-[#d1d7db]">
                        <UserCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Badal/Pengganti: {req.namaPegawaiPengganti}
                          {req.catatanDelegasiTugas && req.catatanDelegasiTugas !== '-'
                            ? ` (${req.catatanDelegasiTugas})`
                            : ''}
                        </span>
                      </div>
                    )}
                    {isApproved && (
                      <div className="pt-1 border-t border-[#d1d7db]">
                        Folder Arsip ISO:{' '}
                        <a
                          href={req.urlPdf && req.urlPdf.startsWith('https://drive.google.com/') ? req.urlPdf : ARSIP_IZIN_ISO_FOLDER_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#008069] font-mono font-bold underline break-all"
                        >
                          {ARSIP_IZIN_ISO_FOLDER_NAME}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi Mobile */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {canActAsSupervisor(req) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenDecisionPanel(req, 'SETUJUI')}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-xl"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Proses Atasan
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDecisionPanel(req, 'TOLAK')}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl"
                        >
                          <XCircle className="w-4 h-4" />
                          Tolak
                        </button>
                      </>
                    )}

                    {canActAsMudir(req) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenDecisionPanel(req, 'SETUJUI')}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-xl"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Keputusan Mudir
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDecisionPanel(req, 'TOLAK')}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl"
                        >
                          <XCircle className="w-4 h-4" />
                          Tolak
                        </button>
                      </>
                    )}

                    {canActAsAdminSdmArchive(req) && (
                      <button
                        type="button"
                        onClick={() => handleArchiveBySdm(req)}
                        className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#008069] rounded-xl"
                      >
                        <Archive className="w-4 h-4" />
                        Arsipkan SDM
                      </button>
                    )}

                    {req.statusPermohonan !== 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => setShareMessageRequest(req)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-[#25D366] hover:bg-[#1da851] rounded-xl"
                      >
                        <MessageSquareShare className="w-3.5 h-3.5" />
                        Kirim WA
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onPreviewOfficialPdf(req)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-[#111b21] bg-[#f0f2f5] rounded-xl"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Formulir
                    </button>

                    {isApproved && (
                      <button
                        type="button"
                        onClick={() =>
                          generateOfficialLeavePDF(
                            req,
                            store.MASTER_PEGAWAI.find((e) => e.idPegawai === req.idPegawai),
                            'download'
                          )
                        }
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-[#008069] bg-[#d9fdd3] border border-[#b7f0ad] rounded-xl"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Unduh PDF
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* TAMPILAN TABEL DI LAPTOP (DESKTOP VIEW >= 768px) */}
          <div className="hidden md:block bg-white border border-[#d1d7db] rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#008069] text-white font-semibold">
                  <th className="py-3 px-3">Nomor Permohonan</th>
                  <th className="py-3 px-3">Nama Pegawai & Unit</th>
                  <th className="py-3 px-3">Jenis & Kategori</th>
                  <th className="py-3 px-3">Tanggal & Durasi</th>
                  <th className="py-3 px-3">Tahapan Persetujuan</th>
                  <th className="py-3 px-3 text-right">Tindakan & Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9edef]">
                {visibleRequests.map((req) => (
                  <tr key={req.idPermohonan} className="hover:bg-[#f0f2f5]/60">
                    <td className="py-3 px-3 font-mono font-bold text-[#008069] tabular-nums">
                      {req.nomorPermohonan}
                      <div className="text-[11px] font-normal text-[#667781]">
                        {req.tanggalPengajuan}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#111b21]">{req.namaPegawai}</div>
                      <div className="text-[11px] text-[#667781]">
                        {req.bidang} · {req.unit}
                      </div>
                      {req.namaPegawaiPengganti && req.namaPegawaiPengganti !== '-' && (
                        <div className="text-[11px] font-semibold text-[#008069] mt-0.5">
                          Badal: {req.namaPegawaiPengganti}
                        </div>
                      )}
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
                        Atasan: {req.statusAtasan} · Mudir: {req.statusMudir}
                      </div>
                      {(req.catatanAtasan !== '-' || req.catatanMudir !== '-') && (
                        <div className="text-[11px] text-amber-800 mt-1">
                          {req.catatanAtasan !== '-' && `Catatan Atasan: ${req.catatanAtasan} `}
                          {req.catatanMudir !== '-' && `| Catatan Mudir: ${req.catatanMudir}`}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      {req.statusPermohonan !== 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => setShareMessageRequest(req)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#25D366] hover:bg-[#1da851] rounded-lg"
                          title="Kirim pesan ringkasan permohonan & arahan tanda tangan ke Atasan Langsung / Mudir Unit"
                        >
                          <MessageSquareShare className="w-3.5 h-3.5" />
                          Kirim WA
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onPreviewOfficialPdf(req)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#111b21] bg-[#f0f2f5] hover:bg-[#e9edef] rounded-lg"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Formulir PDF
                      </button>

                      {(req.statusPermohonan === 'DISETUJUI' ||
                        req.statusPermohonan === 'DIARSIPKAN') && (
                        <button
                          type="button"
                          onClick={() =>
                            generateOfficialLeavePDF(
                              req,
                              store.MASTER_PEGAWAI.find((e) => e.idPegawai === req.idPegawai),
                              'download'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#008069] bg-[#d9fdd3] border border-[#b7f0ad] hover:bg-[#b7f0ad] rounded-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Unduh PDF
                        </button>
                      )}

                      {req.idPegawai === currentUser.idPegawai &&
                        (req.statusPermohonan === 'DRAFT' ||
                          req.statusPermohonan === 'PERLU REVISI ATASAN' ||
                          req.statusPermohonan === 'PERLU REVISI MUDIR') &&
                        onEditRevisionRequest && (
                          <button
                            type="button"
                            onClick={() => onEditRevisionRequest(req)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Perbaiki & Kirim Ulang
                          </button>
                        )}

                      {canActAsSupervisor(req) && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenDecisionPanel(req, 'SETUJUI')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-lg"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Proses Atasan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDecisionPanel(req, 'TOLAK')}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Tolak
                          </button>
                        </>
                      )}

                      {canActAsMudir(req) && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenDecisionPanel(req, 'SETUJUI')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-lg"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Keputusan Mudir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDecisionPanel(req, 'TOLAK')}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Tolak
                          </button>
                        </>
                      )}

                      {canActAsAdminSdmArchive(req) && (
                        <button
                          type="button"
                          onClick={() => handleArchiveBySdm(req)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-[#008069] hover:bg-[#075e54] rounded-lg"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Arsipkan SDM
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {shareMessageRequest && (
        <ShareMessageModal
          request={shareMessageRequest}
          employees={store.MASTER_PEGAWAI}
          onClose={() => setShareMessageRequest(null)}
        />
      )}
    </div>
  );
};
