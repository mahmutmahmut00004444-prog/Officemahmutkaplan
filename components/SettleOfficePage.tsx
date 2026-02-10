
import React, { useState } from 'react';
import { OfficeUser } from '../types';

interface SettleOfficePageProps {
  office: OfficeUser;
  onGoBack: () => void;
  onSettle: (officeId: string, amount: number, notes: string) => Promise<void>;
  formatCurrency: (amount: number | string | undefined) => string;
}

const SettleOfficePage: React.FC<SettleOfficePageProps> = ({ office, onGoBack, onSettle, formatCurrency }) => {
  const [amount, setAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSettle(office.id, Number(amount), notes);
      onGoBack();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-scale-up pb-40">
      <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 z-10 p-4">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg></button>
        </div>
        
        <div className="pt-8">
          <h2 className="text-3xl font-black text-slate-900">تسجيل تسديد دفعة</h2>
          <p className="text-emerald-600 font-bold text-lg mt-1 italic">{office.office_name}</p>

          <form onSubmit={handleFormSubmit} className="mt-10 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 mr-2">المبلغ المدفوع (بالدينار العراقي)</label>
              <input 
                autoFocus
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                placeholder="أدخل المبلغ هنا..."
                className="w-full p-6 bg-slate-50 border-2 border-slate-200 rounded-[2rem] font-black text-2xl text-center focus:border-emerald-600 outline-none transition-all shadow-inner"
                required
              />
              {amount && <p className="text-center font-black text-emerald-700 mt-2">{formatCurrency(amount)}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 mr-2">ملاحظات حول الدفعة (اختياري)</label>
              <textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="مثلاً: دفعة وجبة شهر شباط..."
                className="w-full p-5 bg-white border-2 border-slate-200 rounded-2xl font-bold text-sm h-32 focus:border-blue-600 outline-none transition-all"
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || !amount}
              className={`w-full py-5 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 transition-all ${isSubmitting ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white shadow-xl hover:bg-emerald-700'}`}
            >
              {isSubmitting ? (
                <div className="animate-spin w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full"></div>
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg>
                  تأكيد وحفظ الدفعة
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SettleOfficePage;
