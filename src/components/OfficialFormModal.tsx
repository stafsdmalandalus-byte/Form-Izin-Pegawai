import React from 'react';
import { Employee, LeaveRequest } from '../types';
import { Download, Printer, X, FileCheck2, FileText } from 'lucide-react';
import {
  AL_ANDALUS_LOGO_PATH,
  formatDayAndDateParts,
  formatOfficialPdfFilename,
  generateOfficialLeavePDF,
  generateOfficialLeaveWord,
} from '../utils/pdfGenerator';

interface OfficialFormModalProps {
  request: LeaveRequest;
  employee?: Employee;
  onClose: () => void;
}

/**
 * Komponen Kertas Surat Resmi AIS-FRM-SEK.02.11 (100% identik dengan dokumen asli)
 * Dapat digunakan di Modal Pratinjau Cetak maupun di dalam Modal Kirim WhatsApp.
 */
export const OfficialLetterPaper: React.FC<{
  request: LeaveRequest;
  employee?: Employee;
  compact?: boolean;
}> = ({ request, compact = false }) => {
  const bidangBagianText = [request.bidang, request.bagian].filter(Boolean).join(' / ');
  const startParts = formatDayAndDateParts(request.tanggalMulai);
  const endParts = formatDayAndDateParts(request.tanggalSelesai || request.tanggalMulai);
  const alasanFullText = [
    request.kategoriKeperluan ? `[${request.kategoriKeperluan}]` : '',
    request.alasan,
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <div
      className={`bg-white text-black font-['Times_New_Roman',_Times,_serif] border border-slate-300 shadow-xs mx-auto w-full ${
        compact ? 'p-4 sm:p-5 text-xs' : 'max-w-[210mm] p-6 sm:p-10 text-sm'
      }`}
    >
      {/* 1. KOP SURAT RESMI AIS-FRM-SEK.02.11 */}
      <table className="w-full border-collapse border-[1.5px] border-black text-black">
        <tbody>
          <tr>
            <td
              colSpan={1}
              className="border border-black w-[26%] py-3 px-2 text-center align-middle"
            >
              <img
                src={AL_ANDALUS_LOGO_PATH}
                alt="Logo Pesantren Islam Internasional Al-Andalus"
                className={`${
                  compact ? 'h-16' : 'h-24'
                } w-auto mx-auto object-contain select-none`}
              />
            </td>
            <td
              colSpan={3}
              className="border border-black w-[74%] py-3 px-4 text-center align-middle"
            >
              <div
                className={`${
                  compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                } font-bold tracking-wide uppercase leading-snug`}
              >
                PESANTREN ISLAM INTERNASIONAL AL-ANDALUS
              </div>
              <div
                className={`${
                  compact ? 'text-xs' : 'text-sm sm:text-[15px]'
                } font-bold uppercase mt-1 leading-snug`}
              >
                DOKUMEN INFORMASI – FORM (FRM)
              </div>
              <div
                className={`${
                  compact ? 'text-sm sm:text-base' : 'text-base sm:text-xl'
                } font-extrabold uppercase mt-1 leading-tight`}
              >
                PERMOHONAN IJIN - CUTI
              </div>
            </td>
          </tr>
          <tr className={`${compact ? 'text-[10px]' : 'text-xs'} text-center`}>
            <td className="border border-black py-1.5 px-2 w-[26%]">
              Kode : AIS-FRM-SEK.02.11
            </td>
            <td className="border border-black py-1.5 px-2 w-[23%]">
              Terbit/Revisi : <strong>A/1</strong>
            </td>
            <td className="border border-black py-1.5 px-2 w-[29%]">
              Tanggal Terbit : <span className="text-red-600 font-medium">26 Desember 2025</span>
            </td>
            <td className="border border-black py-1.5 px-2 w-[22%]">
              Halaman : <strong>1 dari 1</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. KOTAK UTAMA ISI FORMULIR PERMOHONAN IJIN - CUTI */}
      <div className="border-[1.5px] border-black mt-5 p-4 sm:p-6 space-y-3.5">
        {/* Baris Nama */}
        <div className="flex items-baseline gap-2">
          <span className={`${compact ? 'w-32' : 'w-44'} shrink-0`}>Nama</span>
          <span>:</span>
          <div className="flex-1 border-b border-dotted border-black pb-0.5 font-semibold px-1">
            {request.namaPegawai}
          </div>
        </div>

        {/* Baris Bidang/Bagian */}
        <div className="flex items-baseline gap-2">
          <span className={`${compact ? 'w-32' : 'w-44'} shrink-0`}>Bidang/Bagian</span>
          <span>:</span>
          <div className="flex-1 border-b border-dotted border-black pb-0.5 px-1">
            {bidangBagianText}
          </div>
        </div>

        {/* Baris Hari/Tanggal Cuti/Ijin */}
        <div className="flex items-baseline gap-2">
          <span className={`${compact ? 'w-32' : 'w-44'} shrink-0`}>Hari/Tanggal Cuti/Ijin</span>
          <span>:</span>
          <div className="flex-1 flex flex-wrap items-baseline gap-1.5">
            <span className="border-b border-dotted border-black px-2 font-semibold">
              {startParts.hari}
            </span>
            <span>/</span>
            <span className="border-b border-dotted border-black px-1.5 font-mono font-semibold">
              {startParts.dd}
            </span>
            <span>-</span>
            <span className="border-b border-dotted border-black px-1.5 font-mono font-semibold">
              {startParts.mm}
            </span>
            <span>-</span>
            <span className="border-b border-dotted border-black px-2 font-mono font-semibold">
              {startParts.yyyy}
            </span>
            <span className="px-1.5">s/d</span>
            <span className="border-b border-dotted border-black px-2 font-semibold">
              {endParts.hari}
            </span>
            <span>/</span>
            <span className="border-b border-dotted border-black px-1.5 font-mono font-semibold">
              {endParts.dd}
            </span>
            <span>-</span>
            <span className="border-b border-dotted border-black px-1.5 font-mono font-semibold">
              {endParts.mm}
            </span>
            <span>-</span>
            <span className="border-b border-dotted border-black px-2 font-mono font-semibold">
              {endParts.yyyy}
            </span>
          </div>
        </div>

        {/* Baris Alasan Cuti/Ijin (3 baris titik-titik sesuai dokumen asli) */}
        <div className="flex items-start gap-2">
          <span className={`${compact ? 'w-32' : 'w-44'} shrink-0 pt-0.5`}>Alasan Cuti/Ijin</span>
          <span className="pt-0.5">:</span>
          <div className="flex-1 space-y-3">
            <div className="border-b border-dotted border-black pb-0.5 px-1 min-h-[22px]">
              {alasanFullText}
            </div>
            <div className="border-b border-dotted border-black pb-0.5 px-1 min-h-[18px]">
              {request.keteranganTambahan && request.keteranganTambahan !== '-'
                ? `Keterangan: ${request.keteranganTambahan}`
                : '\u00A0'}
            </div>
            <div className="border-b border-dotted border-black pb-0.5 px-1 min-h-[18px]">
              &nbsp;
            </div>
          </div>
        </div>

        {/* 3 Kolom Tanda Tangan: Pemohon, Mengetahui, Menyetujui */}
        <div className="grid grid-cols-3 gap-2 pt-6 pb-2 text-center">
          {/* Kolom 1: Pemohon */}
          <div className="flex flex-col items-center justify-between">
            <div>Pemohon,</div>
            <div className="h-20 flex items-center justify-center my-1">
              {request.ttdPemohonUrl ? (
                <img
                  src={request.ttdPemohonUrl}
                  alt="Tanda Tangan Pemohon"
                  className="max-h-16 w-auto object-contain"
                />
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  (Belum Ditandatangani)
                </span>
              )}
            </div>
            <div>
              ( <span className="border-b border-dotted border-black px-2 font-semibold">{request.namaPegawai || '...........................'}</span> )
            </div>
          </div>

          {/* Kolom 2: Mengetahui (Atasan Langsung) */}
          <div className="flex flex-col items-center justify-between">
            <div>Mengetahui,</div>
            <div className="h-20 flex items-center justify-center my-1">
              {request.ttdAtasanUrl ? (
                <img
                  src={request.ttdAtasanUrl}
                  alt="Tanda Tangan Atasan Langsung"
                  className="max-h-16 w-auto object-contain"
                />
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  ({request.statusAtasan})
                </span>
              )}
            </div>
            <div>
              ({' '}
              <span className="border-b border-dotted border-black px-2 font-semibold">
                {request.statusAtasan === 'DISETUJUI' || request.ttdAtasanUrl
                  ? request.namaAtasan || '...........................'
                  : '...........................'}
              </span>{' '}
              )
            </div>
          </div>

          {/* Kolom 3: Menyetujui (Mudir / Kepala Divisi) */}
          <div className="flex flex-col items-center justify-between">
            <div>Menyetujui,</div>
            <div className="h-20 flex items-center justify-center my-1">
              {request.ttdMudirUrl ? (
                <img
                  src={request.ttdMudirUrl}
                  alt="Tanda Tangan Mudir Unit"
                  className="max-h-16 w-auto object-contain"
                />
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  ({request.statusMudir})
                </span>
              )}
            </div>
            <div>
              ({' '}
              <span className="border-b border-dotted border-black px-2 font-semibold">
                {request.statusMudir === 'DISETUJUI' || request.ttdMudirUrl
                  ? request.namaMudir || '...........................'
                  : '...........................'}
              </span>{' '}
              )
            </div>
          </div>
        </div>

        {/* Catatan Bawah di Dalam Kotak */}
        <div className="pt-2 text-xs sm:text-sm">
          Note : <strong>Formulir permohonan cuti harus diisi dengan lengkap</strong>
        </div>
      </div>
    </div>
  );
};

export const OfficialFormModal: React.FC<OfficialFormModalProps> = ({
  request,
  employee,
  onClose,
}) => {
  const fileName = formatOfficialPdfFilename(request);

  const handleDownloadPdf = () => {
    generateOfficialLeavePDF(request, employee, 'download');
  };

  const handleDownloadWord = () => {
    generateOfficialLeaveWord(request, employee);
  };

  const handlePrint = () => {
    const blobUrl = generateOfficialLeavePDF(request, employee, 'bloburl');
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#008069] text-white border-b border-[#006b57]">
          <div className="flex items-center gap-3 min-w-0">
            <FileCheck2 className="w-5 h-5 text-[#d9fdd3] shrink-0" />
            <div className="truncate">
              <h3 className="text-sm font-bold truncate">
                Surat Resmi AIS-FRM-SEK.02.11 — {fileName}
              </h3>
              <p className="text-xs text-white/85">
                100% Sesuai Format Resmi Pesantren Islam Internasional Al-Andalus · Kertas A4
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#25D366] hover:bg-[#1da851] text-white rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            >
              <Download className="w-4 h-4" />
              Unduh PDF (A4)
            </button>
            <button
              type="button"
              onClick={handleDownloadWord}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            >
              <FileText className="w-4 h-4" />
              Unduh Word (.doc A4)
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              Cetak A4
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white rounded-md transition-colors"
              aria-label="Tutup pratinjau"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Paper Viewport */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-8 flex justify-center">
          <OfficialLetterPaper request={request} employee={employee} />
        </div>
      </div>
    </div>
  );
};
