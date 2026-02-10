
import React, { useState, useEffect, useMemo } from 'react';
import { BookingSource, SettlementTransaction, LoggedInUser } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SettleSourcePageProps {
  onGoBack: () => void;
  source: BookingSource;
  outstandingBalance: number; // The calculated outstanding balance passed from BookingSourcesManager
  showToast: (message: string, type: 'success' | 'error') => void;
  loggedInUser: LoggedInUser;
  onSettlePayment: (sourceId: string, amount: number, notes?: string) => Promise<void>; // Handler to save settlement
  formatCurrency: (amount: number | string | undefined) => string; // NEW: Pass formatCurrency prop
}

const SettleSourcePage: React.FC<SettleSourcePageProps> = ({
  onGoBack,
  source,
  outstandingBalance,
  showToast,
  loggedInUser,
  onSettlePayment,
  formatCurrency, // NEW
}) => {
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<SettlementTransaction[]>([]);
  const [isFetchingTransactions, setIsFetchingTransactions] = useState(true);

  // Initialize settlement amount with the full outstanding balance by default
  useEffect(() => {
    setSettlementAmount(Math.round(outstandingBalance));
  }, [outstandingBalance]);

  // Fetch past settlement transactions for this source
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!isSupabaseConfigured) {
        setTransactions([]);
        setIsFetchingTransactions(false);
        return;
      }
      setIsFetchingTransactions(true);
      try {
        const { data, error } = await supabase
          .from('settlement_transactions')
          .select('*')
          .eq('source_id', source.id)
          .order('transaction_date', { ascending: false });

        if (error) throw error;
        setTransactions((data || []).map((t: any) => ({
          id: t.id,
          source_id: t.source_id,
          amount: parseFloat(t.amount),
          transaction_date: new Date(t.transaction_date).getTime(),
          recorded_by: t.recorded_by,
          notes: t.notes,
        })));
      } catch (error: any) {
        showToast(`خطأ في جلب سجلات التسديد: ${error.message}`, 'error');
      } finally {
        setIsFetchingTransactions(false);
      }
    };
    fetchTransactions();
  }, [source.id, showToast, isSubmitting, isSupabaseConfigured]); // Re-fetch on submit success

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (settlementAmount <= 0 || settlementAmount > outstandingBalance + 1) { // Allow slight tolerance
      showToast('المبلغ المدخل غير صالح أو يتجاوز الرصيد المستحق.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSettlePayment(source.id, settlementAmount, settlementNotes.trim());
      showToast('تم تسجيل التسديد بنجاح!', 'success');
      setSettlementAmount(0); // Reset or let useEffect update it for remaining balance
      setSettlementNotes('');
      onGoBack(); // Navigate back to source manager
    } catch (error: any) {
      showToast(error.message || 'فشل تسجيل التسديد.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentOutstandingBalance = useMemo(() => {
    // This value is purely for display and should match the `outstandingBalance` prop unless state drifts.
    // For simplicity, rely on `outstandingBalance` prop as the source of truth from App.tsx
    return outstandingBalance; 
  }, [outstandingBalance]);


  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-scale-up pb-40">
      <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col"> {/* Added max-h and flex-col */}
        <div className="absolute top-0 right-0 z-10 p-2">
          <button 
            onClick={onGoBack}
            className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center"
            aria-label="رجوع"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
        <div className="relative pt-10 flex-1 overflow-y-auto custom-scrollbar"> {/* Added flex-1 and overflow-y-auto */}
          <h2 className="text-3xl font-black text-slate-900 mb-2">تسديد المستحقات لـ: {source.sourceName}</h2>
          <p className="text-slate-500 font-bold mt-2 italic">تسجيل دفعات محمود قبلان للمصدر</p>

          <div className="mt-8 bg-orange-50 p-6 rounded-2xl border-2 border-orange-200 text-center shadow-md">
            <p className="text-[11px] font-black text-orange-700 uppercase mb-1">الرصيد المستحق الحالي</p>
            <p className="text-4xl font-black text-orange-900">{formatCurrency(currentOutstandingBalance)}</p>
          </div>

          <form onSubmit={handleSettle} className="mt-8 space-y-6">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 uppercase pr-2">مبلغ التسديد</label>
              <input
                type="number"
                min="0"
                value={settlementAmount}
                onChange={e => setSettlementAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-orange-600 outline-none font-black text-lg text-center"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 uppercase pr-2">ملاحظات (اختياري)</label>
              <input
                type="text"
                value={settlementNotes}
                onChange={e => setSettlementNotes(e.target.value)}
                placeholder="ملاحظات حول التسديد"
                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-orange-600 outline-none font-black text-sm"
                disabled={isSubmitting}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || settlementAmount <= 0}
              className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-orange-100 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'جاري التسديد...' : 'تسجيل التسديد'}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border-2 border-slate-900 shadow-xl overflow-hidden animate-scale-up">
        <div className="bg-orange-900 px-6 py-4 flex items-center justify-between">
          <h3 className="font-black text-white text-sm">سجلات التسديد السابقة ({transactions.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 w-16 text-center">ت</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500 text-center">المبلغ</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500">التاريخ</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500">بواسطة</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-500">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {isFetchingTransactions ? (
                <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-black text-xl italic">جاري جلب سجلات التسديد...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-black text-xl italic">لا توجد سجلات تسديد لهذا المصدر.</td></tr>
              ) : (
                transactions.map((t, idx) => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-orange-50/20 group transition-colors">
                    <td className="px-6 py-4 text-[11px] font-black text-slate-400 text-center">{idx + 1}</td>
                    <td className="px-6 py-4 text-[13px] font-black text-emerald-700 text-center">{formatCurrency(t.amount)}</td>
                    <td className="px-6 py-4 text-[12px] font-bold text-slate-600">{new Date(t.transaction_date).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-4 text-[12px] font-bold text-slate-600">{t.recorded_by}</td>
                    <td className="px-6 py-4 text-[12px] font-bold text-slate-600">{t.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SettleSourcePage;
