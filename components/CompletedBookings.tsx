
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Reviewer, OfficeRecord, CIRCLE_NAMES, CircleType, BookingSource, LoggedInUser } from '../types';
import { formatCurrency } from '../lib/formatCurrency';
import ContextMenuModal, { ContextMenuItem } from './ContextMenuModal';

interface CompletedBookingsProps {
  reviewers: Reviewer[];
  officeRecords: OfficeRecord[];
  bookingSources: BookingSource[];
  onGoBack: () => void;
  onUnbook: (type: 'reviewer' | 'office', id: string) => Promise<void>;
  onDelete: (type: 'reviewer' | 'office', id: string) => Promise<void>;
  onArchive: (type: 'reviewer' | 'office', id: string) => Promise<void>;
  loggedInUser: LoggedInUser | null;
}

type TabType = 'REVIEWERS' | 'OFFICES';

export default function CompletedBookings({ reviewers, officeRecords, bookingSources, onGoBack, onUnbook, onDelete, onArchive, loggedInUser }: CompletedBookingsProps) {
  const isAdmin = loggedInUser?.role === 'ADMIN';
  const isOffice = loggedInUser?.role === 'OFFICE';
  
  const [activeTab, setActiveTab] = useState<TabType>(isOffice ? 'OFFICES' : 'REVIEWERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [circleFilter, setCircleFilter] = useState<string>('ALL');
  const [officeFilter, setOfficeFilter] = useState<string>(isOffice ? loggedInUser.username : 'ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [creationDateFilter, setCreationDateFilter] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [isContextMenuModalOpen, setIsContextMenuModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<{ id: string, name: string, type: 'reviewer' | 'office' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string, type: 'reviewer' | 'office' } | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null); // Ref for scrolling

  // Auto-scroll effect
  useEffect(() => {
    if (searchQuery && tableContainerRef.current) {
        tableContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchQuery]);

  const bookingSourcesMap = useMemo(() => new Map(bookingSources.map(source => [source.id, source])), [bookingSources]);
  const uniqueOffices = useMemo(() => Array.from(new Set(officeRecords.map(r => r.affiliation))).sort(), [officeRecords]);

  const getSourceName = useCallback((sourceId: string | null | undefined) => {
    if (!sourceId) return 'حجز يدوي';
    return bookingSourcesMap.get(sourceId)?.sourceName || 'مصدر غير معروف';
  }, [bookingSourcesMap]);

  const downloadImage = (base64: string, name: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `حجز_${name}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = useMemo(() => {
    const isReviewers = activeTab === 'REVIEWERS';
    const baseData = isReviewers ? reviewers : officeRecords;
    
    let result = baseData.filter(r => (r.isBooked || !!r.bookingImage) && !r.isArchived);

    if (isOffice) {
      if (isReviewers) return []; 
      result = (result as OfficeRecord[]).filter(r => r.affiliation === loggedInUser.username);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      // البحث فقط بالاسم الكامل (تم إزالة البحث باللقب)
      result = result.filter(r => r.headFullName.toLowerCase().includes(query));
    }

    if (circleFilter !== 'ALL') result = result.filter(r => r.circleType === circleFilter);
    if (!isReviewers && officeFilter !== 'ALL') result = (result as OfficeRecord[]).filter(r => r.affiliation === officeFilter);
    if (dateFilter) result = result.filter(r => r.bookingDate === dateFilter);
    
    if (creationDateFilter) {
      result = result.filter(r => {
        if (!r.bookingCreatedAt) return false;
        const d = new Date(r.bookingCreatedAt).toLocaleDateString('en-CA');
        return d === creationDateFilter;
      });
    }

    return result;
  }, [activeTab, reviewers, officeRecords, searchQuery, circleFilter, officeFilter, dateFilter, creationDateFilter, loggedInUser, isOffice]);

  const handleRowClick = (record: Reviewer | OfficeRecord) => {
    setSelectedRecord({ id: record.id, name: record.headFullName, type: activeTab === 'REVIEWERS' ? 'reviewer' : 'office' });
    setIsContextMenuModalOpen(true);
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!selectedRecord) return [];
    const record = (activeTab === 'REVIEWERS' ? reviewers : officeRecords).find(r => r.id === selectedRecord.id);
    const items: ContextMenuItem[] = [];

    if (isAdmin) {
      items.push(
        { label: 'أرشفة الحجز (نقل للأرشيف)', onClick: () => onArchive(selectedRecord.type, selectedRecord.id) },
        { label: 'إلغاء حالة الحجز (إرجاع للسجل الرئيسي)', onClick: () => onUnbook(selectedRecord.type, selectedRecord.id) }
      );
    }

    if (record?.bookingImage) {
      items.push({ label: 'تنزيل صورة الحجز', onClick: () => downloadImage(record.bookingImage!, record.headFullName) });
    }

    if (isAdmin) {
      items.push({ isSeparator: true }, { label: 'حذف الحجز بشكل كامل من النظام', onClick: () => setDeleteConfirm(selectedRecord), isDestructive: true });
    }

    if (isOffice && !record?.bookingImage) {
      items.push({ label: 'لا توجد خيارات متاحة لهذا السجل', onClick: () => {}, disabled: true });
    }
    return items;
  };

  return (
    <div className="max-w-full mx-auto space-y-4 animate-scale-up pb-40">
      {previewImage && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-[80vh] rounded-3xl border-4 border-white shadow-2xl animate-scale-up" alt="Preview" />
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up">
            <h3 className="text-2xl font-black mb-3 text-red-600">تأكيد الحذف النهائي</h3>
            <p className="text-slate-500 mb-8 font-bold text-sm leading-relaxed">حذف حجز <span className="text-red-600">"{deleteConfirm.name}"</span>؟ سيتم مسح البيانات نهائياً.</p>
            <div className="flex flex-col gap-3">
              <button onClick={async () => { await onDelete(deleteConfirm.type, deleteConfirm.id); setDeleteConfirm(null); }} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black shadow-xl">نعم، احذف نهائياً</button>
              <button onClick={() => setDeleteConfirm(null)} className="w-full text-slate-400 font-black py-2">تراجع</button>
            </div>
          </div>
        </div>
      )}

      <ContextMenuModal isOpen={isContextMenuModalOpen} onClose={() => setIsContextMenuModalOpen(false)} menuItems={getContextMenuItems()} title={selectedRecord ? `خيارات الحجز: <strong>${selectedRecord.name}</strong>` : ''} />

      <div className="bg-white p-4 md:p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 z-10 p-4"><button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg></button></div>
        
        <div className="relative pt-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4">الحجوزات المكتملة</h2>
            <div className="flex p-1.5 bg-slate-100 rounded-2xl border-2 border-slate-200">
              {isAdmin && (
                <button onClick={() => setActiveTab('REVIEWERS')} className={`px-6 py-3 rounded-xl font-black text-[13px] ${activeTab === 'REVIEWERS' ? 'bg-white text-blue-700 shadow-md border-b-4 border-blue-700' : 'text-slate-500'}`}>سجل محمود قبلان ({reviewers.filter(r => r.isBooked && !r.isArchived).length})</button>
              )}
              <button onClick={() => setActiveTab('OFFICES')} className={`px-6 py-3 rounded-xl font-black text-[13px] ${activeTab === 'OFFICES' ? 'bg-white text-indigo-700 shadow-md border-b-4 border-indigo-700' : 'text-slate-500'}`}>المكاتب والوكلاء ({officeRecords.filter(r => (r.isBooked || !!r.bookingImage) && !r.isArchived && (isAdmin || r.affiliation === loggedInUser?.username)).length})</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 mb-6 shadow-inner">
            <input type="text" placeholder="بحث بالاسم الكامل..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl font-bold text-xs" />
            <select value={circleFilter} onChange={e => setCircleFilter(e.target.value)} className="h-11 px-4 bg-white border border-slate-200 rounded-xl font-black text-xs">
              <option value="ALL">جميع الدوائر</option>
              {Object.values(CircleType).map(t => <option key={t} value={t}>{CIRCLE_NAMES[t]}</option>)}
            </select>
            {activeTab === 'OFFICES' && isAdmin && (
              <select value={officeFilter} onChange={e => setOfficeFilter(e.target.value)} className="h-11 px-4 bg-white border border-slate-200 rounded-xl font-black text-xs">
                <option value="ALL">جميع المكاتب</option>
                {uniqueOffices.map(off => <option key={off} value={off}>{off}</option>)}
              </select>
            )}
            <div className="flex flex-col"><label className="text-[9px] font-black mr-2 text-slate-400">تاريخ الحجز</label><input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="h-11 px-4 bg-white border border-slate-200 rounded-xl font-black text-xs" /></div>
            <div className="flex flex-col"><label className="text-[9px] font-black mr-2 text-slate-400">تاريخ الإنشاء</label><input type="date" value={creationDateFilter} onChange={e => setCreationDateFilter(e.target.value)} className="h-11 px-4 bg-white border border-slate-200 rounded-xl font-black text-xs" /></div>
            <button onClick={() => { setSearchQuery(''); setCircleFilter('ALL'); setOfficeFilter(isOffice ? loggedInUser.username : 'ALL'); setDateFilter(''); setCreationDateFilter(''); }} className="h-11 bg-slate-200 text-slate-600 rounded-xl font-black text-xs self-end">إعادة تعيين</button>
          </div>

          <div ref={tableContainerRef} className="table-container w-full overflow-x-auto rounded-3xl border-2 border-slate-900 shadow-xl custom-scrollbar">
            <table className="min-w-[1200px] w-full text-right border-collapse responsive-table">
              <thead>
                <tr>
                  <th className="w-12">ت</th>
                  {activeTab === 'OFFICES' && <th className="w-32">المكتب</th>}
                  <th className="w-24">الدائرة</th>
                  <th className="text-right px-4">الاسم الكامل</th>
                  <th className="w-24">الهاتف</th>
                  <th className="w-32">تاريخ الحجز</th>
                  <th className="w-32">تاريخ الإنشاء</th>
                  {isAdmin && <th className="w-32 text-center">المصدر</th>}
                  <th className="w-32 text-center">السعر</th>
                  <th className="w-24 text-center">صورة الحجز</th>
                </tr>
              </thead>
              <tbody className="text-[12px] font-bold">
                {filteredData.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 11 : 10} className="py-20 text-center text-slate-300 font-black text-xl italic bg-slate-50">لا توجد سجلات مطابقة.</td></tr>
                ) : (
                  filteredData.map((r, idx) => {
                    const sourceName = getSourceName(r.bookedSourceId);
                    
                    // استخدام السعر التاريخي المثبت في السجل لضمان دقة الرصيد حتى لو تغيرت أسعار المكتب
                    let priceDisplay = 0;
                    if (r.circleType === CircleType.RIGHT_MOSUL) priceDisplay = r.bookedPriceRightMosul || 0;
                    else if (r.circleType === CircleType.LEFT_MOSUL) priceDisplay = r.bookedPriceLeftMosul || 0;
                    else if (r.circleType === CircleType.HAMMAM_ALALIL) priceDisplay = r.bookedPriceHammamAlAlil || 0;
                    else if (r.circleType === CircleType.ALSHOURA) priceDisplay = r.bookedPriceAlShoura || 0;
                    else if (r.circleType === CircleType.BAAJ) priceDisplay = r.bookedPriceBaaj || 0;
                    else priceDisplay = r.bookedPriceOthers || 0;

                    return (
                      <tr key={r.id} onClick={() => handleRowClick(r)} className="bg-white border-b border-slate-200 hover:bg-green-50/50 cursor-pointer transition-colors">
                        <td className="font-black text-slate-400">{idx + 1}</td>
                        {activeTab === 'OFFICES' && <td className="font-black text-indigo-700 text-center">{(r as OfficeRecord).affiliation}</td>}
                        <td className="text-center font-black">{CIRCLE_NAMES[r.circleType]}</td>
                        <td className="text-right font-black px-4 text-sm whitespace-nowrap text-slate-950">{r.headFullName}</td>
                        <td className="text-right font-black text-[11px] text-blue-800" dir="ltr">{r.headPhone || '—'}</td>
                        <td className="text-center text-blue-700">{r.bookingDate || '—'}</td>
                        <td className="text-center text-slate-400 text-[10px]">{r.bookingCreatedAt ? new Date(r.bookingCreatedAt).toLocaleString('en-GB') : '—'}</td>
                        {isAdmin && (
                          <td className="text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${r.bookedSourceId ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                              {sourceName}
                            </span>
                          </td>
                        )}
                        <td className="text-center font-black text-emerald-700">{formatCurrency(priceDisplay)}</td>
                        <td className="text-center">
                          {r.bookingImage ? (
                            <div className="flex justify-center gap-1">
                              <button onClick={(e) => { e.stopPropagation(); setPreviewImage(r.bookingImage!); }} className="w-10 h-10 rounded-lg overflow-hidden border-2 border-green-600 shadow-sm"><img src={r.bookingImage} className="w-full h-full object-cover" /></button>
                              <button onClick={(e) => { e.stopPropagation(); downloadImage(r.bookingImage!, r.headFullName); }} className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg></button>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[10px]">بدون صورة</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
