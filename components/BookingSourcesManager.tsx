
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { BookingSource, LoggedInUser, CIRCLE_NAMES, CircleType, Reviewer, OfficeRecord, SettlementTransaction, SourceStatementTab } from '../types';
import ContextMenuModal from './ContextMenuModal';
import { formatCurrency } from '../lib/formatCurrency';

interface BookingSourcesManagerProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  loggedInUser: LoggedInUser;
  fetchAllData: (silent?: boolean) => Promise<void>;
  onViewAccountStatement: (source: BookingSource, defaultTab: SourceStatementTab) => void;
  onOpenAddBookingToSourcePage: (source: BookingSource) => void;
  onOpenSettleSourcePage: (source: BookingSource, outstandingBalance: number) => void;
  allReviewers: Reviewer[];
  allOfficeRecords: OfficeRecord[];
  bookingSources: BookingSource[];
  settlementTransactions: SettlementTransaction[];
  onRemoveBookingFromSource: (recordId: string, sourceId: string | null, recordType: 'reviewer' | 'office') => Promise<void>;
  onGoBack: () => void;
}

export default function BookingSourcesManager({ showToast, loggedInUser, fetchAllData, onViewAccountStatement, onOpenAddBookingToSourcePage, onOpenSettleSourcePage, allReviewers, allOfficeRecords, bookingSources, settlementTransactions, onRemoveBookingFromSource, onGoBack }: BookingSourcesManagerProps) {
  const [sources, setSources] = useState<BookingSource[]>([]);
  
  // استخدام number | '' للسماح بحقل فارغ أثناء الكتابة
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourcePhone, setNewSourcePhone] = useState('');
  const [newPriceRightMosul, setNewPriceRightMosul] = useState<number | ''>('');
  const [newPriceLeftMosul, setNewPriceLeftMosul] = useState<number | ''>('');
  const [newPriceOthers, setNewPriceOthers] = useState<number | ''>('');
  const [newPriceHammamAlAlil, setNewPriceHammamAlAlil] = useState<number | ''>('');
  const [newPriceAlShoura, setNewPriceAlShoura] = useState<number | ''>('');
  const [newPriceBaaj, setNewPriceBaaj] = useState<number | ''>('');
  
  const [loading, setLoading] = useState(false);
  const [submittingNewSource, setSubmittingNewSource] = useState(false);

  const [editingSource, setEditingSource] = useState<BookingSource | null>(null);
  const [editSourceName, setEditSourceName] = useState('');
  const [editSourcePhone, setEditSourcePhone] = useState('');
  const [editPriceRightMosul, setEditPriceRightMosul] = useState<number | ''>('');
  const [editPriceLeftMosul, setEditPriceLeftMosul] = useState<number | ''>('');
  const [editPriceOthers, setEditPriceOthers] = useState<number | ''>('');
  const [editPriceHammamAlAlil, setEditPriceHammamAlAlil] = useState<number | ''>('');
  const [editPriceAlShoura, setEditPriceAlShoura] = useState<number | ''>('');
  const [editPriceBaaj, setEditPriceBaaj] = useState<number | ''>('');

  const [deleteSourceConfirm, setDeleteSourceConfirm] = useState<BookingSource | null>(null);
  const [isContextMenuModalOpen, setIsContextMenuModalOpen] = useState(false);
  const [currentContextMenuSource, setCurrentContextMenuSource] = useState<BookingSource | null>(null);
  const [showNewSourceForm, setShowNewSourceForm] = useState(false);
  const newSourceNameRef = useRef<HTMLInputElement>(null);

  const isAdmin = loggedInUser?.role === 'ADMIN';

  useEffect(() => { setSources(bookingSources); }, [bookingSources]);

  useEffect(() => { if (showNewSourceForm && newSourceNameRef.current) newSourceNameRef.current.focus(); }, [showNewSourceForm]);

  // دالة مساعدة لضبط الإدخال الرقمي
  const handlePriceInput = (value: string, setter: (val: number | '') => void) => {
    if (value === '') {
        setter('');
    } else {
        const num = parseFloat(value);
        if (!isNaN(num)) setter(num);
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newSourceName.trim()) { showToast('الرجاء إدخال اسم المصدر', 'error'); return; }
    setSubmittingNewSource(true);
    try {
      const newSource: BookingSource = {
        id: crypto.randomUUID(),
        sourceName: newSourceName.trim(),
        phoneNumber: newSourcePhone.trim(),
        priceRightMosul: Number(newPriceRightMosul) || 0,
        priceLeftMosul: Number(newPriceLeftMosul) || 0,
        priceOthers: Number(newPriceOthers) || 0,
        priceHammamAlAlil: Number(newPriceHammamAlAlil) || 0,
        priceAlShoura: Number(newPriceAlShoura) || 0,
        priceBaaj: Number(newPriceBaaj) || 0,
        createdBy: loggedInUser.username,
        createdAt: new Date().toISOString()
      };

      const storedSources = localStorage.getItem('booking_sources');
      const allSources = storedSources ? JSON.parse(storedSources) : [];
      localStorage.setItem('booking_sources', JSON.stringify([...allSources, newSource]));

      showToast('تم إنشاء المصدر بنجاح', 'success');
      setNewSourceName(''); setNewSourcePhone(''); 
      setNewPriceRightMosul(''); setNewPriceLeftMosul(''); setNewPriceOthers('');
      setNewPriceHammamAlAlil(''); setNewPriceAlShoura(''); setNewPriceBaaj(''); 
      setShowNewSourceForm(false);
      fetchAllData(true);
    } catch (error: any) { 
        showToast(`خطأ: ${error.message}`, 'error'); 
    } finally { setSubmittingNewSource(false); }
  };

  const handleEditSource = (source: BookingSource) => {
    setEditingSource(source);
    setEditSourceName(source.sourceName);
    setEditSourcePhone(source.phoneNumber);
    setEditPriceRightMosul(source.priceRightMosul || '');
    setEditPriceLeftMosul(source.priceLeftMosul || '');
    setEditPriceOthers(source.priceOthers || '');
    setEditPriceHammamAlAlil(source.priceHammamAlAlil || '');
    setEditPriceAlShoura(source.priceAlShoura || '');
    setEditPriceBaaj(source.priceBaaj || '');
    setIsContextMenuModalOpen(false);
  };

  const handleUpdateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingSource) return;
    setLoading(true);
    try {
      const storedSources = localStorage.getItem('booking_sources');
      if (storedSources) {
        const allSources = JSON.parse(storedSources).map((s: any) => 
          s.id === editingSource.id ? {
            ...s,
            sourceName: editSourceName.trim(),
            phoneNumber: editSourcePhone.trim(),
            priceRightMosul: Number(editPriceRightMosul) || 0,
            priceLeftMosul: Number(editPriceLeftMosul) || 0,
            priceOthers: Number(editPriceOthers) || 0,
            priceHammamAlAlil: Number(editPriceHammamAlAlil) || 0,
            priceAlShoura: Number(editPriceAlShoura) || 0,
            priceBaaj: Number(editPriceBaaj) || 0,
          } : s
        );
        localStorage.setItem('booking_sources', JSON.stringify(allSources));
      }

      showToast('تم التحديث بنجاح', 'success');
      setEditingSource(null);
      fetchAllData(true);
    } catch (error: any) { 
        showToast(`خطأ: ${error.message}`, 'error'); 
    } finally { setLoading(false); }
  };

  const handleDeleteSource = async () => {
    if (!isAdmin || !deleteSourceConfirm) return;
    setLoading(true);
    try {
      const id = deleteSourceConfirm.id;
      
      // Update reviewers
      const storedReviewers = localStorage.getItem('reviewers');
      if (storedReviewers) {
        const reviewers = JSON.parse(storedReviewers).map((r: any) => 
          (r.bookedSourceId === id || r.uploadedSourceId === id) ? { ...r, bookedSourceId: null, uploadedSourceId: null } : r
        );
        localStorage.setItem('reviewers', JSON.stringify(reviewers));
      }

      // Update office records
      const storedOfficeRecords = localStorage.getItem('office_records');
      if (storedOfficeRecords) {
        const records = JSON.parse(storedOfficeRecords).map((o: any) => 
          (o.bookedSourceId === id || o.uploadedSourceId === id) ? { ...o, bookedSourceId: null, uploadedSourceId: null } : o
        );
        localStorage.setItem('office_records', JSON.stringify(records));
      }

      // Delete source
      const storedSources = localStorage.getItem('booking_sources');
      if (storedSources) {
        const sources = JSON.parse(storedSources).filter((s: any) => s.id !== id);
        localStorage.setItem('booking_sources', JSON.stringify(sources));
      }

      showToast('تم الحذف بنجاح', 'success');
      setDeleteSourceConfirm(null);
      fetchAllData(true);
    } catch (error: any) { showToast(`خطأ: ${error.message}`, 'error'); } finally { setLoading(false); }
  };

  const calculateOutstandingBalance = useCallback((source: BookingSource) => {
    let totalRevenue = 0;
    const allBooked = [...allReviewers.filter(r => r.bookedSourceId === source.id), ...allOfficeRecords.filter(o => o.bookedSourceId === source.id)];
    allBooked.forEach((r: any) => {
      let price = source.priceOthers;
      if (r.circleType === CircleType.RIGHT_MOSUL) price = r.bookedPriceRightMosul || source.priceRightMosul;
      else if (r.circleType === CircleType.LEFT_MOSUL) price = r.bookedPriceLeftMosul || source.priceLeftMosul;
      else if (r.circleType === CircleType.HAMMAM_ALALIL) price = r.bookedPriceHammamAlAlil || source.priceHammamAlAlil;
      else if (r.circleType === CircleType.ALSHOURA) price = r.bookedPriceAlShoura || source.priceAlShoura;
      else if (r.circleType === CircleType.BAAJ) price = r.bookedPriceBaaj || source.priceBaaj;
      totalRevenue += price;
    });
    const totalSettled = settlementTransactions.filter(t => t.source_id === source.id).reduce((sum, t) => sum + t.amount, 0);
    return totalRevenue - totalSettled;
  }, [allReviewers, allOfficeRecords, settlementTransactions]);

  const handleContextMenuClick = (source: BookingSource) => {
    setCurrentContextMenuSource(source);
    setIsContextMenuModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-scale-up pb-40">
      {deleteSourceConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up">
            <h3 className="text-xl font-black mb-2 text-red-600">تأكيد الحذف</h3>
            <p className="text-slate-500 mb-6 font-bold text-sm">حذف المصدر "{deleteSourceConfirm.sourceName}"؟ سيتم إلغاء ارتباط كافة السجلات به مالياً.</p>
            <div className="flex gap-2">
              <button onClick={handleDeleteSource} disabled={loading} className="flex-1 bg-red-600 text-white py-4 rounded-xl font-black shadow-xl active:scale-95 transition-all">نعم، حذف</button>
              <button onClick={() => setDeleteSourceConfirm(null)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-xl font-black hover:bg-slate-200 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {editingSource && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar border-2 border-slate-900 shadow-2xl animate-scale-up">
            <h3 className="text-2xl font-black mb-6 text-center text-slate-900">تعديل بيانات المصدر</h3>
            <form onSubmit={handleUpdateSource} className="space-y-4">
              <input type="text" value={editSourceName} onChange={e => setEditSourceName(e.target.value)} placeholder="اسم المصدر" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-center outline-none focus:border-blue-500" />
              <input type="text" value={editSourcePhone} onChange={e => setEditSourcePhone(e.target.value)} placeholder="الهاتف" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-center outline-none focus:border-blue-500" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                 <div className="space-y-1"><label className="text-[10px] font-black mr-2">الأيمن</label><input type="number" value={editPriceRightMosul} onChange={e => handlePriceInput(e.target.value, setEditPriceRightMosul)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center outline-none focus:border-blue-500" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black mr-2">الأيسر</label><input type="number" value={editPriceLeftMosul} onChange={e => handlePriceInput(e.target.value, setEditPriceLeftMosul)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center outline-none focus:border-blue-500" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black mr-2">حمام العليل</label><input type="number" value={editPriceHammamAlAlil} onChange={e => handlePriceInput(e.target.value, setEditPriceHammamAlAlil)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center outline-none focus:border-blue-500" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black mr-2">الشورة</label><input type="number" value={editPriceAlShoura} onChange={e => handlePriceInput(e.target.value, setEditPriceAlShoura)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center outline-none focus:border-blue-500" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black mr-2">البعاج</label><input type="number" value={editPriceBaaj} onChange={e => handlePriceInput(e.target.value, setEditPriceBaaj)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center outline-none focus:border-blue-500" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black mr-2">أخرى</label><input type="number" value={editPriceOthers} onChange={e => handlePriceInput(e.target.value, setEditPriceOthers)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center outline-none focus:border-blue-500" /></div>
              </div>
              <div className="flex gap-2 pt-6">
                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg active:scale-95 transition-all">حفظ التغييرات</button>
                <button type="button" onClick={() => setEditingSource(null)} className="flex-1 bg-slate-100 py-4 rounded-xl font-black hover:bg-slate-200 transition-all">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ContextMenuModal isOpen={isContextMenuModalOpen} onClose={() => setIsContextMenuModalOpen(false)} menuItems={[
          { label: 'إضافة حجوزات لهذا المصدر (عبر الاستوديو)', onClick: () => onOpenAddBookingToSourcePage(currentContextMenuSource!) },
          { isSeparator: true },
          { label: 'كشف رصيد المصدر (المستحق له)', onClick: () => onViewAccountStatement(currentContextMenuSource!, 'summary') },
          { label: 'كشف الحجوزات المكتملة', onClick: () => onViewAccountStatement(currentContextMenuSource!, 'booked') },
          { label: 'سجل التسديدات المالية له', onClick: () => onViewAccountStatement(currentContextMenuSource!, 'settlements') },
          { isSeparator: true },
          { label: 'تسديد دفعة مالية للمصدر', onClick: () => onOpenSettleSourcePage(currentContextMenuSource!, calculateOutstandingBalance(currentContextMenuSource!)) },
          { isSeparator: true },
          { label: 'تعديل بيانات المصدر', onClick: () => handleEditSource(currentContextMenuSource!) },
          { label: 'حذف حساب المصدر', onClick: () => setDeleteSourceConfirm(currentContextMenuSource!), isDestructive: true },
      ]} title={currentContextMenuSource ? `خيارات المصدر: ${currentContextMenuSource.sourceName}` : ''} />

      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4"><button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg></button></div>
        <div className="pt-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900">إدارة مصادر الحجوزات</h2>
            <p className="text-slate-500 font-bold mt-1 italic">تسعير كافة الدوائر وإدارة مديونية الموردين</p>
          </div>
          <button onClick={() => setShowNewSourceForm(!showNewSourceForm)} className="bg-emerald-600 text-white p-4 rounded-2xl shadow-xl active:scale-90 transition-all"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M12 4v16m8-8H4"/></svg></button>
        </div>

        {showNewSourceForm && (
          <form onSubmit={handleCreateSource} className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 animate-scale-up p-6 bg-slate-50 rounded-3xl border-2 border-slate-200">
             <input autoFocus ref={newSourceNameRef} value={newSourceName} onChange={e => setNewSourceName(e.target.value)} placeholder="اسم المصدر الجديد" className="p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm" />
             <input value={newSourcePhone} onChange={e => setNewSourcePhone(e.target.value)} placeholder="رقم الهاتف" className="p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm" />
             <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 mr-2">موصل الأيمن</label><input type="number" value={newPriceRightMosul} onChange={e => handlePriceInput(e.target.value, setNewPriceRightMosul)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 mr-2">موصل الأيسر</label><input type="number" value={newPriceLeftMosul} onChange={e => handlePriceInput(e.target.value, setNewPriceLeftMosul)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 mr-2">حمام العليل</label><input type="number" value={newPriceHammamAlAlil} onChange={e => handlePriceInput(e.target.value, setNewPriceHammamAlAlil)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 mr-2">الشورة</label><input type="number" value={newPriceAlShoura} onChange={e => handlePriceInput(e.target.value, setNewPriceAlShoura)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 mr-2">البعاج</label><input type="number" value={newPriceBaaj} onChange={e => handlePriceInput(e.target.value, setNewPriceBaaj)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 mr-2">دوائر أخرى</label><input type="number" value={newPriceOthers} onChange={e => handlePriceInput(e.target.value, setNewPriceOthers)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm text-center" /></div>
             </div>
             <div className="md:col-span-2 flex gap-3 pt-4">
                <button type="submit" disabled={submittingNewSource} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg">حفظ المصدر</button>
                <button type="button" onClick={() => setShowNewSourceForm(false)} className="px-8 bg-slate-200 text-slate-600 rounded-2xl font-black">إلغاء</button>
             </div>
          </form>
        )}
      </div>

      <div className="table-container rounded-[2.5rem] border-2 border-slate-900 overflow-hidden shadow-xl">
        <table className="w-full text-right border-collapse custom-scrollbar">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="p-4 text-[11px] font-black text-center w-12">ت</th>
              <th className="p-4 text-[11px] font-black">اسم المصدر</th>
              <th className="p-4 text-[11px] font-black">رقم الهاتف</th>
              <th className="p-4 text-[11px] font-black text-center">الرصيد المستحق (له)</th>
              <th className="p-4 text-[11px] font-black text-center w-20">خيارات</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s, i) => (
              <tr key={s.id} onClick={() => handleContextMenuClick(s)} className="border-b border-slate-100 hover:bg-emerald-50/30 cursor-pointer transition-colors group">
                <td className="p-4 text-[11px] font-black text-slate-400 text-center">{i + 1}</td>
                <td className="p-4 text-sm font-black text-slate-800">{s.sourceName}</td>
                <td className="p-4 text-xs font-bold text-blue-600" dir="ltr">{s.phoneNumber || '—'}</td>
                <td className="p-4 text-center">
                   <span className="font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 text-sm">{formatCurrency(calculateOutstandingBalance(s))}</span>
                </td>
                <td className="p-4 text-center">
                   <button className="p-2 bg-slate-100 text-slate-400 rounded-xl group-hover:bg-emerald-600 group-hover:text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
