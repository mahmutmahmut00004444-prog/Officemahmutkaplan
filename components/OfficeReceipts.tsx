
import React, { useState, useMemo } from 'react';
import { OfficeRecord, CIRCLE_NAMES } from '../types';

interface OfficeReceiptsProps {
  records: OfficeRecord[];
  onGoBack: () => void;
}

export default function OfficeReceipts({ records, onGoBack }: OfficeReceiptsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCircle, setActiveCircle] = useState<string>('ALL');

  // Filter records that have booking images
  const receiptRecords = useMemo(() => {
    return records
      .filter(r => !!r.bookingImage)
      .sort((a, b) => (b.bookingCreatedAt || 0) - (a.bookingCreatedAt || 0));
  }, [records]);

  // Filter based on search and circle
  const filteredRecords = useMemo(() => {
    let result = receiptRecords;
    
    if (activeCircle !== 'ALL') {
      result = result.filter(r => r.circleType === activeCircle);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.headFullName.toLowerCase().includes(q));
    }

    return result;
  }, [receiptRecords, activeCircle, searchQuery]);

  const downloadImage = (base64: string, name: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `وصل_حجز_${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-40 animate-scale-up">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>

        <div className="pt-8">
          <div className="flex flex-col gap-4 mb-6">
             <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
               <span className="text-emerald-600">🧾</span>
               الوصولات (صور الحجوزات)
             </h2>
             <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
               <svg className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
               <div>
                 <p className="font-black text-amber-800 text-sm">تنبيه هام جداً:</p>
                 <p className="text-xs font-bold text-amber-700 mt-1">يتم حذف الوصولات وصور الحجز تلقائياً من النظام كل 5 أيام. يرجى حفظ الصور في الاستوديو فوراً لضمان عدم فقدانها.</p>
               </div>
             </div>
          </div>

          {/* Filters */}
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
             <input 
               type="text" 
               placeholder="بحث عن اسم المراجع..." 
               value={searchQuery} 
               onChange={e => setSearchQuery(e.target.value)} 
               className="w-full p-4 rounded-2xl border border-slate-200 font-bold text-sm outline-none focus:border-emerald-500" 
             />
             <select 
               value={activeCircle} 
               onChange={e => setActiveCircle(e.target.value)}
               className="w-full p-4 rounded-2xl border border-slate-200 font-bold text-sm outline-none focus:border-emerald-500"
             >
               <option value="ALL">جميع الدوائر</option>
               {Object.values(CIRCLE_NAMES).map((name, idx) => (
                 <option key={idx} value={Object.keys(CIRCLE_NAMES)[idx]}>{name}</option>
               ))}
             </select>
          </div>

          {/* Grid */}
          {filteredRecords.length === 0 ? (
            <div className="py-20 text-center">
               <div className="inline-block p-6 bg-slate-50 rounded-full mb-4">
                 <svg className="w-12 h-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
               </div>
               <p className="text-slate-400 font-black text-lg">لا توجد وصولات حالياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredRecords.map(record => (
                <div key={record.id} className="bg-white border-2 border-slate-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-500 transition-all group flex flex-col">
                   {/* Image Area */}
                   <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                      <img src={record.bookingImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Booking" />
                      <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/60 to-transparent">
                         <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-sm">
                            {CIRCLE_NAMES[record.circleType]}
                         </span>
                      </div>
                   </div>
                   
                   {/* Content Area */}
                   <div className="p-5 flex flex-col gap-3 flex-1">
                      <div>
                        <h3 className="font-black text-slate-900 text-sm truncate">{record.headFullName}</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                           تاريخ الحجز: <span className="text-emerald-700" dir="ltr">{record.bookingDate || '-'}</span>
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-2">
                        <button 
                          onClick={() => downloadImage(record.bookingImage!, record.headFullName)}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-emerald-600"
                        >
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                           حفظ الصورة في الاستوديو
                        </button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
