import { jsPDF } from 'jspdf';
import { Employee, LeaveRequest } from '../types';

export const AL_ANDALUS_LOGO_PATH = '/assets/aistudio/Logo_Al-Andalus_c7d889d5.png';

let cachedLogoDataUrl: string | null = null;

export const preloadOfficialLogo = (): Promise<string | null> => {
  if (cachedLogoDataUrl) return Promise.resolve(cachedLogoDataUrl);
  if (typeof window === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 550;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          cachedLogoDataUrl = canvas.toDataURL('image/png');
          resolve(cachedLogoDataUrl);
          return;
        }
      } catch {
        // fallback
      }
      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = AL_ANDALUS_LOGO_PATH;
  });
};

// Preload immediately in browser
if (typeof window !== 'undefined') {
  preloadOfficialLogo();
}

const HARI_INDONESIA = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const formatDayAndDateParts = (
  isoDate: string
): { hari: string; dd: string; mm: string; yyyy: string } => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return { hari: '..........', dd: '....', mm: '....', yyyy: '........' };
  }
  const [yyyy, mm, dd] = isoDate.split('-');
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const hari = HARI_INDONESIA[d.getDay()] || '..........';
  return { hari, dd, mm, yyyy };
};

export const formatHariTanggalLine = (mulai: string, selesai: string): string => {
  const start = formatDayAndDateParts(mulai);
  const end = formatDayAndDateParts(selesai || mulai);
  return `${start.hari} / ${start.dd} - ${start.mm} - ${start.yyyy}   s/d   ${end.hari} / ${end.dd} - ${end.mm} - ${end.yyyy}`;
};

export const formatOfficialPdfFilename = (request: LeaveRequest): string => {
  const cleanName = request.namaPegawai
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  const nomor = request.nomorPermohonan || 'AIS-FRM-SEK.02.11';
  return `${nomor}_${cleanName}.pdf`;
};

export const formatOfficialWordFilename = (request: LeaveRequest): string => {
  const cleanName = request.namaPegawai
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  const nomor = request.nomorPermohonan || 'AIS-FRM-SEK.02.11';
  return `${nomor}_${cleanName}.doc`;
};

/**
 * Menghasilkan Dokumen PDF Resmi Kertas A4 yang 100% sama persis dengan:
 * "AIS-FRM-SEK.02.11. Form Izin atau Cuti Pegawai-Rev 1"
 * Pesantren Islam Internasional Al-Andalus
 */
export const generateOfficialLeavePDF = (
  request: LeaveRequest,
  _employee?: Employee,
  mode: 'download' | 'bloburl' = 'download'
): string => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const marginX = 16;
  const contentWidth = 178; // 210 - 32 = 178mm

  // =========================================================================
  // 1. KOP SURAT RESMI (KOTAK HEADER AIS-FRM-SEK.02.11)
  // =========================================================================
  const headerTop = 15;
  const topBoxH = 26;
  const metaRowH = 7.5;
  const totalHeaderH = topBoxH + metaRowH;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  // Outer rectangle of Kop Surat
  doc.rect(marginX, headerTop, contentWidth, totalHeaderH);

  // Horizontal line separating Top Row (Logo + Title) and Bottom Row (4 metadata cells)
  doc.line(marginX, headerTop + topBoxH, marginX + contentWidth, headerTop + topBoxH);

  // Vertical line separating Logo cell (left 46mm) and Title cell (right 132mm)
  const logoColW = 46;
  doc.line(marginX + logoColW, headerTop, marginX + logoColW, headerTop + topBoxH);

  // Render Logo Al-Andalus inside Left Cell
  if (cachedLogoDataUrl) {
    try {
      // Keep aspect ratio of Al-Andalus teardrop logo (~11.5mm x 21mm)
      doc.addImage(
        cachedLogoDataUrl,
        'PNG',
        marginX + (logoColW - 12) / 2,
        headerTop + 2.5,
        12,
        21
      );
    } catch {
      // fallback text if image fails
    }
  } else {
    // Trigger preload for next time
    preloadOfficialLogo();
  }

  // Right Cell of Top Row:
  // PESANTREN ISLAM INTERNASIONAL AL-ANDALUS
  // DOKUMEN INFORMASI – FORM (FRM)
  // PERMOHONAN IJIN - CUTI
  const titleCenterX = marginX + logoColW + (contentWidth - logoColW) / 2;
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(11.5);
  doc.text('PESANTREN ISLAM INTERNASIONAL AL-ANDALUS', titleCenterX, headerTop + 7.5, {
    align: 'center',
  });

  doc.setFontSize(11);
  doc.text('DOKUMEN INFORMASI – FORM (FRM)', titleCenterX, headerTop + 14.5, {
    align: 'center',
  });

  doc.setFontSize(13.5);
  doc.text('PERMOHONAN IJIN - CUTI', titleCenterX, headerTop + 22, {
    align: 'center',
  });

  // Bottom Row of Kop Surat: 4 cells
  // Cell 1: Kode : AIS-FRM-SEK.02.11 (width 46mm, aligned with logoColW)
  // Cell 2: Terbit/Revisi : A/1 (width 42mm)
  // Cell 3: Tanggal Terbit : 26 Desember 2025 (width 52mm, date in red)
  // Cell 4: Halaman : 1 dari 1 (width 38mm)
  const c1W = 46;
  const c2W = 42;
  const c3W = 52;
  const metaY = headerTop + topBoxH;

  doc.line(marginX + c1W, metaY, marginX + c1W, metaY + metaRowH);
  doc.line(marginX + c1W + c2W, metaY, marginX + c1W + c2W, metaY + metaRowH);
  doc.line(marginX + c1W + c2W + c3W, metaY, marginX + c1W + c2W + c3W, metaY + metaRowH);

  const textY = metaY + 5;
  doc.setFontSize(9);

  // Cell 1
  doc.setFont('times', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Kode : AIS-FRM-SEK.02.11', marginX + c1W / 2, textY, { align: 'center' });

  // Cell 2
  const c2Start = marginX + c1W + 6;
  doc.setFont('times', 'normal');
  doc.text('Terbit/Revisi : ', c2Start, textY);
  doc.setFont('times', 'bold');
  doc.text('A/1', c2Start + 21, textY);

  // Cell 3 (Tanggal Terbit : 26 Desember 2025 in Red)
  const c3Start = marginX + c1W + c2W + 3.5;
  doc.setFont('times', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Tanggal Terbit : ', c3Start, textY);
  doc.setTextColor(220, 38, 38);
  doc.text('26 Desember 2025', c3Start + 22, textY);
  doc.setTextColor(0, 0, 0);

  // Cell 4
  const c4Start = marginX + c1W + c2W + c3W + 5;
  doc.setFont('times', 'normal');
  doc.text('Halaman : ', c4Start, textY);
  doc.setFont('times', 'bold');
  doc.text('1 dari 1', c4Start + 16, textY);

  // =========================================================================
  // 2. KOTAK UTAMA ISI FORMULIR PERMOHONAN IJIN - CUTI
  // =========================================================================
  const bodyTop = headerTop + totalHeaderH + 8;
  const bodyHeight = 118;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(marginX, bodyTop, contentWidth, bodyHeight);

  const labelX = marginX + 3;
  const colonX = marginX + 43;
  const valX = marginX + 46;
  const dotsFull =
    '......................................................................................................................................';

  const bidangBagianValue = [request.bidang, request.bagian].filter(Boolean).join(' / ');
  const alasanFullValue = [
    request.kategoriKeperluan ? `[${request.kategoriKeperluan}]` : '',
    request.alasan,
  ]
    .filter(Boolean)
    .join(' - ');

  // Row 1: Nama
  let rowY = bodyTop + 9;
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text('Nama', labelX, rowY);
  doc.text(':', colonX, rowY);
  doc.setTextColor(120, 120, 120);
  doc.text(dotsFull, valX, rowY + 0.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.text(request.namaPegawai || '', valX + 1, rowY - 0.5);

  // Row 2: Bidang/Bagian
  rowY += 10;
  doc.setFont('times', 'normal');
  doc.text('Bidang/Bagian', labelX, rowY);
  doc.text(':', colonX, rowY);
  doc.setTextColor(120, 120, 120);
  doc.text(dotsFull, valX, rowY + 0.5);
  doc.setTextColor(0, 0, 0);
  doc.text(bidangBagianValue || '', valX + 1, rowY - 0.5);

  // Row 3: Hari/Tanggal Cuti/Ijin
  rowY += 10;
  doc.setFont('times', 'normal');
  doc.text('Hari/Tanggal Cuti/Ijin', labelX, rowY);
  doc.text(':', colonX, rowY);

  const startParts = formatDayAndDateParts(request.tanggalMulai);
  const endParts = formatDayAndDateParts(request.tanggalSelesai || request.tanggalMulai);
  const dateTemplateDots =
    '................ / ........ - ........ - ............  s/d  ................ / ........ - ........ - ............';
  doc.setTextColor(120, 120, 120);
  doc.text(dateTemplateDots, valX, rowY + 0.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.text(
    `${startParts.hari} / ${startParts.dd} - ${startParts.mm} - ${startParts.yyyy}    s/d    ${endParts.hari} / ${endParts.dd} - ${endParts.mm} - ${endParts.yyyy}`,
    valX + 1,
    rowY - 0.5
  );

  // Row 4: Alasan Cuti/Ijin (3 dotted lines)
  rowY += 10;
  doc.setFont('times', 'normal');
  doc.text('Alasan Cuti/Ijin', labelX, rowY);
  doc.text(':', colonX, rowY);

  // 3 dotted lines for Alasan
  doc.setTextColor(120, 120, 120);
  doc.text(dotsFull, valX, rowY + 0.5);
  doc.text(dotsFull, valX, rowY + 9.5);
  doc.text(dotsFull, valX, rowY + 18.5);
  doc.setTextColor(0, 0, 0);

  const wrappedAlasan = doc.splitTextToSize(alasanFullValue || '', contentWidth - 50);
  wrappedAlasan.slice(0, 3).forEach((line: string, idx: number) => {
    doc.text(line, valX + 1, rowY - 0.5 + idx * 9);
  });

  // =========================================================================
  // 3. BLOK TANDA TANGAN 3 KOLOM DI DALAM KOTAK (Pemohon, Mengetahui, Menyetujui)
  // =========================================================================
  const sigTopY = rowY + 30;
  const colW = contentWidth / 3;

  const col1Center = marginX + colW * 0.5;
  const col2Center = marginX + colW * 1.5;
  const col3Center = marginX + colW * 2.5;

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.text('Pemohon,', col1Center, sigTopY, { align: 'center' });
  doc.text('Mengetahui,', col2Center, sigTopY, { align: 'center' });
  doc.text('Menyetujui,', col3Center, sigTopY, { align: 'center' });

  // Render Signatures if available
  const drawSig = (dataUrl: string | undefined, centerX: number) => {
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      try {
        doc.addImage(dataUrl, 'PNG', centerX - 18, sigTopY + 2, 36, 18);
      } catch {
        // ignore invalid image
      }
    }
  };

  drawSig(request.ttdPemohonUrl, col1Center);
  drawSig(request.ttdAtasanUrl, col2Center);
  drawSig(request.ttdMudirUrl, col3Center);

  const sigNameY = sigTopY + 25;
  const renderBracketName = (name: string | undefined, centerX: number) => {
    doc.setFont('times', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('(.........................................)', centerX, sigNameY + 0.5, {
      align: 'center',
    });
    doc.setTextColor(0, 0, 0);
    if (name && name.trim() && name !== '-') {
      doc.setFont('times', 'bold');
      doc.text(name, centerX, sigNameY - 0.5, { align: 'center' });
    }
  };

  renderBracketName(request.namaPegawai, col1Center);
  renderBracketName(
    request.statusAtasan === 'DISETUJUI' || request.ttdAtasanUrl ? request.namaAtasan : '',
    col2Center
  );
  renderBracketName(
    request.statusMudir === 'DISETUJUI' || request.ttdMudirUrl ? request.namaMudir : '',
    col3Center
  );

  // Note at bottom of the box
  const noteY = bodyTop + bodyHeight - 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text('Note : ', labelX, noteY);
  doc.setFont('times', 'bold');
  doc.text('Formulir permohonan cuti harus diisi dengan lengkap', labelX + 11, noteY);

  const fileName = formatOfficialPdfFilename(request);
  if (mode === 'download') {
    doc.save(fileName);
  }
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};

/**
 * Menghasilkan File Microsoft Word (.doc) Kertas A4 dengan Font Times New Roman
 * yang 100% sama persis dengan formulir "AIS-FRM-SEK.02.11. Form Izin atau Cuti Pegawai-Rev 1"
 */
export const generateOfficialLeaveWord = async (
  request: LeaveRequest,
  _employee?: Employee
): Promise<void> => {
  const logoDataUrl = (await preloadOfficialLogo()) || AL_ANDALUS_LOGO_PATH;
  const hariTanggalStr = formatHariTanggalLine(
    request.tanggalMulai,
    request.tanggalSelesai || request.tanggalMulai
  );
  const bidangBagianValue = [request.bidang, request.bagian].filter(Boolean).join(' / ');
  const alasanFullValue = [
    request.kategoriKeperluan ? `[${request.kategoriKeperluan}]` : '',
    request.alasan,
  ]
    .filter(Boolean)
    .join(' - ');

  const pemohonSigHtml = request.ttdPemohonUrl
    ? `<img src="${request.ttdPemohonUrl}" width="120" height="58" style="display:block;margin:4px auto;" />`
    : `<div style="height:62px;"></div>`;

  const atasanSigHtml = request.ttdAtasanUrl
    ? `<img src="${request.ttdAtasanUrl}" width="120" height="58" style="display:block;margin:4px auto;" />`
    : `<div style="height:62px;"></div>`;

  const mudirSigHtml = request.ttdMudirUrl
    ? `<img src="${request.ttdMudirUrl}" width="120" height="58" style="display:block;margin:4px auto;" />`
    : `<div style="height:62px;"></div>`;

  const htmlContent = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>PERMOHONAN IJIN - CUTI (${request.nomorPermohonan})</title>
  <style>
    @page Section1 {
      size: 210mm 297mm;
      margin: 18mm 16mm 18mm 16mm;
    }
    div.Section1 { page: Section1; }
    body, table, td, div, span {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      color: #000000;
    }
    table.kop {
      width: 100%;
      border-collapse: collapse;
      border: 1.5pt solid #000000;
    }
    table.kop td {
      border: 1pt solid #000000;
      padding: 4pt 6pt;
      vertical-align: middle;
    }
    table.body-box {
      width: 100%;
      border-collapse: collapse;
      border: 1.5pt solid #000000;
      margin-top: 14pt;
    }
    table.body-box td {
      padding: 6pt 8pt;
      vertical-align: top;
      border: none;
    }
    .dotted-line {
      border-bottom: 1pt dotted #333333;
      display: inline-block;
      width: 100%;
      min-height: 16pt;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="Section1">
    <!-- KOP SURAT AIS-FRM-SEK.02.11 -->
    <table class="kop">
      <tr>
        <td style="width:26%; text-align:center;" colspan="1">
          <img src="${logoDataUrl}" width="52" height="92" alt="Logo Al-Andalus" />
        </td>
        <td style="width:74%; text-align:center;" colspan="3">
          <div style="font-size:12pt; font-weight:bold; margin-bottom:4pt;">
            PESANTREN ISLAM INTERNASIONAL AL-ANDALUS
          </div>
          <div style="font-size:11pt; font-weight:bold; margin-bottom:4pt;">
            DOKUMEN INFORMASI &ndash; FORM (FRM)
          </div>
          <div style="font-size:14pt; font-weight:bold;">
            PERMOHONAN IJIN - CUTI
          </div>
        </td>
      </tr>
      <tr style="font-size:10pt;">
        <td style="width:26%; text-align:center;">
          Kode : AIS-FRM-SEK.02.11
        </td>
        <td style="width:23%; text-align:center;">
          Terbit/Revisi : <b>A/1</b>
        </td>
        <td style="width:29%; text-align:center;">
          Tanggal Terbit : <span style="color:#dc2626;">26 Desember 2025</span>
        </td>
        <td style="width:22%; text-align:center;">
          Halaman : <b>1 dari 1</b>
        </td>
      </tr>
    </table>

    <!-- KOTAK ISI FORMULIR -->
    <table class="body-box">
      <tr>
        <td style="width:25%;">Nama</td>
        <td style="width:2%;">:</td>
        <td style="width:73%;"><div class="dotted-line">${request.namaPegawai || ''}</div></td>
      </tr>
      <tr>
        <td>Bidang/Bagian</td>
        <td>:</td>
        <td><div class="dotted-line">${bidangBagianValue || ''}</div></td>
      </tr>
      <tr>
        <td>Hari/Tanggal Cuti/Ijin</td>
        <td>:</td>
        <td><div class="dotted-line">${hariTanggalStr}</div></td>
      </tr>
      <tr>
        <td>Alasan Cuti/Ijin</td>
        <td>:</td>
        <td>
          <div class="dotted-line" style="font-weight:normal;">${alasanFullValue || ''}</div>
          <div class="dotted-line" style="font-weight:normal;">&nbsp;</div>
          <div class="dotted-line" style="font-weight:normal;">&nbsp;</div>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="padding-top:16pt;">
          <table style="width:100%; border-collapse:collapse; text-align:center;">
            <tr>
              <td style="width:33.3%; text-align:center;">
                Pemohon,
                ${pemohonSigHtml}
                <div>( <b>${request.namaPegawai || '.....................................'}</b> )</div>
              </td>
              <td style="width:33.3%; text-align:center;">
                Mengetahui,
                ${atasanSigHtml}
                <div>( <b>${request.namaAtasan || '.....................................'}</b> )</div>
              </td>
              <td style="width:33.3%; text-align:center;">
                Menyetujui,
                ${mudirSigHtml}
                <div>( <b>${request.namaMudir || '.....................................'}</b> )</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="padding-top:10pt; font-size:10.5pt;">
          Note : <b>Formulir permohonan cuti harus diisi dengan lengkap</b>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = formatOfficialWordFilename(request);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
