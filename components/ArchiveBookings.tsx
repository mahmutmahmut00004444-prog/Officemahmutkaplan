
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Reviewer, OfficeRecord, CIRCLE_NAMES, CircleType, BookingSource, LoggedInUser } from '../types';
import { formatCurrency } from '../lib/formatCurrency';
import ContextMenuModal, { ContextMenuItem } from './ContextMenuModal';

interface ArchiveBookingsProps {
  reviewers: Reviewer[];
  officeRecords: OfficeRecord[];
  bookingSources: BookingSource[];
  onGoBack: () => void;
  onUnarchive: (type: 'reviewer' | 'office', id: string) => Promise<void>;
  onDelete: (type: 'reviewer' | 'office', id: string) => Promise<void>;
  loggedInUser: LoggedInUser | null;
  formatCurrency?: (amount: number | string | undefined) => string;
}

export default function ArchiveBookings({ reviewers, officeRecords, bookingSources, onGoBack, onUnarchive, onDelete, loggedInUser, formatCurrency = (v) => `${v}` }: ArchiveBookingsProps) {
  const isAdmin = loggedInUser?.role === 'ADMIN';
  const isOffice = loggedInUser?.role === 'OFFICE';
  
  const [activeTab, setActiveTab] = useState<'REVIEWERS' | 'OFFICES'>(isOffice ? 'OFFICES' : 'REVIEWERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [creationDateFilter, setCreationDateFilter] = useState('');
  
  // New Filters
  const [circleFilter, setCircleFilter] = useState<string>('ALL');
  const [officeFilter, setOfficeFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // State for the Detailed Modal
  const [viewingRecord, setViewingRecord] = useState<Reviewer | OfficeRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null); // Ref for scrolling

  // Auto-scroll effect
  useEffect(() => {
    if (searchQuery && tableContainerRef.current) {
        tableContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchQuery]);

  const bookingSourcesMap = useMemo(() => new Map(bookingSources.map(s => [s.id, s.sourceName])), [bookingSources]);

  // استخراج المكاتب الفريدة من السجلات
  const uniqueOffices = useMemo(() => {
    const offices = new Set(officeRecords.map(r => r.affiliation));
    return Array.from(offices).sort();
  }, [officeRecords]);

  const filteredData = useMemo(() => {
    const baseData = activeTab === 'REVIEWERS' ? reviewers : officeRecords;
    let result = baseData.filter(r => r.isArchived);

    if (isOffice) {
      if (activeTab === 'REVIEWERS') return [];
      result = (result as OfficeRecord[]).filter(r => r.affiliation === loggedInUser.username);
    }

    // 1. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.headFullName.toLowerCase().includes(q));
    }

    // 2. Circle Filter
    if (circleFilter !== 'ALL') {
      result = result.filter(r => r.circleType === circleFilter);
    }

    // 3. Office Filter (Only applicable for Office Records Tab)
    if (activeTab === 'OFFICES' && officeFilter !== 'ALL' && isAdmin) {
      result = (result as OfficeRecord[]).filter(r => r.affiliation === officeFilter);
    }

    // 4. Source Filter
    if (sourceFilter !== 'ALL') {
      if (sourceFilter === 'MANUAL') {
        result = result.filter(r => !r.bookedSourceId);
      } else {
        result = result.filter(r => r.bookedSourceId === sourceFilter);
      }
    }

    // 5. Date Filters
    if (dateFilter) result = result.filter(r => r.bookingDate === dateFilter);
    if (creationDateFilter) {
      result = result.filter(r => r.bookingCreatedAt && new Date(r.bookingCreatedAt).toLocaleDateString('en-CA') === creationDateFilter);
    }
    return result;
  }, [activeTab, reviewers, officeRecords, searchQuery, circleFilter, officeFilter, sourceFilter, dateFilter, creationDateFilter, isOffice, loggedInUser, isAdmin]);

  const handleRowClick = (record: Reviewer | OfficeRecord) => {
    setViewingRecord(record);
    setShowDeleteConfirm(false);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setDateFilter('');
    setCreationDateFilter('');
    setCircleFilter('ALL');
    setOfficeFilter('ALL');
    setSourceFilter('ALL');
  };

  const handleRestore = async () => {
    if (!viewingRecord) return;
    const type = 'affiliation' in viewingRecord ? 'office' : 'reviewer';
    await onUnarchive(type, viewingRecord.id);
    setViewingRecord(null);
  };

  const handleDeleteFinal = async () => {
    if (!viewingRecord) return;
    const type = 'affiliation' in viewingRecord ? 'office' : 'reviewer';
    await onDelete(type, viewingRecord.id);
    setViewingRecord(null);
    setShowDeleteConfirm(false);
  };

  const getRecordPrice = (r: Reviewer | OfficeRecord) => {
    if (r.circleType === CircleType.RIGHT_MOSUL) return r.bookedPriceRightMosul || 0;
    else if (r.circleType === CircleType.LEFT_MOSUL) return r.bookedPriceLeftMosul || 0;
    else if (r.circleType === CircleType.HAMMAM_ALALIL) return r.bookedPriceHammamAlAlil || 0;
    else if (r.circleType === CircleType.ALSHOURA) return r.bookedPriceAlShoura || 0;
    else if (r.circleType === CircleType.BAAJ) return r.bookedPriceBaaj || 0;
    else return r.bookedPriceOthers || 0;
  };

  return (
    <div className="max-w-full mx-auto space-y-6 pb-40 animate-scale-up">
      {previewImage && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-[80vh] rounded-3xl border-2 border-white shadow-2xl" />
        </div>
      )}

      {/* نافذة التفاصيل (Detailed Modal) */}
      {viewingRecord && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up" onClick={() => setViewingRecord(null)}>
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] flex flex-col border-2 border-slate-900 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {showDeleteConfirm ? (
               <div className="absolute inset-0 bg-white z-50 flex flex-col items-center justify-center p-8 text-center animate-scale-up">
                  <h3 className="text-2xl font-black text-red-600 mb-4">هل أنت متأكد؟</h3>
                  <p className="text-slate-500 font-bold mb-8">سيتم حذف هذا السجل نهائياً من الأرشيف ولا يمكن التراجع.</p>
                  <div className="flex gap-3 w-full">
                    <button onClick={handleDeleteFinal} className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">حذف نهائي</button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black text-lg active:scale-95 transition-all">تراجع</button>
                  </div>
               </div>
            ) : null}

            <div className="absolute top-0 right-0 z-10 p-4">
              <button onClick={() => setViewingRecord(null)} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            </div>

            <div className="pt-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-black text-slate-900">{viewingRecord.headFullName}</h3>
                <p className="text-sm font-bold text-slate-400 mt-1">
                  {'affiliation' in viewingRecord ? `مكتب: ${viewingRecord.affiliation}` : 'سجل محمود قبلان'}
                </p>
                <div className="flex justify-center gap-2 mt-3">
                   <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-black border border-blue-100">{CIRCLE_NAMES[viewingRecord.circleType]}</span>
                   <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-black border border-emerald-100">{formatCurrency(getRecordPrice(viewingRecord))}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 mb-1">اسم الأم</p>
                    <p className="text-sm font-black text-slate-800">{viewingRecord.headMotherName}</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 mb-1">تاريخ التولد</p>
                    <p className="text-sm font-black text-slate-800" dir="ltr">{viewingRecord.headDob}</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 mb-1">رقم الهاتف</p>
                    <p className="text-sm font-black text-blue-600" dir="ltr">{viewingRecord.headPhone || '—'}</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 mb-1">مصدر الحجز</p>
                    <p className="text-sm font-black text-slate-800">{viewingRecord.bookedSourceId ? bookingSourcesMap.get(viewingRecord.bookedSourceId) : 'يدوي'}</p>
                 </div>
              </div>

              {viewingRecord.familyMembers && viewingRecord.familyMembers.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-black text-slate-800 text-sm mb-3 border-b border-slate-100 pb-2">أفراد الأسرة ({viewingRecord.familyMembers.length})</h4>
                  <div className="space-y-2">
                    {viewingRecord.familyMembers.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                         <div>
                            <p className="text-xs font-black text-slate-800">{m.fullName}</p>
                            <p className="text-[10px] font-bold text-slate-400">{m.relationship}</p>
                         </div>
                         <div className="text-left">
                            <p className="text-[10px] font-bold text-slate-500" dir="ltr">{m.dob}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingRecord.bookingImage && (
                <div className="mb-6">
                   <h4 className="font-black text-slate-800 text-sm mb-3">صورة الحجز</h4>
                   <div className="h-40 w-full rounded-2xl overflow-hidden border-2 border-slate-200 relative cursor-pointer group" onClick={() => setPreviewImage(viewingRecord.bookingImage!)}>
                      <img src={viewingRecord.bookingImage} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-white font-black text-xs">تكبير الصورة</span>
                      </div>
                   </div>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                 <p className="text-[10px] font-black text-slate-400 mb-1">الملاحظات</p>
                 <p className="text-xs font-bold text-slate-600 leading-relaxed">{viewingRecord.notes || 'لا توجد ملاحظات'}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex gap-3">
               {!isOffice && (
                 <button onClick={handleRestore} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all">إلغاء الأرشفة (استرجاع)</button>
               )}
               {!isOffice && (
                 <button onClick={() => setShowDeleteConfirm(true)} className="flex-1 bg-red-50 text-red-600 border border-red-100 py-3 rounded-xl font-black text-sm active:scale-95 transition-all hover:bg-red-100">حذف نهائي</button>
               )}
               {isOffice && (
                 <button onClick={() => setViewingRecord(null)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black text-sm active:scale-95 transition-all">إغلاق</button>
               )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 md:p-8 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative">
        <div className="absolute top-0 right-0 p-4"><button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg></button></div>
        
        <div className="pt-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <h2 className="text-3xl font-black text-slate-900">أرشيف الحجوزات المكتملة</h2>
            <div className="flex p-1 bg-slate-100 rounded-2xl">
              {isAdmin && (
                <button onClick={() => { setActiveTab('REVIEWERS'); handleResetFilters(); }} className={`px-6 py-2.5 rounded-xl font-black text-xs ${activeTab === 'REVIEWERS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>أرشيف محمود قبلان</button>
              )}
              <button onClick={() => { setActiveTab('OFFICES'); handleResetFilters(); }} className={`px-6 py-2.5 rounded-xl font-black text-xs ${activeTab === 'OFFICES' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>أرشيف المكاتب</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-2 mb-8 bg-slate-50 p-4 rounded-3xl border border-slate-200">
            <input type="text" placeholder="بحث بالاسم..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 font-bold text-xs" />
            
            {/* فلتر الدائرة */}
            <select value={circleFilter} onChange={e => setCircleFilter(e.target.value)} className="h-11 px-2 rounded-xl border border-slate-200 font-bold text-xs bg-white">
              <option value="ALL">جميع الدوائر</option>
              {Object.values(CircleType).map(t => <option key={t} value={t}>{CIRCLE_NAMES[t]}</option>)}
            </select>

            {/* فلتر المكتب - يظهر فقط في تبويب المكاتب وللمدير */}
            {activeTab === 'OFFICES' && isAdmin ? (
              <select value={officeFilter} onChange={e => setOfficeFilter(e.target.value)} className="h-11 px-2 rounded-xl border border-slate-200 font-bold text-xs bg-white">
                <option value="ALL">جميع المكاتب</option>
                {uniqueOffices.map(office => <option key={office} value={office}>{office}</option>)}
              </select>
            ) : <div className="hidden lg:block"></div>}

            {/* فلتر المصدر */}
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="h-11 px-2 rounded-xl border border-slate-200 font-bold text-xs bg-white">
              <option value="ALL">جميع المصادر</option>
              <option value="MANUAL">يدوي (بدون مصدر)</option>
              {bookingSources.map(s => <option key={s.id} value={s.id}>{s.sourceName}</option>)}
            </select>

            <div className="flex flex-col justify-center"><input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="h-11 px-2 rounded-xl border border-slate-200 font-bold text-xs" title="تاريخ الحجز" /></div>
            <div className="flex flex-col justify-center"><input type="date" value={creationDateFilter} onChange={e => setCreationDateFilter(e.target.value)} className="h-11 px-2 rounded-xl border border-slate-200 font-bold text-xs" title="تاريخ الإنشاء" /></div>
            
            <button onClick={handleResetFilters} className="h-11 bg-slate-200 text-slate-600 rounded-xl font-black text-xs hover:bg-slate-300 transition-colors">إعادة تعيين</button>
          </div>

          <div ref={tableContainerRef} className="table-container w-full overflow-x-auto rounded-3xl border border-slate-200 custom-scrollbar">
            <table className="min-w-[1300px] w-full text-right">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-4 py-4 text-xs font-black w-12 text-center">ت</th>
                  <th className="px-4 py-4 text-xs font-black">الاسم الكامل</th>
                  <th className="px-4 py-4 text-xs font-black w-32">المكتب / الجهة</th>
                  <th className="px-4 py-4 text-xs font-black w-24">الهاتف</th>
                  <th className="px-4 py-4 text-xs font-black w-24 text-center">عدد الأفراد</th>
                  <th className="px-4 py-4 text-xs font-black w-32">الدائرة</th>
                  <th className="px-4 py-4 text-xs font-black w-32 text-center">تاريخ الحجز</th>
                  <th className="px-4 py-4 text-xs font-black w-32 text-center">السعر المثبت</th>
                  <th className="px-4 py-4 text-xs font-black w-32 text-center">المصدر</th>
                  <th className="px-4 py-4 text-xs font-black w-32">ملاحظات</th>
                  <th className="px-4 py-4 text-xs font-black w-32 text-center">تاريخ الإنشاء</th>
                  <th className="px-4 py-4 text-xs font-black w-24 text-center">صورة</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold">
                {filteredData.length === 0 ? (
                  <tr><td colSpan={12} className="py-20 text-center text-slate-300 font-black italic text-xl">الأرشيف فارغ.</td></tr>
                ) : (
                  filteredData.map((r, i) => {
                    const officeName = 'affiliation' in r ? r.affiliation : 'محمود قبلان';
                    const familyCount = 1 + (r.familyMembers?.length || 0);
                    const priceDisplay = getRecordPrice(r);
                    const sourceName = r.bookedSourceId ? bookingSourcesMap.get(r.bookedSourceId) : 'يدوي';
                    const notes = 'notes' in r ? r.notes : '-';

                    return (
                      <tr key={r.id} onClick={() => handleRowClick(r)} className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                        <td className="px-4 py-4 text-slate-400 text-center">{i + 1}</td>
                        <td className="px-4 py-4 font-black text-slate-950">{r.headFullName}</td>
                        <td className="px-4 py-4 text-indigo-700">{officeName}</td>
                        <td className="px-4 py-4 font-bold text-blue-800" dir="ltr">{r.headPhone || '—'}</td>
                        <td className="px-4 py-4 text-center">{familyCount}</td>
                        <td className="px-4 py-4 text-blue-700">{CIRCLE_NAMES[r.circleType]}</td>
                        <td className="px-4 py-4 text-center">{r.bookingDate || '—'}</td>
                        <td className="px-4 py-4 text-center text-emerald-700">{formatCurrency(priceDisplay)}</td>
                        <td className="px-4 py-4 text-center text-slate-500">{sourceName}</td>
                        <td className="px-4 py-4 text-slate-400 truncate max-w-[150px]">{notes}</td>
                        <td className="px-4 py-4 text-center text-slate-400 text-[10px]">{r.bookingCreatedAt ? new Date(r.bookingCreatedAt).toLocaleString('en-GB') : '—'}</td>
                        <td className="px-4 py-4 text-center">
                          {r.bookingImage && <button onClick={(e) => { e.stopPropagation(); setPreviewImage(r.bookingImage!); }} className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 mx-auto"><img src={r.bookingImage} className="w-full h-full object-cover" /></button>}
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
