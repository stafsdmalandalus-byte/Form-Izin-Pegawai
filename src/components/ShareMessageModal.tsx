import React, { useState } from 'react';
import { Employee, LeaveRequest } from '../types';
import {
  formatWhatsAppUrl,
  generateFollowUpMessageText,
} from '../utils/messageShareHelper';
import {
  formatOfficialPdfFilename,
  generateOfficialLeavePDF,
  generateOfficialLeaveWord,
} from '../utils/pdfGenerator';
import { OfficialLetterPaper } from './OfficialFormModal';
import {
  MessageSquareShare,
  Copy,
  Check,
  ExternalLink,
  X,
  Smartphone,
  Download,
  FileText,
  Share2,
} from 'lucide-react';

interface ShareMessageModalProps {
  request: LeaveRequest;
  employees: Employee[];
  initialTarget?: 'ATASAN LANGSUNG' | 'MUDIR UNIT';
  onClose: () => void;
}

export const ShareMessageModal: React.FC<ShareMessageModalProps> = ({
  request,
  employees,
  initialTarget,
  onClose,
}) => {
  const defaultTarget: 'ATASAN LANGSUNG' | 'MUDIR UNIT' =
    initialTarget ||
    (request.statusPermohonan === 'MENUNGGU PERSETUJUAN MUDIR' ||
    request.statusPermohonan === 'DISETUJUI' ||
    request.statusPermohonan === 'DIARSIPKAN'
      ? 'MUDIR UNIT'
      : 'ATASAN LANGSUNG');

  const [targetRole, setTargetRole] = useState<'ATASAN LANGSUNG' | 'MUDIR UNIT'>(defaultTarget);
  const [copied, setCopied] = useState(false);

  const applicantEmp = employees.find((e) => e.idPegawai === request.idPegawai);
  const supervisorEmp = employees.find(
    (e) => e.idPegawai === applicantEmp?.idAtasanLangsung
  );
  const mudirEmp = employees.find(
    (e) => e.idPegawai === applicantEmp?.idMudirUnit
  );

  const activeRecipientEmp = targetRole === 'ATASAN LANGSUNG' ? supervisorEmp : mudirEmp;
  const [customPhone, setCustomPhone] = useState<string>(
    activeRecipientEmp?.nomorTelepon && activeRecipientEmp.nomorTelepon !== '-'
      ? activeRecipientEmp.nomorTelepon
      : ''
  );

  const handleSwitchTarget = (role: 'ATASAN LANGSUNG' | 'MUDIR UNIT') => {
    setTargetRole(role);
    const emp = role === 'ATASAN LANGSUNG' ? supervisorEmp : mudirEmp;
    setCustomPhone(emp?.nomorTelepon && emp.nomorTelepon !== '-' ? emp.nomorTelepon : '');
    setCopied(false);
  };

  const messageText = generateFollowUpMessageText(request, targetRole, activeRecipientEmp);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    const url = formatWhatsAppUrl(customPhone, messageText);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareSignedPdfToWa = async () => {
    try {
      const blobUrl = generateOfficialLeavePDF(request, applicantEmp, 'bloburl');
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      const pdfFile = new File([blob], formatOfficialPdfFilename(request), {
        type: 'application/pdf',
      });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `Surat Izin/Cuti ${request.namaPegawai}`,
          text: messageText,
          files: [pdfFile],
        });
        return;
      }
    } catch {
      // Fallback: download PDF and open WhatsApp
    }
    generateOfficialLeavePDF(request, applicantEmp, 'download');
    handleOpenWhatsApp();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header Modal */}
        <div className="px-5 py-3.5 bg-[#008069] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <MessageSquareShare className="w-5 h-5 text-[#d9fdd3] shrink-0" />
            <div>
              <h3 className="text-sm font-bold">
                Kirim WhatsApp & Surat Bertanda Tangan ({request.nomorPermohonan})
              </h3>
              <p className="text-xs text-white/85">
                Surat resmi AIS-FRM-SEK.02.11 yang sudah ditandatangani tampil otomatis di bawah dan siap dikirim ke Atasan Langsung atau Mudir.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Modal Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* 1. Pilih Tujuan Pesan: Atasan Langsung atau Mudir Unit */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f0f2f5] p-3.5 rounded-xl border border-[#d1d7db]">
            <div>
              <span className="font-bold text-[#111b21] block">Pilih Tujuan Pengiriman WhatsApp:</span>
              <span className="text-[#54656f]">
                Status Saat Ini: <strong className="text-[#008069]">{request.statusPermohonan}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSwitchTarget('ATASAN LANGSUNG')}
                className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
                  targetRole === 'ATASAN LANGSUNG'
                    ? 'bg-[#008069] text-white'
                    : 'bg-white text-[#111b21] border border-[#d1d7db] hover:bg-slate-100'
                }`}
              >
                1. Ke Atasan Langsung
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTarget('MUDIR UNIT')}
                className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
                  targetRole === 'MUDIR UNIT'
                    ? 'bg-[#008069] text-white'
                    : 'bg-white text-[#111b21] border border-[#d1d7db] hover:bg-slate-100'
                }`}
              >
                2. Ke Mudir / Kepala Divisi
              </button>
            </div>
          </div>

          {/* 2. Pratinjau Langsung Surat Resmi AIS-FRM-SEK.02.11 yang Sudah Ditandatangani */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-[#111b21]">
                📄 Pratinjau Surat Resmi yang Sudah Ditandatangani (AIS-FRM-SEK.02.11 - Kertas A4):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => generateOfficialLeavePDF(request, applicantEmp, 'download')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#008069] hover:bg-[#006b57] rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh Surat PDF (A4)
                </button>
                <button
                  type="button"
                  onClick={() => generateOfficialLeaveWord(request, applicantEmp)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Unduh Word (.doc A4)
                </button>
              </div>
            </div>

            <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 sm:p-4">
              <OfficialLetterPaper request={request} employee={applicantEmp} compact />
            </div>
          </div>

          {/* 3. Nomor WhatsApp Tujuan & Isi Pesan Pengantar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Pejabat Penerima ({targetRole})
              </label>
              <input
                type="text"
                readOnly
                value={
                  activeRecipientEmp
                    ? `${activeRecipientEmp.namaLengkap} (${activeRecipientEmp.jabatan})`
                    : `Pejabat ${targetRole} (${request.unit})`
                }
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nomor WhatsApp Tujuan (Opsional, contoh: 0812xxxx)
              </label>
              <div className="relative">
                <Smartphone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="Kosongkan untuk memilih kontak di WA"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Pesan Pengantar WhatsApp:
            </label>
            <textarea
              readOnly
              rows={8}
              value={messageText}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg font-mono text-[11px] leading-relaxed text-slate-800"
            />
          </div>
        </div>

        {/* Footer Tombol Kirim */}
        <div className="px-5 py-3.5 bg-[#f0f2f5] border-t border-[#d1d7db] flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" />
                Pesan Disalin
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Salin Teks
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShareSignedPdfToWa}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#008069] bg-[#d9fdd3] border border-[#b7f0ad] hover:bg-[#b7f0ad] rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Lampirkan PDF Surat + Buka WA
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#25D366] hover:bg-[#1da851] rounded-lg transition-colors shadow-2xs"
          >
            <ExternalLink className="w-4 h-4" />
            Kirim Pesan WA ke {targetRole === 'ATASAN LANGSUNG' ? 'Atasan Langsung' : 'Mudir'}
          </button>
        </div>
      </div>
    </div>
  );
};
