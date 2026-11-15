import React, { useState, useMemo } from 'react';
import { LeaveRequest, UserAccount } from '../types';
import {
  FullDatabaseStore,
  getVisibleLeaveRequests,
  isRequestOwnedByUser,
} from '../services/databaseService';
import {
  PlusCircle,
  Eye,
  Download,
  RotateCcw,
  Filter,
  Calendar,
  MessageSquareShare,
  FileSpreadsheet,
  CheckCheck,
  Clock,
  FileText,
} from 'lucide-react';
import {
  generateOfficialLeavePDF,
  generateOfficialLeaveWord,
} from '../utils/pdfGenerator';
import { ShareMessageModal } from './ShareMessageModal';
import { downloadFullDatabaseSpreadsheet } from '../utils/fullDatabaseBuilder';

interface DashboardViewProps {
  store: FullDatabaseStore;
  currentUser: UserAccount;
  onNavigateNewRequest: () => void;
  onNavigateMasterPegawai: () => void;
  onPreviewOfficialPdf: (req: LeaveRequest) => void;
  onEditRevisionRequest: (req: LeaveRequest) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  store,
  currentUser,
  onNavigateNewRequest,
  onNavigateMasterPegawai,
  onPreviewOfficialPdf,
  onEditRevisionRequest,
}) => {
  const isAdminSdm =
    currentUser.role === 'ADMIN SDM' || currentUser.role === 'SUPER ADMIN';

  // Filter states for Admin SDM / Dashboard
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('SEMUA');
  const [filterYear, setFilterYear] = useState('SEMUA');
  const [filterBidang, setFilterBidang] = useState('SEMUA');
  const [filterUnit, setFilterUnit] = useState('SEMUA');
  const [filterJenis, setFilterJenis] = useState('SEMUA');
  const [filterStatus, setFilterStatus] = useState('SEMUA');
  const [dashboardScope, setDashboardScope] = useState<'MINE' | 'ALL'>(
    isAdminSdm ? 'ALL' : 'MINE'
  );
  const [shareMessageRequest, setShareMessageRequest] = useState<LeaveRequest | null>(null);

  const myOwnRequests = useMemo(
    () => (store.PERMOHONAN || []).filter((r) => isRequestOwnedByUser(r, currentUser, store)),
    [store, currentUser]
  );

  const allRoleRequests = useMemo(
    () => getVisibleLeaveRequests(store, currentUser),
    [store, currentUser]
  );

  // Pegawai selalu hanya melihat riwayat pengajuan miliknya sendiri di Beranda
  const roleRequests = useMemo(() => {
    if (currentUser.role === 'PEGAWAI') {
      return myOwnRequests;
    }
    return dashboardScope === 'MINE' ? myOwnRequests : allRoleRequests;
  }, [currentUser.role, dashboardScope, myOwnRequests, allRoleRequests]);

  const filteredRequests = useMemo(() => {
    return roleRequests.filter((r) => {
      if (filterDate && r.tanggalMulai !== filterDate) return false;
      if (filterYear !== 'SEMUA' && !r.tanggalMulai.startsWith(filterYear)) return false;
      if (filterMonth !== 'SEMUA') {
        const m = r.tanggalMulai.slice(5, 7);
        if (m !== filterMonth) return false;
      }
      if (filterBidang !== 'SEMUA' && r.bidang !== filterBidang) return false;
      if (filterUnit !== 'SEMUA' && r.unit !== filterUnit) return false;
      if (filterJenis !== 'SEMUA' && r.jenisPermohonan !== filterJenis) return false;
      if (filterStatus !== 'SEMUA' && r.statusPermohonan !== filterStatus) return false;
      return true;
    });
  }, [
    roleRequests,
    filterDate,
    filterMonth,
    filterYear,
    filterBidang,
    filterUnit,
    filterJenis,
    filterStatus,
  ]);

  const bidangOptions = Array.from(new Set(store.MASTER_PEGAWAI.map((e) => e.bidang))).filter(
    Boolean
  );
  const unitOptions = Array.from(new Set(store.MASTER_PEGAWAI.map((e) => e.unit))).filter(Boolean);

  // Metrics computation
  const stats = useMemo(() => {
    const totalPengajuan = filteredRequests.length;
    const menungguAtasan = filteredRequests.filter(
      (r) => r.statusPermohonan === 'MENUNGGU PERSETUJUAN ATASAN'
    ).length;
    const menungguMudir = filteredRequests.filter(
      (r) => r.statusPermohonan === 'MENUNGGU PERSETUJUAN MUDIR'
    ).length;
    const disetujui = filteredRequests.filter(
      (r) => r.statusPermohonan === 'DISETUJUI' || r.statusPermohonan === 'DIARSIPKAN'
    ).length;
    const ditolak = filteredRequests.filter(
      (r) => r.statusPermohonan === 'DITOLAK ATASAN' || r.statusPermohonan === 'DITOLAK MUDIR'
    ).length;
    const perluRevisi = filteredRequests.filter(
      (r) =>
        r.statusPermohonan === 'PERLU REVISI ATASAN' || r.statusPermohonan === 'PERLU REVISI MUDIR'
    ).length;

    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const bulanIni = roleRequests.filter((r) =>
      r.tanggalMulai.startsWith(currentMonthPrefix)
    ).length;

    return {
      totalPegawai: store.MASTER_PEGAWAI.length,
      totalPengajuan,
      menungguAtasan,
      menungguMudir,
      menungguTotal: menungguAtasan + menungguMudir,
      disetujui,
      ditolak,
      perluRevisi,
      bulanIni,
    };
  }, [filteredRequests, roleRequests, store.MASTER_PEGAWAI.length]);

  // Grafik pengajuan per bulan (Jan - Des)
  const monthlyChartData = useMemo(() => {
    const months = [
      { code: '01', label: 'Jan' },
      { code: '02', label: 'Feb' },
      { code: '03', label: 'Mar' },
      { code: '04', label: 'Apr' },
      { code: '05', label: 'Mei' },
      { code: '06', label: 'Jun' },
      { code: '07', label: 'Jul' },
      { code: '08', label: 'Agu' },
      { code: '09', label: 'Sep' },
      { code: '10', label: 'Okt' },
      { code: '11', label: 'Nov' },
      { code: '12', label: 'Des' },
    ];
    return months.map((m) => {
      const count = filteredRequests.filter((r) => r.tanggalMulai.slice(5, 7) === m.code).length;
      return { ...m, count };
    });
  }, [filteredRequests]);

  // Grafik berdasarkan bidang
  const bidangChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRequests.forEach((r) => {
      const b = r.bidang || 'Lainnya';
      map.set(b, (map.get(b) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [filteredRequests]);

  // Rekap jenis izin/cuti
  const jenisRecapData = useMemo(() => {
    const jenisList: ('Izin' | 'Cuti' | 'Izin Kondisional/Khusus')[] = [
      'Izin',
      'Cuti',
      'Izin Kondisional/Khusus',
    ];
    return jenisList.map((j) => ({
      jenis: j,
      count: filteredRequests.filter((r) => r.jenisPermohonan === j).length,
    }));
  }, [filteredRequests]);

  return (
    <div className="space-y-5">
      {/* Banner Info Sistem ala Gelembung Kuning WhatsApp */}
      <div className="bg-[#fff5c4] border border-[#e6daa6] rounded-lg px-4 py-2.5 text-center text-xs text-[#54656f] shadow-2xs">
        💬 <strong>WhatsApp SIM-SDM Al-Andalus:</strong> Setiap pengajuan izin & cuti tampil sebagai gelembung pesan di bawah ini. Klik <strong>Kirim WA ke Atasan/Mudir</strong> untuk meneruskan ke WhatsApp.
      </div>

      {/* Header Kartu Kontak Aktif & Tombol Aksi */}
      <div className="bg-white border border-[#d1d7db] rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div>
          <p className="text-xs font-bold text-[#008069]">
            PESANTREN ISLAM INTERNASIONAL AL-ANDALUS · DIVISI SDM & PENJAMINAN MUTU
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-[#111b21] mt-0.5">
            {currentUser.namaPengguna} ({currentUser.role})
          </h2>
          <p className="text-xs text-[#667781] mt-0.5">
            NIP / NIY: <span className="font-mono font-semibold text-[#111b21]">{currentUser.idPegawai}</span> · Unit:{' '}
            <span>{currentUser.unit}</span> · Email: <span>{currentUser.email}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(currentUser.role === 'ADMIN SDM' || currentUser.role === 'SUPER ADMIN') && (
            <>
              <button
                type="button"
                onClick={() => downloadFullDatabaseSpreadsheet(store)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#111b21] bg-[#f0f2f5] border border-[#d1d7db] hover:bg-[#e9edef] rounded-full transition-colors whitespace-nowrap shrink-0"
                title="Unduh file Spreadsheet lengkap berisi 9 Sheet resmi"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#008069]" />
                Unduh Database (9 Sheet)
              </button>
              <button
                type="button"
                onClick={onNavigateMasterPegawai}
                className="px-3.5 py-2 text-xs font-bold text-[#008069] bg-[#d9fdd3] border border-[#b7f0ad] hover:bg-[#b7f0ad] rounded-full transition-colors whitespace-nowrap shrink-0"
              >
                Kontak Pegawai ({store.MASTER_PEGAWAI.length})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onNavigateNewRequest}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#00a884] hover:bg-[#008069] rounded-full transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            Kirim Permohonan Baru
          </button>
        </div>
      </div>

      {/* KARTU STATISTIK SESUAI ROLE */}
      {currentUser.role === 'PEGAWAI' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5 shadow-2xs">
            <span className="text-xs text-[#667781]">Total Pengajuan Saya</span>
            <div className="text-2xl font-bold text-[#111b21] font-mono tabular-nums mt-1">
              {stats.totalPengajuan}
            </div>
          </div>
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5 shadow-2xs">
            <span className="text-xs text-[#667781]">Menunggu Persetujuan</span>
            <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
              {stats.menungguTotal}
            </div>
          </div>
          <div className="bg-[#d9fdd3] border border-[#b7f0ad] rounded-xl p-3.5 shadow-2xs">
            <span className="text-xs text-[#008069] font-semibold">Disetujui (✓✓ Biru)</span>
            <div className="text-2xl font-bold text-[#008069] font-mono tabular-nums mt-1">
              {stats.disetujui}
            </div>
          </div>
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5 shadow-2xs">
            <span className="text-xs text-[#667781]">Ditolak</span>
            <div className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
              {stats.ditolak}
            </div>
          </div>
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5 shadow-2xs">
            <span className="text-xs text-[#667781]">Perlu Revisi</span>
            <div className="text-2xl font-bold text-amber-800 font-mono tabular-nums mt-1">
              {stats.perluRevisi}
            </div>
          </div>
        </div>
      )}

      {currentUser.role === 'ATASAN LANGSUNG' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5">
            <span className="text-xs text-[#667781]">Menunggu Persetujuan Atasan</span>
            <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
              {stats.menungguAtasan}
            </div>
          </div>
          <div className="bg-[#d9fdd3] border border-[#b7f0ad] rounded-xl p-3.5">
            <span className="text-xs text-[#008069] font-semibold">Total Disetujui</span>
            <div className="text-2xl font-bold text-[#008069] font-mono tabular-nums mt-1">
              {stats.disetujui}
            </div>
          </div>
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5">
            <span className="text-xs text-[#667781]">Total Ditolak</span>
            <div className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
              {stats.ditolak}
            </div>
          </div>
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5">
            <span className="text-xs text-[#667781]">Total Revisi</span>
            <div className="text-2xl font-bold text-amber-800 font-mono tabular-nums mt-1">
              {stats.perluRevisi}
            </div>
          </div>
        </div>
      )}

      {currentUser.role === 'MUDIR UNIT' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5">
            <span className="text-xs text-[#667781]">Menunggu Persetujuan Mudir</span>
            <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
              {stats.menungguMudir}
            </div>
          </div>
          <div className="bg-[#d9fdd3] border border-[#b7f0ad] rounded-xl p-3.5">
            <span className="text-xs text-[#008069] font-semibold">Total Disetujui</span>
            <div className="text-2xl font-bold text-[#008069] font-mono tabular-nums mt-1">
              {stats.disetujui}
            </div>
          </div>
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5">
            <span className="text-xs text-[#667781]">Total Ditolak</span>
            <div className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
              {stats.ditolak}
            </div>
          </div>
          <div className="bg-white border border-[#d1d7db] rounded-xl p-3.5">
            <span className="text-xs text-[#667781]">Total Revisi</span>
            <div className="text-2xl font-bold text-amber-800 font-mono tabular-nums mt-1">
              {stats.perluRevisi}
            </div>
          </div>
        </div>
      )}

      {(currentUser.role === 'ADMIN SDM' || currentUser.role === 'SUPER ADMIN') && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <div className="bg-white border border-[#d1d7db] rounded-xl p-3">
              <span className="text-[11px] text-[#667781] block">Total Pegawai</span>
              <span className="text-xl font-bold text-[#111b21] font-mono tabular-nums">
                {stats.totalPegawai}
              </span>
            </div>
            <div className="bg-white border border-[#d1d7db] rounded-xl p-3">
              <span className="text-[11px] text-[#667781] block">Total Pengajuan</span>
              <span className="text-xl font-bold text-[#111b21] font-mono tabular-nums">
                {stats.totalPengajuan}
              </span>
            </div>
            <div className="bg-white border border-[#d1d7db] rounded-xl p-3">
              <span className="text-[11px] text-[#667781] block">Menunggu Atasan</span>
              <span className="text-xl font-bold text-amber-700 font-mono tabular-nums">
                {stats.menungguAtasan}
              </span>
            </div>
            <div className="bg-white border border-[#d1d7db] rounded-xl p-3">
              <span className="text-[11px] text-[#667781] block">Menunggu Mudir</span>
              <span className="text-xl font-bold text-amber-700 font-mono tabular-nums">
                {stats.menungguMudir}
              </span>
            </div>
            <div className="bg-[#d9fdd3] border border-[#b7f0ad] rounded-xl p-3">
              <span className="text-[11px] text-[#008069] font-semibold block">Disetujui</span>
              <span className="text-xl font-bold text-[#008069] font-mono tabular-nums">
                {stats.disetujui}
              </span>
            </div>
            <div className="bg-white border border-[#d1d7db] rounded-xl p-3">
              <span className="text-[11px] text-[#667781] block">Ditolak</span>
              <span className="text-xl font-bold text-red-700 font-mono tabular-nums">
                {stats.ditolak}
              </span>
            </div>
            <div className="bg-white border border-[#d1d7db] rounded-xl p-3">
              <span className="text-[11px] text-[#667781] block">Perlu Revisi</span>
              <span className="text-xl font-bold text-amber-800 font-mono tabular-nums">
                {stats.perluRevisi}
              </span>
            </div>
            <div className="bg-white border border-[#d1d7db] rounded-xl p-3">
              <span className="text-[11px] text-[#667781] block">Izin/Cuti Bulan Ini</span>
              <span className="text-xl font-bold text-[#008069] font-mono tabular-nums">
                {stats.bulanIni}
              </span>
            </div>
          </div>

          {/* FILTER MULTI-DIMENSI DASHBOARD SDM */}
          <div className="bg-white border border-[#d1d7db] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#111b21]">
                <Filter className="w-3.5 h-3.5 text-[#008069]" />
                <span>Filter Monitoring Chat Pengajuan & Rekapitulasi SDM</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterDate('');
                  setFilterMonth('SEMUA');
                  setFilterYear('SEMUA');
                  setFilterBidang('SEMUA');
                  setFilterUnit('SEMUA');
                  setFilterJenis('SEMUA');
                  setFilterStatus('SEMUA');
                }}
                className="text-xs font-bold text-[#008069] hover:underline"
              >
                Reset Filter
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] text-[#667781] mb-1">Tanggal Mulai</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#d1d7db] rounded-md font-mono bg-[#f0f2f5]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#667781] mb-1">Bulan</label>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#d1d7db] rounded-md bg-[#f0f2f5]"
                >
                  <option value="SEMUA">Semua Bulan</option>
                  <option value="01">Januari</option>
                  <option value="02">Februari</option>
                  <option value="03">Maret</option>
                  <option value="04">April</option>
                  <option value="05">Mei</option>
                  <option value="06">Juni</option>
                  <option value="07">Juli</option>
                  <option value="08">Agustus</option>
                  <option value="09">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Desember</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#667781] mb-1">Tahun</label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#d1d7db] rounded-md bg-[#f0f2f5]"
                >
                  <option value="SEMUA">Semua Tahun</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#667781] mb-1">Bidang</label>
                <select
                  value={filterBidang}
                  onChange={(e) => setFilterBidang(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#d1d7db] rounded-md bg-[#f0f2f5]"
                >
                  <option value="SEMUA">Semua Bidang</option>
                  {bidangOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#667781] mb-1">Unit</label>
                <select
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#d1d7db] rounded-md bg-[#f0f2f5]"
                >
                  <option value="SEMUA">Semua Unit</option>
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#667781] mb-1">Jenis Permohonan</label>
                <select
                  value={filterJenis}
                  onChange={(e) => setFilterJenis(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#d1d7db] rounded-md bg-[#f0f2f5]"
                >
                  <option value="SEMUA">Semua Jenis</option>
                  <option value="Izin">Izin</option>
                  <option value="Cuti">Cuti</option>
                  <option value="Izin Kondisional/Khusus">Izin Kondisional/Khusus</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[#667781] mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2 py-1.5 border border-[#d1d7db] rounded-md bg-[#f0f2f5]"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="MENUNGGU PERSETUJUAN ATASAN">Menunggu Atasan</option>
                  <option value="MENUNGGU PERSETUJUAN MUDIR">Menunggu Mudir</option>
                  <option value="DISETUJUI">Disetujui</option>
                  <option value="DIARSIPKAN">Diarsipkan</option>
                  <option value="PERLU REVISI ATASAN">Revisi Atasan</option>
                  <option value="PERLU REVISI MUDIR">Revisi Mudir</option>
                  <option value="DITOLAK ATASAN">Ditolak Atasan</option>
                  <option value="DITOLAK MUDIR">Ditolak Mudir</option>
                </select>
              </div>
            </div>
          </div>

          {/* GRAFIK PENGAJUAN PER BULAN, GRAFIK BIDANG, & REKAP JENIS IZIN/CUTI */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-[#d1d7db] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#111b21]">
                  Grafik Pengajuan per Bulan ({filterYear === 'SEMUA' ? 'Semua Tahun' : filterYear})
                </h3>
                <Calendar className="w-4 h-4 text-[#008069]" />
              </div>
              <div className="grid grid-cols-12 gap-1.5 items-end h-32 pt-4 border-b border-[#e9edef]">
                {monthlyChartData.map((m) => {
                  const maxVal = Math.max(1, ...monthlyChartData.map((x) => x.count));
                  const heightPct = Math.max(8, Math.round((m.count / maxVal) * 100));
                  return (
                    <div key={m.code} className="flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[10px] font-mono text-[#54656f] tabular-nums">
                        {m.count}
                      </span>
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t ${
                          m.count > 0 ? 'bg-[#00a884]' : 'bg-[#e9edef]'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-12 gap-1.5 pt-1 text-center">
                {monthlyChartData.map((m) => (
                  <span key={m.code} className="text-[10px] text-[#667781]">
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#d1d7db] rounded-xl p-4">
              <h3 className="text-xs font-bold text-[#111b21] mb-3">
                Distribusi Pengajuan Berdasarkan Bidang
              </h3>
              {bidangChartData.length === 0 ? (
                <p className="text-xs text-[#667781] py-8 text-center">
                  Belum ada data permohonan pada periode ini.
                </p>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {bidangChartData.map((item) => {
                    const max = Math.max(1, ...bidangChartData.map((b) => b.count));
                    const pct = Math.round((item.count / max) * 100);
                    return (
                      <div key={item.name}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[#111b21] font-medium truncate">{item.name}</span>
                          <span className="font-mono font-bold text-[#008069] tabular-nums">
                            {item.count}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#f0f2f5] rounded overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full bg-[#00a884] rounded"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#d1d7db] rounded-xl p-4">
              <h3 className="text-xs font-bold text-[#111b21] mb-3">
                Rekapitulasi Jenis Permohonan Izin / Cuti
              </h3>
              <div className="divide-y divide-[#e9edef] text-xs">
                {jenisRecapData.map((item) => (
                  <div key={item.jenis} className="py-2.5 flex items-center justify-between">
                    <span className="font-medium text-[#111b21]">{item.jenis}</span>
                    <span className="font-mono font-bold text-[#008069] tabular-nums">
                      {item.count} Permohonan
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* PERCAKAPAN / GELEMBUNG CHAT RIWAYAT PERMOHONAN IZIN & CUTI ALA WHATSAPP */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#54656f]">
            {currentUser.role === 'PEGAWAI' || dashboardScope === 'MINE'
              ? `Gelembung Chat Riwayat Pengajuan Saya (${currentUser.namaPengguna})`
              : 'Percakapan Permohonan Izin & Cuti Seluruh Pegawai'}
          </h3>
          <div className="flex items-center gap-2">
            {currentUser.role !== 'PEGAWAI' && (
              <div className="inline-flex rounded-lg bg-white border border-[#d1d7db] p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setDashboardScope('MINE')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    dashboardScope === 'MINE'
                      ? 'bg-[#008069] text-white'
                      : 'text-[#54656f] hover:bg-[#f0f2f5]'
                  }`}
                >
                  Riwayat Saya ({myOwnRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardScope('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    dashboardScope === 'ALL'
                      ? 'bg-[#008069] text-white'
                      : 'text-[#54656f] hover:bg-[#f0f2f5]'
                  }`}
                >
                  Semua Pegawai ({allRoleRequests.length})
                </button>
              </div>
            )}
            <span className="text-xs text-[#54656f] font-mono tabular-nums">
              {filteredRequests.length} Pesan Permohonan
            </span>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="bg-white border border-[#d1d7db] rounded-xl p-8 text-center space-y-2 shadow-2xs">
            <p className="text-sm font-bold text-[#111b21]">
              Belum ada riwayat permohonan izin atau cuti pada akun Anda.
            </p>
            <p className="text-xs text-[#667781]">
              Klik tombol hijau <strong>Kirim Permohonan Baru</strong> untuk mengirim pengajuan izin atau cuti seperti mengirim pesan WhatsApp.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const isMine = isRequestOwnedByUser(req, currentUser, store);
              const isApproved =
                req.statusPermohonan === 'DISETUJUI' || req.statusPermohonan === 'DIARSIPKAN';
              const isRejected =
                req.statusPermohonan === 'DITOLAK ATASAN' ||
                req.statusPermohonan === 'DITOLAK MUDIR';

              return (
                <div
                  key={req.idPermohonan}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`w-full max-w-3xl rounded-xl p-4 border shadow-xs space-y-2.5 ${
                      isMine
                        ? 'bg-[#d9fdd3] border-[#b7f0ad] rounded-tr-none'
                        : 'bg-white border-[#d1d7db] rounded-tl-none'
                    }`}
                  >
                    {/* Header Nama Pengirim di dalam Gelembung Chat WhatsApp */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                      <div>
                        <span className="text-xs font-bold text-[#008069]">
                          {req.namaPegawai}
                        </span>
                        <span className="text-[11px] text-[#54656f] ml-1.5">
                          · NIP/NIY: <strong className="font-mono">{req.nip}</strong> · {req.jabatan} ({req.unit})
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-[#111b21] bg-black/5 px-2 py-0.5 rounded">
                        {req.nomorPermohonan}
                      </span>
                    </div>

                    {/* Isi Pesan Permohonan */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#111b21]">
                      <div>
                        <span className="text-[#667781] block text-[11px]">Jenis & Kategori Keperluan:</span>
                        <strong>{req.jenisPermohonan}</strong> — {req.kategoriKeperluan}
                      </div>
                      <div>
                        <span className="text-[#667781] block text-[11px]">Tanggal & Durasi Izin/Cuti:</span>
                        <span className="font-mono font-semibold">
                          {req.tanggalMulai} s/d {req.tanggalSelesai} ({req.jumlahHari})
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-[#111b21] bg-white/60 rounded-lg p-2.5 border border-black/5">
                      <span className="text-[11px] text-[#667781] block">Alasan / Keterangan:</span>
                      <p className="mt-0.5">{req.alasan}</p>
                    </div>

                    {/* Bar Status & Tanda Centang Dua (✓✓) khas WhatsApp */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2 text-xs">
                        {isApproved ? (
                          <CheckCheck className="w-4 h-4 text-[#53bdeb] shrink-0" />
                        ) : isRejected ? (
                          <Clock className="w-4 h-4 text-red-600 shrink-0" />
                        ) : (
                          <CheckCheck className="w-4 h-4 text-[#667781] shrink-0" />
                        )}
                        <div>
                          <span
                            className={`font-bold ${
                              isApproved
                                ? 'text-[#008069]'
                                : isRejected
                                ? 'text-red-700'
                                : 'text-[#111b21]'
                            }`}
                          >
                            {req.statusPermohonan}
                          </span>
                          <span className="text-[11px] text-[#667781] ml-2">
                            (Atasan: {req.statusAtasan} · Mudir: {req.statusMudir})
                          </span>
                        </div>
                      </div>

                      {/* Tombol Aksi Gelembung Chat */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {req.statusPermohonan !== 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => setShareMessageRequest(req)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#25D366] hover:bg-[#00a884] rounded-full shadow-2xs transition-colors"
                          >
                            <MessageSquareShare className="w-3.5 h-3.5" />
                            Kirim WA ke Atasan/Mudir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onPreviewOfficialPdf(req)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#111b21] bg-white border border-[#d1d7db] hover:bg-[#f0f2f5] rounded-full"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Formulir
                        </button>
                        {isApproved && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                generateOfficialLeavePDF(
                                  req,
                                  store.MASTER_PEGAWAI.find((e) => e.idPegawai === req.idPegawai),
                                  'download'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#008069] bg-white border border-[#00a884] hover:bg-[#f0f2f5] rounded-full"
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF (A4)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                generateOfficialLeaveWord(
                                  req,
                                  store.MASTER_PEGAWAI.find((e) => e.idPegawai === req.idPegawai)
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-400 hover:bg-blue-50 rounded-full"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Word (A4)
                            </button>
                          </>
                        )}
                        {isMine &&
                          (req.statusPermohonan === 'DRAFT' ||
                            req.statusPermohonan === 'PERLU REVISI ATASAN' ||
                            req.statusPermohonan === 'PERLU REVISI MUDIR') && (
                            <button
                              type="button"
                              onClick={() => onEditRevisionRequest(req)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-full"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Revisi
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
