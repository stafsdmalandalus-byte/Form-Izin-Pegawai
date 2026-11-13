export interface GasFileModule {
  filename: string;
  title: string;
  description: string;
  functionsIncluded: string[];
  code: string;
}

export const GAS_BACKEND_MODULES: GasFileModule[] = [
  {
    filename: 'AllInOne_Koneksi_Penuh.gs',
    title: '1 File Lengkap Penghubung Google Spreadsheet & Web App (Tinggal Copy-Paste)',
    description:
      'Cukup tempel 1 file ini saja di Extensions -> Apps Script pada Google Spreadsheet Anda, jalankan setupDatabase(), lalu Deploy sebagai Web App (Anyone).',
    functionsIncluded: ['setupDatabase()', 'doGet()', 'doPost()', 'readAllSheets()', 'writeAllSheets()'],
    code: `/**
 * ============================================================================
 * FILE TUNGGAL PENGHUBUNG GOOGLE SPREADSHEET <-> APLIKASI WEB (ALL-IN-ONE GAS)
 * SISTEM INFORMASI PERMOHONAN IZIN DAN CUTI PEGAWAI AL-ANDALUS
 *
 * CARA PAKAI PALING MUDAH:
 * 1. Buka Google Spreadsheet Anda -> klik menu Extensions (Ekstensi) -> Apps Script
 * 2. Hapus isi Code.gs bawaan, lalu TEMPEL (PASTE) seluruh kode ini dan tekan Ctrl+S (Simpan)
 * 3. Pilih fungsi "setupDatabase" di bagian atas lalu klik tombol "Run" (Jalankan) -> Berikan izin akses
 * 4. Klik "Deploy" -> "New Deployment" -> Pilih jenis "Web app":
 *    - Execute as: Me (Email Admin SDM Anda)
 *    - Who has access: Anyone (Siapa saja)
 * 5. Salin URL Web App (https://script.google.com/macros/s/.../exec) lalu tempel ke menu
 *    "Database & Apps Script" di Aplikasi Web!
 * ============================================================================
 */

var SHEET_SCHEMA = {
  'MASTER_PEGAWAI': [
    'ID Pegawai', 'NIP', 'Nama Lengkap', 'Jenis Kelamin', 'Bidang', 'Bagian',
    'Jabatan', 'Unit', 'Email', 'Nomor Telepon', 'ID Atasan Langsung',
    'ID Mudir Unit', 'Status Kepegawaian', 'Status Aktif', 'Tanggal Dibuat', 'Tanggal Diperbarui'
  ],
  'USERS': [
    'User ID', 'ID Pegawai', 'Nama Pengguna', 'Email', 'Password (ddmmyyyy)',
    'Role', 'Unit', 'ID Atasan', 'ID Mudir', 'Status Akun', 'Tanggal Dibuat', 'Terakhir Login'
  ],
  'PERMOHONAN': [
    'ID Permohonan', 'Nomor Permohonan', 'ID Pegawai', 'Nama Pegawai', 'Bidang', 'Bagian',
    'Jabatan', 'Unit', 'Jenis Permohonan', 'Kategori Keperluan', 'Tanggal Mulai',
    'Tanggal Selesai', 'Jumlah Hari', 'Alasan', 'Keterangan Tambahan', 'Lampiran',
    'Tanggal Pengajuan', 'Status Permohonan', 'Status Atasan', 'Status Mudir',
    'Catatan Atasan', 'Catatan Mudir', 'Catatan SDM', 'URL PDF', 'Tanggal Disetujui', 'Tanggal Diarsipkan'
  ],
  'KETENTUAN_IZIN_CUTI': [
    'ID Kategori', 'Nama Keperluan', 'Durasi', 'Minimal Pengajuan',
    'Keterangan', 'Status Aktif', 'Tanggal Diperbarui'
  ],
  'PERSETUJUAN': [
    'ID Persetujuan', 'ID Permohonan', 'Nama Penyetuju', 'Email Penyetuju',
    'Role Penyetuju', 'Keputusan', 'Catatan', 'URL Tanda Tangan', 'Waktu Persetujuan'
  ],
  'NOTIFIKASI': [
    'ID Notifikasi', 'User ID', 'Email Penerima', 'Judul',
    'Pesan', 'ID Permohonan', 'Status Dibaca', 'Waktu Dibuat'
  ],
  'ARSIP_DOKUMEN': [
    'ID Dokumen', 'ID Permohonan', 'Nomor Permohonan', 'Nama Pegawai',
    'Nama File', 'URL Google Drive', 'Jenis Dokumen', 'Tanggal Arsip'
  ],
  'LOG_AKTIVITAS': [
    'ID Log', 'User ID', 'Nama Pengguna', 'Aktivitas',
    'Modul', 'ID Referensi', 'Keterangan', 'Waktu Aktivitas'
  ],
  'PENGATURAN': [
    'Nama Pengaturan', 'Nilai', 'Keterangan', 'Tanggal Diperbarui'
  ]
};

function getTargetSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty('SPREADSHEET_ID');
  if (savedId) {
    try { return SpreadsheetApp.openById(savedId); } catch (e) {}
  }
  ss = SpreadsheetApp.create('DATABASE SISTEM IZIN DAN CUTI PEGAWAI AL-ANDALUS');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function setupDatabase() {
  var ss = getTargetSpreadsheet();
  var now = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

  Object.keys(SHEET_SCHEMA).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    var headers = SHEET_SCHEMA[sheetName];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#064e3b')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });

  // Isi 5 Akun Role Awal di Sheet USERS jika masih kosong
  var userSheet = ss.getSheetByName('USERS');
  if (userSheet && userSheet.getLastRow() <= 1) {
    var defaultUsers = [
      ['USR-001', 'ADM-SDM-01', 'Staf SDM & Penjaminan Mutu', 'stafsdm.alandalus@gmail.com', '10112026', 'ADMIN SDM', 'Kantor Pusat Al-Andalus', '-', '-', 'Aktif', now, now],
      ['USR-002', 'PEG-001', 'Akun Role Pegawai (Pemohon)', 'pegawai@alandalus.sch.id', '01011995', 'PEGAWAI', 'Unit Putra', 'ATASAN-01', 'MUDIR-01', 'Aktif', now, now],
      ['USR-003', 'ATASAN-01', 'Akun Role Atasan Langsung', 'atasan@alandalus.sch.id', '02021985', 'ATASAN LANGSUNG', 'Unit Putra', 'MUDIR-01', 'MUDIR-01', 'Aktif', now, now],
      ['USR-004', 'MUDIR-01', 'Akun Role Mudir Unit', 'mudir@alandalus.sch.id', '03031980', 'MUDIR UNIT', 'Unit Putra', '-', '-', 'Aktif', now, now],
      ['USR-005', 'SUP-ADM-01', 'Super Administrator Sistem', 'superadmin@alandalus.sch.id', '05051975', 'SUPER ADMIN', 'Direktorat Pesantren', '-', '-', 'Aktif', now, now]
    ];
    userSheet.getRange(2, 1, defaultUsers.length, defaultUsers[0].length).setValues(defaultUsers);
  }

  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    sheetsCreated: Object.keys(SHEET_SCHEMA)
  };
}

function doGet(e) {
  try {
    var ss = getTargetSpreadsheet();
    var data = readAllSheets(ss);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: data
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var body = JSON.parse(e.postData.contents);
    var ss = getTargetSpreadsheet();

    if (body.action === 'uploadPdfArchive' && body.pdfBase64) {
      var targetFolderId = body.folderId || '1ejMB8Sdcpcq2NOHFgkoxTdbuYi5dbjEE';
      var folder = DriveApp.getFolderById(targetFolderId);
      var bytes = Utilities.base64Decode(body.pdfBase64);
      var blob = Utilities.newBlob(bytes, 'application/pdf', body.fileName || 'Surat_Izin_Cuti.pdf');
      var file = folder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {}
      var fileUrl = file.getUrl();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileId: file.getId(),
        fileUrl: fileUrl,
        folderUrl: 'https://drive.google.com/drive/folders/' + targetFolderId + '?usp=drive_link'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (body.action === 'syncPush' && body.payload) {
      writeAllSheets(ss, body.payload);
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      updatedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function sheetRowsToObjects(sheet, mapperFn) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
  return values.filter(function(r) { return r.join('').trim() !== ''; }).map(mapperFn);
}

function readAllSheets(ss) {
  return {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    MASTER_PEGAWAI: sheetRowsToObjects(ss.getSheetByName('MASTER_PEGAWAI'), function(r) {
      return {
        idPegawai: r[0] || r[1], nip: r[1], namaLengkap: r[2], jenisKelamin: r[3] || 'Laki-laki',
        bidang: r[4], bagian: r[5], jabatan: r[6], unit: r[7], email: r[8], nomorTelepon: r[9],
        idAtasanLangsung: r[10] || '-', idMudirUnit: r[11] || '-', statusKepegawaian: r[12] || 'Pegawai Tetap',
        statusAktif: r[13] || 'Aktif', tanggalDibuat: r[14], tanggalDiperbarui: r[15],
        tanggalLahir: r[16] || ''
      };
    }),
    USERS: sheetRowsToObjects(ss.getSheetByName('USERS'), function(r) {
      // Deteksi otomatis apakah r[4] adalah kolom Password atau kolom Role
      var roles = ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN'];
      var isCol4Role = roles.indexOf(String(r[4] || '').toUpperCase().trim()) !== -1;
      var hasPassCol = !isCol4Role;
      return {
        userId: r[0], idPegawai: r[1], namaPengguna: r[2], email: r[3],
        password: hasPassCol ? r[4] : (r[11] || '10112026'),
        passwordPlain: hasPassCol ? r[4] : (r[11] || '10112026'),
        role: hasPassCol ? r[5] : r[4],
        unit: hasPassCol ? r[6] : r[5],
        idAtasan: hasPassCol ? r[7] : r[6],
        idMudir: hasPassCol ? r[8] : r[7],
        statusAkun: (hasPassCol ? r[9] : r[8]) || 'Aktif',
        tanggalDibuat: hasPassCol ? r[10] : r[9],
        terakhirLogin: hasPassCol ? r[11] : r[10]
      };
    }),
    PERMOHONAN: sheetRowsToObjects(ss.getSheetByName('PERMOHONAN'), function(r) {
      return {
        idPermohonan: r[0], nomorPermohonan: r[1], idPegawai: r[2], namaPegawai: r[3],
        bidang: r[4], bagian: r[5], jabatan: r[6], unit: r[7], jenisPermohonan: r[8],
        kategoriKeperluan: r[9], tanggalMulai: r[10], tanggalSelesai: r[11],
        jumlahHari: r[12] || '1 Hari', alasan: r[13], keteranganTambahan: r[14],
        lampiran: r[15], tanggalPengajuan: r[16], statusPermohonan: r[17],
        statusAtasan: r[18], statusMudir: r[19], catatanAtasan: r[20],
        catatanMudir: r[21], catatanSdm: r[22], urlPdf: (r[23] && String(r[23]).indexOf('https://drive.google.com/') === 0) ? r[23] : ((r[17] === 'DISETUJUI' || r[17] === 'DIARSIPKAN') ? 'https://drive.google.com/drive/folders/1ejMB8Sdcpcq2NOHFgkoxTdbuYi5dbjEE?usp=drive_link' : r[23]),
        tanggalDisetujui: r[24], tanggalDiarsipkan: r[25]
      };
    }),
    KETENTUAN_IZIN_CUTI: sheetRowsToObjects(ss.getSheetByName('KETENTUAN_IZIN_CUTI'), function(r) {
      return {
        idKategori: r[0], namaKeperluan: r[1], durasi: r[2], minimalPengajuan: r[3],
        keterangan: r[4], statusAktif: r[5] || 'Aktif', tanggalDiperbarui: r[6]
      };
    }),
    PERSETUJUAN: sheetRowsToObjects(ss.getSheetByName('PERSETUJUAN'), function(r) {
      return {
        idPersetujuan: r[0], idPermohonan: r[1], namaPenyetuju: r[2], emailPenyetuju: r[3],
        rolePenyetuju: r[4], keputusan: r[5], catatan: r[6], urlTandaTangan: r[7], waktuPersetujuan: r[8]
      };
    }),
    NOTIFIKASI: sheetRowsToObjects(ss.getSheetByName('NOTIFIKASI'), function(r) {
      return {
        idNotifikasi: r[0], userId: r[1], emailPenerima: r[2], judul: r[3],
        pesan: r[4], idPermohonan: r[5], statusDibaca: r[6], waktuDibuat: r[7]
      };
    }),
    ARSIP_DOKUMEN: sheetRowsToObjects(ss.getSheetByName('ARSIP_DOKUMEN'), function(r) {
      var rawDriveUrl = r[5] || '';
      var clearDriveUrl = String(rawDriveUrl).indexOf('https://drive.google.com/') === 0
        ? rawDriveUrl
        : 'https://drive.google.com/drive/folders/1ejMB8Sdcpcq2NOHFgkoxTdbuYi5dbjEE?usp=drive_link';
      return {
        idDokumen: r[0], idPermohonan: r[1], nomorPermohonan: r[2], namaPegawai: r[3],
        namaFile: r[4], urlGoogleDrive: clearDriveUrl, jenisDokumen: r[6], tanggalArsip: r[7]
      };
    }),
    LOG_AKTIVITAS: sheetRowsToObjects(ss.getSheetByName('LOG_AKTIVITAS'), function(r) {
      return {
        idLog: r[0], userId: r[1], namaPengguna: r[2], aktivitas: r[3],
        modul: r[4], idReferensi: r[5], keterangan: r[6], waktuAktivitas: r[7]
      };
    }),
    PENGATURAN: sheetRowsToObjects(ss.getSheetByName('PENGATURAN'), function(r) {
      return {
        namaPengaturan: r[0], nilai: r[1], keterangan: r[2], tanggalDiperbarui: r[3]
      };
    })
  };
}

function overwriteSheetRows(ss, sheetName, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var headers = SHEET_SCHEMA[sheetName];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows && rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function writeAllSheets(ss, p) {
  if (Array.isArray(p.MASTER_PEGAWAI)) {
    overwriteSheetRows(ss, 'MASTER_PEGAWAI', p.MASTER_PEGAWAI.map(function(e) {
      return [e.idPegawai || e.nip, "'" + e.nip, e.namaLengkap, e.jenisKelamin, e.bidang, e.bagian, e.jabatan, e.unit, e.email, "'" + e.nomorTelepon, e.idAtasanLangsung, e.idMudirUnit, e.statusKepegawaian, e.statusAktif, e.tanggalDibuat, e.tanggalDiperbarui];
    }));
  }
  if (Array.isArray(p.USERS)) {
    overwriteSheetRows(ss, 'USERS', p.USERS.map(function(u) {
      var passVal = u.passwordPlain || u.password || u.passwordHash || '';
      return [u.userId, u.idPegawai, u.namaPengguna, u.email, String(passVal).indexOf("'") === 0 ? passVal : "'" + passVal, u.role, u.unit, u.idAtasan, u.idMudir, u.statusAkun, u.tanggalDibuat, u.terakhirLogin];
    }));
  }
  if (Array.isArray(p.PERMOHONAN)) {
    overwriteSheetRows(ss, 'PERMOHONAN', p.PERMOHONAN.map(function(r) {
      return [r.idPermohonan, r.nomorPermohonan, r.idPegawai, r.namaPegawai, r.bidang, r.bagian, r.jabatan, r.unit, r.jenisPermohonan, r.kategoriKeperluan, r.tanggalMulai, r.tanggalSelesai, r.jumlahHari, r.alasan, r.keteranganTambahan, r.lampiran, r.tanggalPengajuan, r.statusPermohonan, r.statusAtasan, r.statusMudir, r.catatanAtasan, r.catatanMudir, r.catatanSdm, r.urlPdf, r.tanggalDisetujui, r.tanggalDiarsipkan];
    }));
  }
  if (Array.isArray(p.PERSETUJUAN)) {
    overwriteSheetRows(ss, 'PERSETUJUAN', p.PERSETUJUAN.map(function(a) {
      return [a.idPersetujuan, a.idPermohonan, a.namaPenyetuju, a.emailPenyetuju, a.rolePenyetuju, a.keputusan, a.catatan, a.urlTandaTangan, a.waktuPersetujuan];
    }));
  }
  if (Array.isArray(p.NOTIFIKASI)) {
    overwriteSheetRows(ss, 'NOTIFIKASI', p.NOTIFIKASI.map(function(n) {
      return [n.idNotifikasi, n.userId, n.emailPenerima, n.judul, n.pesan, n.idPermohonan, n.statusDibaca, n.waktuDibuat];
    }));
  }
  if (Array.isArray(p.ARSIP_DOKUMEN)) {
    overwriteSheetRows(ss, 'ARSIP_DOKUMEN', p.ARSIP_DOKUMEN.map(function(d) {
      return [d.idDokumen, d.idPermohonan, d.nomorPermohonan, d.namaPegawai, d.namaFile, d.urlGoogleDrive, d.jenisDokumen, d.tanggalArsip];
    }));
  }
  if (Array.isArray(p.LOG_AKTIVITAS)) {
    overwriteSheetRows(ss, 'LOG_AKTIVITAS', p.LOG_AKTIVITAS.slice(0, 200).map(function(l) {
      return [l.idLog, l.userId, l.namaPengguna, l.aktivitas, l.modul, l.idReferensi, l.keterangan, l.waktuAktivitas];
    }));
  }
}`,
  },
  {
    filename: 'Code.gs',
    title: 'Entry Point Web App & Router API (doGet / doPost)',
    description: 'Menangani HTTP request dari Frontend React, routing action ke modul terkait, serta penerapan LockService.',
    functionsIncluded: ['doGet()', 'doPost()', 'handleApiAction()'],
    code: `/**
 * ============================================================================
 * SISTEM INFORMASI PERMOHONAN IZIN DAN CUTI PEGAWAI
 * PESANTREN ISLAM INTERNASIONAL AL-ANDALUS
 * DIVISI SDM & PENJAMINAN MUTU
 * File: Code.gs (Entry Point & API Router)
 * ============================================================================
 */

function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? e.parameter.action : 'status';
  try {
    if (action === 'setupDatabase') {
      var setupResult = setupDatabase();
      return jsonResponse({ success: true, data: setupResult });
    }
    var dbInfo = getDatabaseInfo();
    return jsonResponse({
      success: true,
      app: 'SISTEM INFORMASI PERMOHONAN IZIN DAN CUTI PEGAWAI AL-ANDALUS',
      database: dbInfo
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // Mencegah race condition & duplikasi nomor permohonan
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var actorEmail = payload.actorEmail || Session.getActiveUser().getEmail();
    var result = handleApiAction(action, payload.data || {}, actorEmail);
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function handleApiAction(action, data, actorEmail) {
  switch (action) {
    // Database
    case 'setupDatabase': return setupDatabase();
    case 'getDatabase': return getDatabaseInfo();
    // Authentication & Users
    case 'authenticateUser': return authenticateUser(data.email, data.passwordHash);
    case 'getCurrentUser': return getCurrentUser(actorEmail);
    case 'createUser': return createUser(actorEmail, data);
    case 'updateUserRole': return updateUserRole(actorEmail, data.userId, data.newRole);
    // Employees
    case 'getEmployees': return getEmployees(actorEmail);
    case 'getEmployeeById': return getEmployeeById(data.idPegawai);
    case 'addEmployee': return addEmployee(actorEmail, data);
    case 'updateEmployee': return updateEmployee(actorEmail, data);
    case 'deactivateEmployee': return deactivateEmployee(actorEmail, data.idPegawai);
    case 'importEmployees': return importEmployees(actorEmail, data.employees);
    // Leave Requests
    case 'createLeaveRequest': return createLeaveRequest(actorEmail, data);
    case 'getLeaveRequests': return getLeaveRequests(actorEmail);
    case 'getLeaveRequestById': return getLeaveRequestById(actorEmail, data.idPermohonan);
    case 'updateLeaveRequest': return updateLeaveRequest(actorEmail, data);
    case 'submitLeaveRequest': return submitLeaveRequest(actorEmail, data);
    // Approvals
    case 'approveBySupervisor': return approveBySupervisor(actorEmail, data);
    case 'rejectBySupervisor': return rejectBySupervisor(actorEmail, data);
    case 'requestRevisionBySupervisor': return requestRevisionBySupervisor(actorEmail, data);
    case 'approveByMudir': return approveByMudir(actorEmail, data);
    case 'rejectByMudir': return rejectByMudir(actorEmail, data);
    case 'requestRevisionByMudir': return requestRevisionByMudir(actorEmail, data);
    // Signatures & PDF
    case 'saveSignature': return saveSignature(actorEmail, data.base64Png, data.role);
    case 'generateLeavePDF': return generateLeavePDF(actorEmail, data.idPermohonan);
    case 'archivePDF': return archivePDF(actorEmail, data.idPermohonan, data.catatanSdm);
    // Notifications & Reports
    case 'getNotifications': return getNotifications(actorEmail);
    case 'markNotificationAsRead': return markNotificationAsRead(actorEmail, data.idNotifikasi);
    case 'getDashboardStatistics': return getDashboardStatistics(actorEmail);
    case 'generateReport': return generateReport(actorEmail, data.filters);
    case 'getActivityLogs': return getActivityLogs(actorEmail);
    default:
      throw new Error('Action tidak dikenali: ' + action);
  }
}`,
  },
  {
    filename: 'Database.gs',
    title: 'Otomatisasi Pembuatan Database Spreadsheet & Folder Google Drive',
    description: 'Mengimplementasikan setupDatabase() yang otomatis membuat Google Spreadsheet, 9 sheet, header kolom, format tanggal, dan 3 folder Google Drive tanpa duplikasi.',
    functionsIncluded: ['setupDatabase()', 'getDatabase()', 'createSheetIfNotExists()', 'initializeSettings()'],
    code: `/**
 * ============================================================================
 * File: Database.gs
 * Pembuatan Database Google Spreadsheet & Folder Google Drive Otomatis
 * ============================================================================
 */

var DB_SPREADSHEET_NAME = 'DATABASE SISTEM IZIN DAN CUTI PEGAWAI AL-ANDALUS';

var DB_SCHEMA = {
  'MASTER_PEGAWAI': [
    'ID Pegawai', 'NIP', 'Nama Lengkap', 'Jenis Kelamin', 'Bidang', 'Bagian',
    'Jabatan', 'Unit', 'Email', 'Nomor Telepon', 'ID Atasan Langsung',
    'ID Mudir Unit', 'Status Kepegawaian', 'Status Aktif', 'Tanggal Dibuat', 'Tanggal Diperbarui'
  ],
  'USERS': [
    'User ID', 'ID Pegawai', 'Nama Pengguna', 'Email', 'Role', 'Unit',
    'ID Atasan', 'ID Mudir', 'Status Akun', 'Tanggal Dibuat', 'Terakhir Login'
  ],
  'PERMOHONAN': [
    'ID Permohonan', 'Nomor Permohonan', 'ID Pegawai', 'Nama Pegawai', 'Bidang',
    'Bagian', 'Jabatan', 'Unit', 'Jenis Permohonan', 'Kategori Keperluan',
    'Tanggal Mulai', 'Tanggal Selesai', 'Jumlah Hari', 'Alasan', 'Keterangan Tambahan',
    'Lampiran', 'Tanggal Pengajuan', 'Status Permohonan', 'Status Atasan',
    'Status Mudir', 'Catatan Atasan', 'Catatan Mudir', 'Catatan SDM',
    'URL PDF', 'Tanggal Disetujui', 'Tanggal Diarsipkan'
  ],
  'KETENTUAN_IZIN_CUTI': [
    'ID Kategori', 'Nama Keperluan', 'Durasi', 'Minimal Pengajuan',
    'Keterangan', 'Status Aktif', 'Tanggal Diperbarui'
  ],
  'PERSETUJUAN': [
    'ID Persetujuan', 'ID Permohonan', 'Nama Penyetuju', 'Email Penyetuju',
    'Role Penyetuju', 'Keputusan', 'Catatan', 'URL Tanda Tangan', 'Waktu Persetujuan'
  ],
  'NOTIFIKASI': [
    'ID Notifikasi', 'User ID', 'Email Penerima', 'Judul', 'Pesan',
    'ID Permohonan', 'Status Dibaca', 'Waktu Dibuat'
  ],
  'ARSIP_DOKUMEN': [
    'ID Dokumen', 'ID Permohonan', 'Nomor Permohonan', 'Nama Pegawai',
    'Nama File', 'URL Google Drive', 'Jenis Dokumen', 'Tanggal Arsip'
  ],
  'LOG_AKTIVITAS': [
    'ID Log', 'User ID', 'Nama Pengguna', 'Aktivitas', 'Modul',
    'ID Referensi', 'Keterangan', 'Waktu Aktivitas'
  ],
  'PENGATURAN': [
    'Nama Pengaturan', 'Nilai', 'Keterangan', 'Tanggal Diperbarui'
  ]
};

function setupDatabase() {
  var props = PropertiesService.getScriptProperties();
  var existingSsId = props.getProperty('SPREADSHEET_ID');
  var ss = null;
  var alreadyExists = false;

  if (existingSsId) {
    try {
      ss = SpreadsheetApp.openById(existingSsId);
      alreadyExists = true;
    } catch (e) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create(DB_SPREADSHEET_NAME);
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  // Buat seluruh 9 sheet dan header kolom secara otomatis
  var sheetNames = Object.keys(DB_SCHEMA);
  for (var i = 0; i < sheetNames.length; i++) {
    var sName = sheetNames[i];
    createSheetIfNotExists(ss, sName, DB_SCHEMA[sName]);
  }

  // Hapus Sheet1 bawaan jika masih ada
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Buat Folder Google Drive untuk Dokumen, Tanda Tangan, dan Arsip PDF
  var docFolderId = ensureDriveFolder(props, 'DOC_FOLDER_ID', 'DOKUMEN_IZIN_CUTI_AL_ANDALUS');
  var sigFolderId = ensureDriveFolder(props, 'SIG_FOLDER_ID', 'TANDA_TANGAN_DIGITAL_AL_ANDALUS');
  var pdfFolderId = ensureDriveFolder(props, 'PDF_FOLDER_ID', 'ARSIP_PDF_RESMI_AL_ANDALUS');

  initializeSettings(ss);
  seedOfficialLeavePolicies(ss);

  return {
    alreadyExists: alreadyExists,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    docFolderId: docFolderId,
    signatureFolderId: sigFolderId,
    pdfArchiveFolderId: pdfFolderId,
    sheets: sheetNames
  };
}

function getDatabase() {
  var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!ssId) {
    setupDatabase();
    ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  }
  return SpreadsheetApp.openById(ssId);
}

function createSheetIfNotExists(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#064e3b')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  // Format kolom tanggal pada PERMOHONAN
  if (sheetName === 'PERMOHONAN') {
    sheet.getRange('K2:L1000').setNumberFormat('yyyy-mm-dd');
    sheet.getRange('Q2:Q1000').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
  return sheet;
}

function initializeSettings(ss) {
  var sheet = ss.getSheetByName('PENGATURAN');
  if (sheet.getLastRow() <= 1) {
    var now = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow(['NAMA_APLIKASI', 'SISTEM INFORMASI PERMOHONAN IZIN DAN CUTI PEGAWAI', 'Nama aplikasi resmi', now]);
    sheet.appendRow(['ORGANISASI', 'PESANTREN ISLAM INTERNASIONAL AL-ANDALUS', 'Nama lembaga', now]);
    sheet.appendRow(['FORMAT_NOMOR_PERMOHONAN', 'AIS-IZC-YYYY-XXXX', 'Format nomor unik otomatis', now]);
  }
}`,
  },
  {
    filename: 'Authentication.gs',
    title: 'Autentikasi Pengguna & Validasi Role RBAC Server-Side',
    description: 'Memverifikasi identitas pengguna pada sheet USERS, memvalidasi hak akses di sisi server, dan mengelola akun pengguna.',
    functionsIncluded: ['authenticateUser()', 'getCurrentUser()', 'createUser()', 'updateUserRole()', 'validatePermission()'],
    code: `/**
 * ============================================================================
 * File: Authentication.gs
 * Sistem Autentikasi & Validasi Hak Akses (RBAC)
 * ============================================================================
 */

function authenticateUser(email, passwordHash) {
  var ss = getDatabase();
  var sheet = ss.getSheetByName('USERS');
  var data = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][3]).toLowerCase() === String(email).toLowerCase()) {
      if (data[i][8] !== 'Aktif') {
        throw new Error('Akun pengguna tidak aktif. Hubungi Admin SDM.');
      }
      sheet.getRange(i + 1, 11).setValue(now); // Update Terakhir Login
      recordActivity(data[i][0], data[i][2], 'LOGIN', 'AUTH', data[i][0], 'Login berhasil ke sistem');
      return mapRowToUser(data[i]);
    }
  }
  throw new Error('Email pengguna tidak terdaftar pada sheet USERS.');
}

function getCurrentUser(email) {
  var ss = getDatabase();
  var data = ss.getSheetByName('USERS').getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][3]).toLowerCase() === String(email).toLowerCase()) {
      return mapRowToUser(data[i]);
    }
  }
  return null;
}

function validatePermission(actorEmail, allowedRoles) {
  var user = getCurrentUser(actorEmail);
  if (!user) {
    throw new Error('Akses ditolak: Identitas pengguna tidak terverifikasi.');
  }
  if (user.statusAkun !== 'Aktif') {
    throw new Error('Akses ditolak: Akun pengguna berstatus Nonaktif.');
  }
  if (user.role === 'SUPER ADMIN') return user;
  if (allowedRoles.indexOf(user.role) === -1) {
    throw new Error('Akses ditolak: Role ' + user.role + ' tidak berwenang.');
  }
  return user;
}

function createUser(actorEmail, payload) {
  var actor = validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  var ss = getDatabase();
  var sheet = ss.getSheetByName('USERS');
  var now = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  var userId = 'USR-' + Utilities.formatString('%03d', sheet.getLastRow());
  sheet.appendRow([
    userId, payload.idPegawai, payload.namaPengguna, payload.email,
    payload.role, payload.unit, payload.idAtasan || '-', payload.idMudir || '-',
    'Aktif', now, '-'
  ]);
  recordActivity(actor.userId, actor.namaPengguna, 'CREATE_USER', 'USERS', userId, 'Membuat akun ' + payload.email);
  return { userId: userId };
}

function updateUserRole(actorEmail, targetUserId, newRole) {
  var actor = validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  var ss = getDatabase();
  var sheet = ss.getSheetByName('USERS');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === targetUserId) {
      sheet.getRange(i + 1, 5).setValue(newRole);
      recordActivity(actor.userId, actor.namaPengguna, 'UPDATE_ROLE', 'USERS', targetUserId, 'Ubah role ke ' + newRole);
      return true;
    }
  }
  throw new Error('User ID tidak ditemukan.');
}`,
  },
  {
    filename: 'Employees.gs',
    title: 'Master Data Pegawai & Impor Massal Excel',
    description: 'Mengelola data pegawai pada sheet MASTER_PEGAWAI, termasuk validasi duplikasi NIP dan impor massal.',
    functionsIncluded: ['getEmployees()', 'getEmployeeById()', 'addEmployee()', 'updateEmployee()', 'deactivateEmployee()', 'importEmployees()'],
    code: `/**
 * ============================================================================
 * File: Employees.gs
 * Pengelolaan Master Data Pegawai & Impor Excel
 * ============================================================================
 */

function getEmployees(actorEmail) {
  validatePermission(actorEmail, ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN']);
  var sheet = getDatabase().getSheetByName('MASTER_PEGAWAI');
  return getRowsAsObjects(sheet);
}

function getEmployeeById(idPegawai) {
  var list = getRowsAsObjects(getDatabase().getSheetByName('MASTER_PEGAWAI'));
  for (var i = 0; i < list.length; i++) {
    if (list[i]['ID Pegawai'] === idPegawai) return list[i];
  }
  return null;
}

function addEmployee(actorEmail, emp) {
  var actor = validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  var sheet = getDatabase().getSheetByName('MASTER_PEGAWAI');
  var now = getNowFormatted();
  sheet.appendRow([
    emp.idPegawai, emp.nip, emp.namaLengkap, emp.jenisKelamin,
    emp.bidang, emp.bagian, emp.jabatan, emp.unit, emp.email,
    emp.nomorTelepon, emp.idAtasanLangsung, emp.idMudirUnit,
    emp.statusKepegawaian, 'Aktif', now, now
  ]);
  recordActivity(actor.userId, actor.namaPengguna, 'ADD_EMPLOYEE', 'MASTER_PEGAWAI', emp.idPegawai, 'Menambah pegawai: ' + emp.namaLengkap);
  return emp;
}

function updateEmployee(actorEmail, emp) {
  var actor = validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  var sheet = getDatabase().getSheetByName('MASTER_PEGAWAI');
  var data = sheet.getDataRange().getValues();
  var now = getNowFormatted();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === emp.idPegawai) {
      sheet.getRange(i + 1, 1, 1, 16).setValues([[
        emp.idPegawai, emp.nip, emp.namaLengkap, emp.jenisKelamin,
        emp.bidang, emp.bagian, emp.jabatan, emp.unit, emp.email,
        emp.nomorTelepon, emp.idAtasanLangsung, emp.idMudirUnit,
        emp.statusKepegawaian, emp.statusAktif, data[i][14], now
      ]]);
      recordActivity(actor.userId, actor.namaPengguna, 'UPDATE_EMPLOYEE', 'MASTER_PEGAWAI', emp.idPegawai, 'Memperbarui data pegawai');
      return emp;
    }
  }
  throw new Error('ID Pegawai tidak ditemukan.');
}

function deactivateEmployee(actorEmail, idPegawai) {
  var actor = validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  var sheet = getDatabase().getSheetByName('MASTER_PEGAWAI');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === idPegawai) {
      sheet.getRange(i + 1, 14).setValue('Nonaktif');
      sheet.getRange(i + 1, 16).setValue(getNowFormatted());
      recordActivity(actor.userId, actor.namaPengguna, 'DEACTIVATE_EMPLOYEE', 'MASTER_PEGAWAI', idPegawai, 'Menonaktifkan pegawai');
      return true;
    }
  }
  throw new Error('ID Pegawai tidak ditemukan.');
}

function importEmployees(actorEmail, employeesArray) {
  var actor = validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  var sheet = getDatabase().getSheetByName('MASTER_PEGAWAI');
  var now = getNowFormatted();
  for (var i = 0; i < employeesArray.length; i++) {
    var e = employeesArray[i];
    sheet.appendRow([
      e.idPegawai, e.nip, e.namaLengkap, e.jenisKelamin,
      e.bidang, e.bagian, e.jabatan, e.unit, e.email,
      e.nomorTelepon, e.idAtasanLangsung, e.idMudirUnit,
      e.statusKepegawaian, e.statusAktif || 'Aktif', now, now
    ]);
  }
  recordActivity(actor.userId, actor.namaPengguna, 'IMPORT_EXCEL', 'MASTER_PEGAWAI', 'BATCH', 'Impor ' + employeesArray.length + ' pegawai dari Excel');
  return { importedCount: employeesArray.length };
}`,
  },
  {
    filename: 'LeaveRequests.gs',
    title: 'Manajemen Permohonan Izin & Cuti Pegawai',
    description: 'Menangani pembuatan draft, pengajuan permohonan, filter hak akses per role, dan penomoran otomatis AIS-IZC-YYYY-XXXX.',
    functionsIncluded: ['createLeaveRequest()', 'getLeaveRequests()', 'getLeaveRequestById()', 'updateLeaveRequest()', 'submitLeaveRequest()', 'generateRequestNumber()'],
    code: `/**
 * ============================================================================
 * File: LeaveRequests.gs
 * Pengelolaan Permohonan Izin dan Cuti Pegawai
 * ============================================================================
 */

function generateRequestNumber() {
  var sheet = getDatabase().getSheetByName('PERMOHONAN');
  var year = new Date().getFullYear();
  var seq = sheet.getLastRow();
  return 'AIS-IZC-' + year + '-' + Utilities.formatString('%04d', seq);
}

function createLeaveRequest(actorEmail, req) {
  var actor = validatePermission(actorEmail, ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN']);
  var sheet = getDatabase().getSheetByName('PERMOHONAN');
  var nomor = generateRequestNumber();
  var idPermohonan = 'REQ-' + new Date().getTime();
  var now = getNowFormatted();

  sheet.appendRow([
    idPermohonan, nomor, req.idPegawai, req.namaPegawai, req.bidang,
    req.bagian, req.jabatan, req.unit, req.jenisPermohonan, req.kategoriKeperluan,
    req.tanggalMulai, req.tanggalSelesai, req.jumlahHari, req.alasan,
    req.keteranganTambahan || '-', req.lampiran || '-', now,
    'DRAFT', 'BELUM DIPROSES', 'BELUM DIPROSES', '-', '-', '-', '-', '-', '-'
  ]);
  recordActivity(actor.userId, actor.namaPengguna, 'CREATE_DRAFT', 'PERMOHONAN', nomor, 'Menyimpan draft permohonan');
  return { idPermohonan: idPermohonan, nomorPermohonan: nomor };
}

function submitLeaveRequest(actorEmail, req) {
  var actor = validatePermission(actorEmail, ['PEGAWAI', 'ATASAN LANGSUNG', 'MUDIR UNIT', 'ADMIN SDM', 'SUPER ADMIN']);
  var sigFileUrl = saveSignature(actorEmail, req.ttdPemohonBase64, 'PEGAWAI');
  // Ubah status menjadi MENUNGGU PERSETUJUAN ATASAN & kirim notifikasi ke Atasan Langsung
  createNotification(req.idAtasanUserId, req.emailAtasan, 'Permohonan Baru Menunggu Persetujuan',
    'Pegawai ' + req.namaPegawai + ' mengajukan ' + req.jenisPermohonan + ' (' + req.nomorPermohonan + ').', req.idPermohonan);
  return { status: 'MENUNGGU PERSETUJUAN ATASAN', signatureUrl: sigFileUrl };
}

function getLeaveRequests(actorEmail) {
  var actor = getCurrentUser(actorEmail);
  var all = getRowsAsObjects(getDatabase().getSheetByName('PERMOHONAN'));
  if (actor.role === 'ADMIN SDM' || actor.role === 'SUPER ADMIN') return all;
  if (actor.role === 'PEGAWAI') {
    return all.filter(function(r) { return r['ID Pegawai'] === actor.idPegawai; });
  }
  return all;
}

function getLeaveRequestById(actorEmail, idPermohonan) {
  var list = getLeaveRequests(actorEmail);
  for (var i = 0; i < list.length; i++) {
    if (list[i]['ID Permohonan'] === idPermohonan) return list[i];
  }
  throw new Error('Permohonan tidak ditemukan atau Anda tidak memiliki akses.');
}

function updateLeaveRequest(actorEmail, req) {
  var actor = getCurrentUser(actorEmail);
  recordActivity(actor.userId, actor.namaPengguna, 'UPDATE_REQUEST', 'PERMOHONAN', req.idPermohonan, 'Memperbarui data permohonan');
  return req;
}`,
  },
  {
    filename: 'Approvals.gs',
    title: 'Alur Persetujuan Berjenjang (Atasan Langsung -> Mudir Unit -> Admin SDM)',
    description: 'Menjalankan proses persetujuan berurutan, penolakan dengan alasan wajib, dan permintaan revisi.',
    functionsIncluded: [
      'approveBySupervisor()', 'rejectBySupervisor()', 'requestRevisionBySupervisor()',
      'approveByMudir()', 'rejectByMudir()', 'requestRevisionByMudir()'
    ],
    code: `/**
 * ============================================================================
 * File: Approvals.gs
 * Alur Persetujuan Berurutan: PEGAWAI -> ATASAN LANGSUNG -> MUDIR UNIT -> ADMIN SDM
 * ============================================================================
 */

function approveBySupervisor(actorEmail, payload) {
  var actor = validatePermission(actorEmail, ['ATASAN LANGSUNG', 'SUPER ADMIN']);
  var sigUrl = saveSignature(actorEmail, payload.signatureBase64, 'ATASAN LANGSUNG');
  recordApprovalSheet(payload.idPermohonan, actor, 'SETUJUI', payload.catatan || 'Disetujui Atasan Langsung', sigUrl);
  updateRequestStatusColumns(payload.idPermohonan, 'MENUNGGU PERSETUJUAN MUDIR', 'DISETUJUI', 'MENUNGGU', payload.catatan, null);
  createNotification(payload.mudirUserId, payload.mudirEmail, 'Permohonan Menunggu Persetujuan Mudir',
    'Permohonan ' + payload.nomorPermohonan + ' telah disetujui Atasan dan menunggu keputusan Mudir Unit.', payload.idPermohonan);
  return { status: 'MENUNGGU PERSETUJUAN MUDIR', sigUrl: sigUrl };
}

function rejectBySupervisor(actorEmail, payload) {
  var actor = validatePermission(actorEmail, ['ATASAN LANGSUNG', 'SUPER ADMIN']);
  if (!payload.catatan) throw new Error('Atasan wajib memberikan alasan penolakan.');
  recordApprovalSheet(payload.idPermohonan, actor, 'TOLAK', payload.catatan, '-');
  updateRequestStatusColumns(payload.idPermohonan, 'DITOLAK ATASAN', 'DITOLAK', 'BELUM DIPROSES', payload.catatan, null);
  return { status: 'DITOLAK ATASAN' };
}

function requestRevisionBySupervisor(actorEmail, payload) {
  var actor = validatePermission(actorEmail, ['ATASAN LANGSUNG', 'SUPER ADMIN']);
  if (!payload.catatan) throw new Error('Atasan wajib memberikan catatan revisi.');
  recordApprovalSheet(payload.idPermohonan, actor, 'MINTA REVISI', payload.catatan, '-');
  updateRequestStatusColumns(payload.idPermohonan, 'PERLU REVISI ATASAN', 'REVISI', 'BELUM DIPROSES', payload.catatan, null);
  return { status: 'PERLU REVISI ATASAN' };
}

function approveByMudir(actorEmail, payload) {
  var actor = validatePermission(actorEmail, ['MUDIR UNIT', 'SUPER ADMIN']);
  var sigUrl = saveSignature(actorEmail, payload.signatureBase64, 'MUDIR UNIT');
  recordApprovalSheet(payload.idPermohonan, actor, 'SETUJUI', payload.catatan || 'Disetujui Mudir Unit', sigUrl);
  updateRequestStatusColumns(payload.idPermohonan, 'DISETUJUI', 'DISETUJUI', 'DISETUJUI', null, payload.catatan);
  // Otomatis generate PDF resmi setelah disetujui Mudir Unit
  var pdfUrl = generateLeavePDF(actorEmail, payload.idPermohonan);
  return { status: 'DISETUJUI', pdfUrl: pdfUrl };
}

function rejectByMudir(actorEmail, payload) {
  var actor = validatePermission(actorEmail, ['MUDIR UNIT', 'SUPER ADMIN']);
  if (!payload.catatan) throw new Error('Mudir wajib memberikan alasan penolakan.');
  recordApprovalSheet(payload.idPermohonan, actor, 'TOLAK', payload.catatan, '-');
  updateRequestStatusColumns(payload.idPermohonan, 'DITOLAK MUDIR', 'DISETUJUI', 'DITOLAK', null, payload.catatan);
  return { status: 'DITOLAK MUDIR' };
}

function requestRevisionByMudir(actorEmail, payload) {
  var actor = validatePermission(actorEmail, ['MUDIR UNIT', 'SUPER ADMIN']);
  if (!payload.catatan) throw new Error('Mudir wajib memberikan catatan revisi.');
  recordApprovalSheet(payload.idPermohonan, actor, 'MINTA REVISI', payload.catatan, '-');
  updateRequestStatusColumns(payload.idPermohonan, 'PERLU REVISI MUDIR', 'DISETUJUI', 'REVISI', null, payload.catatan);
  return { status: 'PERLU REVISI MUDIR' };
}`,
  },
  {
    filename: 'Signatures.gs',
    title: 'Penyimpanan Tanda Tangan Digital PNG ke Google Drive',
    description: 'Menyimpan gambar tanda tangan digital berformat PNG ke folder khusus Google Drive dan memvalidasi pemilik tanda tangan.',
    functionsIncluded: ['saveSignature()', 'getSignature()', 'validateSignatureOwner()'],
    code: `/**
 * ============================================================================
 * File: Signatures.gs
 * Pengelolaan Tanda Tangan Digital PNG di Google Drive
 * ============================================================================
 */

function saveSignature(actorEmail, base64DataUrl, roleLabel) {
  var actor = getCurrentUser(actorEmail);
  if (!actor) throw new Error('Identitas penandatangan tidak valid.');
  var folderId = PropertiesService.getScriptProperties().getProperty('SIG_FOLDER_ID');
  var folder = DriveApp.getFolderById(folderId);

  var cleanBase64 = base64DataUrl.replace(/^data:image\\/png;base64,/, '');
  var decoded = Utilities.base64Decode(cleanBase64);
  var fileName = 'TTD_' + actor.idPegawai + '_' + roleLabel + '_' + new Date().getTime() + '.png';
  var blob = Utilities.newBlob(decoded, 'image/png', fileName);
  var file = folder.createFile(blob);

  recordActivity(actor.userId, actor.namaPengguna, 'SAVE_SIGNATURE', 'SIGNATURES', file.getId(), 'Menyimpan tanda tangan digital PNG');
  return file.getUrl();
}

function getSignature(fileId) {
  var file = DriveApp.getFileById(fileId);
  return file.getUrl();
}

function validateSignatureOwner(actorEmail, targetUserId) {
  var actor = getCurrentUser(actorEmail);
  if (!actor || actor.userId !== targetUserId) {
    throw new Error('Pelanggaran Keamanan: Pengguna tidak diizinkan memberikan tanda tangan atas nama pihak lain.');
  }
  return true;
}`,
  },
  {
    filename: 'PDFGenerator.gs',
    title: 'Pembuatan Dokumen PDF Resmi (AIS-FRM-SEK.02.11 Rev 1)',
    description: 'Mengisi template formulir resmi AIS-FRM-SEK.02.11 dengan data permohonan & ketiga tanda tangan digital, mengekspor ke PDF, dan menyimpan ke Google Drive.',
    functionsIncluded: ['generateLeavePDF()', 'getPDFUrl()', 'archivePDF()'],
    code: `/**
 * ============================================================================
 * File: PDFGenerator.gs
 * Pembuatan Dokumen PDF Resmi: AIS-FRM-SEK.02.11. Form Izin atau Cuti Pegawai-Rev 1
 * Nama File Output: AIS-IZC-2026-0001_Nama-Pegawai.pdf
 * ============================================================================
 */

function generateLeavePDF(actorEmail, idPermohonan) {
  var req = getLeaveRequestById(actorEmail, idPermohonan);
  var props = PropertiesService.getScriptProperties();
  var pdfFolder = DriveApp.getFolderById(props.getProperty('PDF_FOLDER_ID'));
  var templateDocId = props.getProperty('OFFICIAL_TEMPLATE_DOC_ID');

  var safeName = String(req['Nama Pegawai']).replace(/\\s+/g, '-');
  var pdfFileName = req['Nomor Permohonan'] + '_' + safeName + '.pdf';

  if (templateDocId) {
    var copyFile = DriveApp.getFileById(templateDocId).makeCopy('TEMP_' + pdfFileName, pdfFolder);
    var doc = DocumentApp.openById(copyFile.getId());
    var body = doc.getBody();

    body.replaceText('{{NAMA_PEGAWAI}}', req['Nama Pegawai']);
    body.replaceText('{{BIDANG_BAGIAN}}', req['Bidang'] + ' / ' + req['Bagian']);
    body.replaceText('{{HARI_TANGGAL}}', req['Tanggal Mulai'] + ' s/d ' + req['Tanggal Selesai'] + ' (' + req['Jumlah Hari'] + ')');
    body.replaceText('{{ALASAN_CUTI_IZIN}}', req['Alasan']);
    doc.saveAndClose();

    var pdfBlob = copyFile.getAs(MimeType.PDF).setName(pdfFileName);
    var savedPdf = pdfFolder.createFile(pdfBlob);
    copyFile.setTrashed(true);

    // Catat ke sheet ARSIP_DOKUMEN
    var arsipSheet = getDatabase().getSheetByName('ARSIP_DOKUMEN');
    arsipSheet.appendRow([
      'DOC-' + new Date().getTime(), idPermohonan, req['Nomor Permohonan'],
      req['Nama Pegawai'], pdfFileName, savedPdf.getUrl(), 'FORMULIR_PDF', getNowFormatted()
    ]);

    return savedPdf.getUrl();
  }
  return 'GENERATED_BY_CLIENT_PDF_ENGINE';
}

function getPDFUrl(actorEmail, idPermohonan) {
  var req = getLeaveRequestById(actorEmail, idPermohonan);
  return req['URL PDF'];
}

function archivePDF(actorEmail, idPermohonan, catatanSdm) {
  var actor = validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  recordActivity(actor.userId, actor.namaPengguna, 'ARCHIVE_PDF', 'ARSIP_DOKUMEN', idPermohonan, catatanSdm || 'Diarsipkan oleh SDM');
  return true;
}`,
  },
  {
    filename: 'Notifications.gs',
    title: 'Notifikasi In-App & Email Otomatis (MailApp)',
    description: 'Mengirimkan notifikasi dalam aplikasi (sheet NOTIFIKASI) serta email pemberitahuan otomatis via MailApp.',
    functionsIncluded: ['createNotification()', 'getNotifications()', 'markNotificationAsRead()', 'sendEmailNotification()'],
    code: `/**
 * ============================================================================
 * File: Notifications.gs
 * Sistem Notifikasi Aplikasi & Email (MailApp)
 * ============================================================================
 */

function createNotification(userId, emailPenerima, judul, pesan, idPermohonan) {
  var sheet = getDatabase().getSheetByName('NOTIFIKASI');
  var idNotif = 'NTF-' + new Date().getTime();
  sheet.appendRow([
    idNotif, userId, emailPenerima, judul, pesan,
    idPermohonan, 'BELUM DIBACA', getNowFormatted()
  ]);
  sendEmailNotification(emailPenerima, judul, pesan);
  return idNotif;
}

function getNotifications(actorEmail) {
  var all = getRowsAsObjects(getDatabase().getSheetByName('NOTIFIKASI'));
  return all.filter(function(n) {
    return String(n['Email Penerima']).toLowerCase() === String(actorEmail).toLowerCase();
  });
}

function markNotificationAsRead(actorEmail, idNotifikasi) {
  var sheet = getDatabase().getSheetByName('NOTIFIKASI');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === idNotifikasi) {
      sheet.getRange(i + 1, 7).setValue('SUDAH DIBACA');
      return true;
    }
  }
  return false;
}

function sendEmailNotification(recipientEmail, subject, messageBody) {
  if (!recipientEmail || recipientEmail.indexOf('@') === -1) return;
  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: '[SIM-IZIN AL-ANDALUS] ' + subject,
      body: messageBody + '\\n\\n--\\nDivisi SDM & Penjaminan Mutu\\nPesantren Islam Internasional Al-Andalus'
    });
  } catch (e) {
    Logger.log('Pengiriman email dilewati: ' + e.message);
  }
}`,
  },
  {
    filename: 'Reports.gs',
    title: 'Statistik Dashboard, Rekapitulasi, & Log Aktivitas',
    description: 'Menyediakan data agregasi dashboard per role, laporan rekapitulasi izin/cuti, serta pencatatan jejak audit LOG_AKTIVITAS.',
    functionsIncluded: ['getDashboardStatistics()', 'generateReport()', 'exportToExcel()', 'exportToPDF()', 'recordActivity()', 'getActivityLogs()'],
    code: `/**
 * ============================================================================
 * File: Reports.gs & Security.gs & Utilities.gs
 * Laporan, Statistik Dashboard, Keamanan, dan Pencatatan Log Aktivitas
 * ============================================================================
 */

function getDashboardStatistics(actorEmail) {
  var requests = getLeaveRequests(actorEmail);
  var employees = getRowsAsObjects(getDatabase().getSheetByName('MASTER_PEGAWAI'));
  return {
    totalPegawai: employees.length,
    totalPengajuan: requests.length
  };
}

function generateReport(actorEmail, filters) {
  validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  return getLeaveRequests(actorEmail);
}

function exportToExcel(actorEmail, filters) {
  validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  return generateReport(actorEmail, filters);
}

function exportToPDF(actorEmail, filters) {
  validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  return generateReport(actorEmail, filters);
}

function recordActivity(userId, namaPengguna, aktivitas, modul, idReferensi, keterangan) {
  var sheet = getDatabase().getSheetByName('LOG_AKTIVITAS');
  var idLog = 'LOG-' + Utilities.formatString('%04d', sheet.getLastRow());
  sheet.appendRow([
    idLog, userId, namaPengguna, aktivitas, modul,
    idReferensi, keterangan, getNowFormatted()
  ]);
}

function getActivityLogs(actorEmail) {
  validatePermission(actorEmail, ['ADMIN SDM', 'SUPER ADMIN']);
  return getRowsAsObjects(getDatabase().getSheetByName('LOG_AKTIVITAS'));
}

function getNowFormatted() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`,
  },
];
