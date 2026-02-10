
import React, { useMemo } from 'react';
import { OfficeUser, OfficeRecord, CircleType, CIRCLE_NAMES, OfficeSettlement } from '../types';

interface OfficeStatementProps {
  office: OfficeUser | null;
  records: OfficeRecord[];
  settlements: OfficeSettlement[];
  onGoBack: () => void;
  onOpenSettle: () => void;
  formatCurrency: (amount: number | string | undefined) => string;
}

const OfficeStatement: React.FC<OfficeStatementProps> = ({ office, records, settlements, onGoBack, onOpenSettle, formatCurrency }) => {
  if (!office) return null;

  const currentOfficeSettlements = useMemo(() => {
    return settlements.filter(s => s.office_id === office.id);
  }, [settlements, office.id]);

  const totalPaid = useMemo(() => {
    return currentOfficeSettlements.reduce((sum, s) => sum + s.amount, 0);
  }, [currentOfficeSettlements]);

  // Fix: Explicitly type statsByCircle to ensure Object.values returns typed items correctly in some environments
  const statsByCircle: Record<string, { count: number; total: number }> = useMemo(() => {
    const filtered = records.filter(r => r.affiliation === office.office_name && (r.isBooked || !!r.bookingImage));
    const stats: Record<string, { count: number; total: number }> = {};
    
    (Object.values(CircleType) as string[]).forEach(c => {
      stats[c] = { count: 0, total: 0 };
    });

    filtered.forEach(r => {
      // منطق جمع صارم: الأولوية للسعر المخزن في السجل (تثبيت السعر)
      // إذا لم يكن مخزناً (للسجلات القديمة) يتم استخدام سعر المكتب الحالي
      let price = 0;
      if (r.circleType === CircleType.RIGHT_MOSUL) price = r.bookedPriceRightMosul || office.priceRightMosul || 0;
      else if (r.circleType === CircleType.LEFT_MOSUL) price = r.bookedPriceLeftMosul || office.priceLeftMosul || 0;
      else if (r.circleType === CircleType.HAMMAM_ALALIL) price = r.bookedPriceHammamAlAlil || office.priceHammamAlAlil || 0;
      else if (r.circleType === CircleType.ALSHOURA) price = r.bookedPriceAlShoura || office.priceAlShoura || 0;
      else if (r.circleType === CircleType.BAAJ) price = r.bookedPriceBaaj || office.priceBaaj || 0;
      else price = r.bookedPriceOthers || office.priceOthers || 0;

      if (stats[r.circleType]) {
        stats[r.circleType].count += 1;
        stats[r.circleType].total += Number(price);
      }
    });

    return stats;
  }, [records, office]);

  const grandTotalRevenue = useMemo(() => {
    // Fix: Explicitly type the current item 's' in reduce to avoid 'unknown' error (line 54)
    return Object.values(statsByCircle).reduce((sum: number, s: any) => sum + (s?.total || 0), 0);
  }, [statsByCircle]);

  const grandCount = useMemo(() => {
    // Fix: Explicitly type the current item 's' in reduce to avoid 'unknown' error (line 58)
    return Object.values(statsByCircle).reduce((sum: number, s: any) => sum + (s?.count || 0), 0);
  }, [statsByCircle]);

  const outstandingBalance = grandTotalRevenue - totalPaid;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-scale-up pb-40">
      <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 z-10 p-4">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg></button>
        </div>
        
        <div className="pt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900">كشف رصيد المكتب</h2>
              <p className="text-blue-600 font-bold text-lg mt-1 italic">{office.office_name}</p>
            </div>
            <button onClick={onOpenSettle} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-emerald-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12V7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14v4"/><path d="M3 5v14c0 1.1.9 2 2 2h16v-5"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
              تسديد دفعة حساب
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-3xl text-center">
              <p className="text-[10px] font-black text-blue-600 uppercase mb-1">إجمالي الحجوزات ({grandCount} حجز)</p>
              <p className="text-3xl font-black text-blue-900">{formatCurrency(grandTotalRevenue)}</p>
            </div>
            <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-3xl text-center">
              <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">إجمالي ما تم تسديده</p>
              <p className="text-3xl font-black text-emerald-900">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-red-50 border-2 border-red-200 p-6 rounded-3xl text-center shadow-md">
              <p className="text-[10px] font-black text-red-600 uppercase mb-1">باقي حساب (المستحق تسديده)</p>
              <p className="text-3xl font-black text-red-900">{formatCurrency(outstandingBalance)}</p>
            </div>
          </div>

          <h4 className="font-black text-slate-800 text-sm border-b pb-2 mb-4">تفاصيل الجمع حسب الدائرة</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
            {Object.values(CircleType).map(circle => {
              const s = (statsByCircle as any)[circle];
              if (!s || (s.count === 0)) return null;
              return (
                <div key={circle} className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100 transition-all hover:shadow-md">
                  <p className="text-[11px] font-black text-slate-400 uppercase mb-2 truncate">{CIRCLE_NAMES[circle]}</p>
                  <div className="flex justify-between items-end">
                    <div><p className="text-2xl font-black text-slate-900">{s.count}</p><p className="text-[9px] font-bold text-slate-500 mt-1 italic">حجز</p></div>
                    <div className="text-left"><p className="text-lg font-black text-blue-700">{formatCurrency(s.total)}</p></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
             <h4 className="font-black text-slate-800 text-sm border-b pb-2">سجل دفعات التسديد السابقة</h4>
             {currentOfficeSettlements.length === 0 ? (
               <div className="py-10 text-center text-slate-300 font-black italic">لا توجد دفعات مسجلة لهذا المكتب بعد.</div>
             ) : (
               <div className="grid grid-cols-1 gap-3">
                 {currentOfficeSettlements.map((s) => (
                   <div key={s.id} className="p-4 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center font-black">💵</div>
                         <div>
                            <p className="font-black text-emerald-800 text-sm">{formatCurrency(s.amount)}</p>
                            <p className="text-[10px] font-bold text-slate-400">{new Date(s.transaction_date).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                         </div>
                      </div>
                      <div className="text-left">
                         <p className="text-[10px] font-black text-slate-500 italic">"{s.notes || 'بدون ملاحظات'}"</p>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficeStatement;
