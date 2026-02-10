
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { BookingSource, Reviewer, OfficeRecord, CIRCLE_NAMES, CircleType, SettlementTransaction } from '../types';
import { SourceStatementTab } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SourceAccountStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: BookingSource;
  allReviewers: Reviewer[];
  allOfficeRecords: OfficeRecord[];
  defaultTab?: SourceStatementTab; 
  onRemoveBookingFromSource: (recordId: string, sourceId: string | null, recordType: 'reviewer' | 'office') => Promise<void>; 
  showToast: (message: string, type: 'success' | 'error') => void; 
  formatCurrency: (amount: number | string | undefined) => string; 
}

const SourceAccountStatementModal: React.FC<SourceAccountStatementModalProps> = ({
  isOpen, onClose, source, allReviewers, allOfficeRecords, defaultTab = 'summary', onRemoveBookingFromSource, showToast, formatCurrency,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<SourceStatementTab>(defaultTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); 
  const [recordToDelete, setRecordToDelete] = useState<{ id: string, name: string, type: 'reviewer' | 'office' } | null>(null); 
  const [settlementTransactions, setSettlementTransactions] = useState<SettlementTransaction[]>([]); 

  useEffect(() => { setActiveTab(defaultTab); }, [defaultTab]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.classList.add('overflow-hidden');
    } else {
      document.removeEventListener('keydown', handleEscape);
      document.body.classList.remove('overflow-hidden');
    }
    return () => { document.removeEventListener('keydown', handleEscape); document.body.classList.remove('overflow-hidden'); };
  }, [isOpen, onClose]);

  useEffect(() => {
    const fetchSettlements = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await supabase.from('settlement_transactions').select('*').eq('source_id', source.id).order('transaction_date', { ascending: false });
        if (error) throw error;
        setSettlementTransactions((data || []).map((t: any) => ({
            id: t.id, source_id: t.source_id, amount: parseFloat(t.amount), transaction_date: new Date(t.transaction_date).getTime(), recorded_by: t.recorded_by, notes: t.notes
        })));
      } catch (error: any) { showToast(`خطأ: ${error.message}`, 'error'); }
    };
    if (isOpen && source.id) fetchSettlements();
  }, [isOpen, source.id, showToast]);

  const bookedReviewers = useMemo(() => allReviewers.filter(r => r.bookedSourceId === source.id), [allReviewers, source.id]);
  const bookedOfficeRecords = useMemo(() => allOfficeRecords.filter(o => o.bookedSourceId === source.id), [allOfficeRecords, source.id]);

  const totalCalculatedRevenue = useMemo(() => {
    let revenue = 0;
    const calculateFor = (list: any[]) => {
      list.forEach(item => {
        let price = 0;
        if (item.circleType === CircleType.RIGHT_MOSUL) price = item.bookedPriceRightMosul || source.priceRightMosul;
        else if (item.circleType === CircleType.LEFT_MOSUL) price = item.bookedPriceLeftMosul || source.priceLeftMosul;
        else if (item.circleType === CircleType.HAMMAM_ALALIL) price = item.bookedPriceHammamAlAlil || source.priceHammamAlAlil;
        else if (item.circleType === CircleType.ALSHOURA) price = item.bookedPriceAlShoura || source.priceAlShoura;
        else if (item.circleType === CircleType.BAAJ) price = item.bookedPriceBaaj || source.priceBaaj;
        else price = item.bookedPriceOthers || source.priceOthers;
        revenue += price;
      });
    };
    calculateFor(bookedReviewers);
    calculateFor(bookedOfficeRecords);
    return revenue;
  }, [bookedReviewers, bookedOfficeRecords, source]);

  const totalSettled = useMemo(() => settlementTransactions.reduce((sum, t) => sum + t.amount, 0), [settlementTransactions]);
  const outstandingBalance = totalCalculatedRevenue - totalSettled;

  const bookingsByCircleType = useMemo(() => {
    const data: Record<CircleType, { count: number, value: number }> = {} as any;
    Object.values(CircleType).forEach(t => data[t] = { count: 0, value: 0 });
    const process = (list: any[]) => {
      list.forEach(item => {
        data[item.circleType].count++;
        let price = 0;
        if (item.circleType === CircleType.RIGHT_MOSUL) price = item.bookedPriceRightMosul || source.priceRightMosul;
        else if (item.circleType === CircleType.LEFT_MOSUL) price = item.bookedPriceLeftMosul || source.priceLeftMosul;
        else if (item.circleType === CircleType.HAMMAM_ALALIL) price = item.bookedPriceHammamAlAlil || source.priceHammamAlAlil;
        else if (item.circleType === CircleType.ALSHOURA) price = item.bookedPriceAlShoura || source.priceAlShoura;
        else if (item.circleType === CircleType.BAAJ) price = item.bookedPriceBaaj || source.priceBaaj;
        else price = item.bookedPriceOthers || source.priceOthers;
        data[item.circleType].value += price;
      });
    };
    process(bookedReviewers); process(bookedOfficeRecords);
    return Object.entries(data).map(([type, stats]) => ({ circleType: type as CircleType, ...stats }));
  }, [bookedReviewers, bookedOfficeRecords, source]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up" onClick={onClose}>
      {showDeleteConfirm && recordToDelete && (
        <div className="fixed inset-0 z-[2001] flex items-center justify-center bg-black/80 p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-white p-8 rounded-[2rem] w-full max-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up">
            <h3 className="text-xl font-black mb-2 text-red-600">إلغاء الارتباط</h3>
            <p className="text-slate-500 mb-6 font-bold text-sm">هل تريد إلغاء حجز "{recordToDelete.name}" من هذا المصدر؟ سيتم حذف المبلغ من الحساب.</p>
            <div className="flex gap-2">
              <button onClick={async () => { await onRemoveBookingFromSource(recordToDelete.id, null, recordToDelete.type); setShowDeleteConfirm(false); }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black">تأكيد الإلغاء</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-black">تراجع</button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white p-6 rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] flex flex-col border-2 border-slate-900 shadow-2xl relative" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 z-10 p-2"><button onClick={onClose} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg></button></div>
        <h3 className="text-2xl font-black text-slate-900 pt-4 text-right pr-2">كشف حساب: {source.sourceName}</h3>
        
        <div className="flex justify-center gap-2 my-6 p-2 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
          {['summary', 'booked', 'settlements'].map(t => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 min-w-[100px] py-3 px-4 rounded-lg text-[11px] font-black transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-200'}`}>
              {t === 'summary' ? 'ملخص الحساب' : t === 'booked' ? 'تفاصيل الحجوزات' : 'سجل التسديدات'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 bg-red-50 rounded-2xl border-2 border-red-200 text-center shadow-sm">
                  <p className="text-[10px] font-black text-red-500 uppercase mb-1">الرصيد المستحق (الديون)</p>
                  <p className="text-3xl font-black text-red-900">{formatCurrency(outstandingBalance)}</p>
                </div>
                <div className="p-6 bg-blue-50 rounded-2xl border-2 border-blue-200 text-center shadow-sm">
                  <p className="text-[10px] font-black text-blue-500 uppercase mb-1">إجمالي الحجوزات</p>
                  <p className="text-3xl font-black text-blue-900">{formatCurrency(totalCalculatedRevenue)}</p>
                </div>
                <div className="p-6 bg-green-50 rounded-2xl border-2 border-green-200 text-center shadow-sm">
                  <p className="text-[10px] font-black text-green-500 uppercase mb-1">إجمالي ما تم تسديده</p>
                  <p className="text-3xl font-black text-green-900">{formatCurrency(totalSettled)}</p>
                </div>
              </div>
              
              <h4 className="font-black text-slate-800 text-sm border-b pb-2">إحصائيات حسب الدائرة</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {bookingsByCircleType.map(item => item.count > 0 && (
                  <div key={item.circleType} className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                    <p className="text-[9px] font-black text-indigo-700 truncate">{CIRCLE_NAMES[item.circleType]}</p>
                    <p className="text-lg font-black text-indigo-900">{item.count}</p>
                    <p className="text-[9px] font-bold text-slate-400">{formatCurrency(item.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'booked' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h4 className="font-black text-slate-800 text-sm">الحجوزات المرتبطة بالمصدر ({bookedReviewers.length + bookedOfficeRecords.length})</h4>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {[...bookedReviewers, ...bookedOfficeRecords].map((r) => {
                   let currentPrice = 0;
                   if (r.circleType === CircleType.RIGHT_MOSUL) currentPrice = r.bookedPriceRightMosul || source.priceRightMosul;
                   else if (r.circleType === CircleType.LEFT_MOSUL) currentPrice = r.bookedPriceLeftMosul || source.priceLeftMosul;
                   else if (r.circleType === CircleType.HAMMAM_ALALIL) currentPrice = r.bookedPriceHammamAlAlil || source.priceHammamAlAlil;
                   else if (r.circleType === CircleType.ALSHOURA) currentPrice = r.bookedPriceAlShoura || source.priceAlShoura;
                   else if (r.circleType === CircleType.BAAJ) currentPrice = r.bookedPriceBaaj || source.priceBaaj;
                   else currentPrice = r.bookedPriceOthers || source.priceOthers;

                   return (
                    <div key={r.id} className="p-4 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-between shadow-sm hover:border-blue-400 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-xl">
                          {r.bookingImage ? '🖼️' : '📋'}
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-900">{r.headFullName}</p>
                          <div className="flex gap-2 items-center">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 rounded">{CIRCLE_NAMES[r.circleType]}</span>
                            <span className="text-[10px] font-bold text-slate-400">{r.bookingDate || '—'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="font-black text-emerald-600 text-sm">{formatCurrency(currentPrice)}</p>
                        </div>
                        <button onClick={() => { setRecordToDelete({ id: r.id, name: r.headFullName, type: 'headFullName' in r && !('affiliation' in r) ? 'reviewer' : 'office' }); setShowDeleteConfirm(true); }} className="p-2 text-red-300 hover:text-red-600 transition-all"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                      </div>
                    </div>
                   );
                })}
                {(bookedReviewers.length === 0 && bookedOfficeRecords.length === 0) && (
                  <div className="py-20 text-center text-slate-300 font-black italic">لا توجد حجوزات مسجلة لهذا المصدر.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settlements' && (
            <div className="space-y-4">
              <h4 className="font-black text-slate-800 text-sm">سجل عمليات التسديد والدفع</h4>
              {settlementTransactions.length === 0 ? (
                <div className="py-20 text-center text-slate-300 font-black italic">لم يتم تسجيل أي عمليات تسديد حتى الآن.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {settlementTransactions.map((t) => (
                    <div key={t.id} className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
                        </div>
                        <div>
                          <p className="font-black text-emerald-900 text-sm">{formatCurrency(t.amount)}</p>
                          <p className="text-[10px] font-bold text-emerald-600">{new Date(t.transaction_date).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400">بواسطة: {t.recorded_by}</p>
                        {t.notes && <p className="text-[9px] font-bold text-emerald-700 italic">"{t.notes}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SourceAccountStatementModal;
