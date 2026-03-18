
import React, { useState, useEffect } from 'react';
import { RecycleBinItem, CIRCLE_NAMES, CircleType } from '../types';

interface TrashBinProps {
  onGoBack: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  onRestore: (item: RecycleBinItem) => Promise<void>;
}

const TrashBin: React.FC<TrashBinProps> = ({ onGoBack, showToast, onRestore }) => {
  const [deletedItems, setDeletedItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for Modals
  const [selectedItem, setSelectedItem] = useState<RecycleBinItem | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // New state for delete confirmation
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // New state for delete process

  useEffect(() => {
    fetchDeletedItems();
  }, []);

  const fetchDeletedItems = async () => {
    setLoading(true);
    try {
      const storedTrash = localStorage.getItem('recycle_bin');
      if (storedTrash) {
        const trash = JSON.parse(storedTrash);
        // Filter items older than 72 hours
        const threeDaysAgo = Date.now() - 72 * 60 * 60 * 1000;
        const filtered = trash.filter((item: RecycleBinItem) => new Date(item.deleted_at).getTime() > threeDaysAgo);
        setDeletedItems(filtered);
        if (filtered.length !== trash.length) {
          localStorage.setItem('recycle_bin', JSON.stringify(filtered));
        }
      }
    } catch (error: any) {
      showToast(`خطأ في جلب المحذوفات: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreProcess = async () => {
    if (!selectedItem) return;
    setIsRestoring(true);
    try {
        await onRestore(selectedItem);
        setDeletedItems(prev => prev.filter(i => i.id !== selectedItem.id));
        setSelectedItem(null);
        setShowRestoreConfirm(false);
    } catch (error) {
        // Error handled in parent
    } finally {
        setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedItem) return;
    setIsDeleting(true);
    try {
        const storedTrash = localStorage.getItem('recycle_bin');
        if (storedTrash) {
          const trash = JSON.parse(storedTrash).filter((i: any) => i.id !== selectedItem.id);
          localStorage.setItem('recycle_bin', JSON.stringify(trash));
          setDeletedItems(trash);
        }

        showToast('تم حذف السجل نهائياً', 'success');
        setSelectedItem(null);
        setShowDeleteConfirm(false);
    } catch (error: any) {
        showToast(`فشل الحذف النهائي: ${error.message}`, 'error');
    } finally {
        setIsDeleting(false);
    }
  };

  const filteredItems = deletedItems.filter(item => 
    item.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.original_data?.affiliation && item.original_data.affiliation.toLowerCase().includes(searchQuery.toLowerCase())) ||
    item.deleted_by.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-40 animate-scale-up">
      
      {/* نافذة التفاصيل والخيارات (تظهر عند الضغط على الاسم) */}
      {selectedItem && !showRestoreConfirm && !showDeleteConfirm && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up" onClick={() => setSelectedItem(null)}>
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg border-2 border-slate-900 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
             <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
             </button>
             
             <h3 className="text-2xl font-black text-slate-900 mb-2 text-center pt-4">خيارات السجل المحذوف</h3>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 text-center">
                <p className="text-xl font-black text-slate-800 mb-1">{selectedItem.full_name}</p>
                <p className="text-sm font-bold text-slate-500">
                   {selectedItem.record_type === 'reviewer' ? 'سجل محمود قبلان' : `مكتب: ${selectedItem.original_data.affiliation}`}
                </p>
                <div className="mt-2 text-xs font-bold text-red-600 bg-red-50 inline-block px-3 py-1 rounded-lg border border-red-100">
                   حذف بواسطة: {selectedItem.deleted_by}
                </div>
             </div>

             <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShowRestoreConfirm(true)}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-lg hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                   إرجاع البيانات للمصدر
                </button>
                
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black text-lg shadow-sm hover:bg-red-100 hover:border-red-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                   حذف نهائي (لا يسترجع)
                </button>

                <button 
                  onClick={() => setSelectedItem(null)}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                   إغلاق
                </button>
             </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد الاسترجاع */}
      {showRestoreConfirm && selectedItem && (
        <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-scale-up">
           <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md text-center border-2 border-slate-900 shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4">تأكيد الاسترجاع</h3>
              <p className="text-slate-600 font-bold mb-8 leading-relaxed">
                 هل أنت متأكد من رغبتك في استرجاع السجل <span className="text-emerald-700 font-black">"{selectedItem.full_name}"</span>؟ 
                 <br/><span className="text-xs text-slate-400 mt-2 block">سيتم إعادته لنفس مكانه الأصلي وبنفس التسلسل.</span>
              </p>
              
              <div className="flex gap-3">
                 <button 
                   onClick={handleRestoreProcess}
                   disabled={isRestoring}
                   className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50"
                 >
                    {isRestoring ? 'جاري الاسترجاع...' : 'نعم، موافق'}
                 </button>
                 <button 
                   onClick={() => setShowRestoreConfirm(false)}
                   className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-lg active:scale-95 transition-all hover:bg-slate-200"
                 >
                    إلغاء
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* نافذة تأكيد الحذف النهائي */}
      {showDeleteConfirm && selectedItem && (
        <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-scale-up">
           <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md text-center border-2 border-slate-900 shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-4">تأكيد الحذف النهائي</h3>
              <p className="text-slate-600 font-bold mb-8 leading-relaxed">
                 هل أنت متأكد من رغبتك في حذف السجل <span className="text-red-700 font-black">"{selectedItem.full_name}"</span> بشكل كامل؟
                 <br/><span className="text-xs text-red-500 mt-2 block font-black">تحذير: لا يمكن استرجاع البيانات بعد هذه العملية.</span>
              </p>
              
              <div className="flex gap-3">
                 <button 
                   onClick={handlePermanentDelete}
                   disabled={isDeleting}
                   className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50"
                 >
                    {isDeleting ? 'جاري الحذف...' : 'نعم، حذف نهائي'}
                 </button>
                 <button 
                   onClick={() => setShowDeleteConfirm(false)}
                   className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-lg active:scale-95 transition-all hover:bg-slate-200"
                 >
                    إلغاء
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>

        <div className="pt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
             <div>
                <h2 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-3">
                    <span className="text-red-600">🗑️</span>
                    سجل المحذوفات
                </h2>
                <p className="text-slate-500 font-bold text-sm">اضغط على الاسم للاسترجاع (صلاحية 72 ساعة)</p>
             </div>
             <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="بحث عن اسم، مكتب، أو من قام بالحذف..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs w-80 outline-none focus:border-red-400 text-slate-900 placeholder:text-slate-400"
                />
             </div>
          </div>

          {loading ? (
             <div className="py-20 text-center"><div className="inline-block w-8 h-8 border-4 border-slate-300 border-t-red-600 rounded-full animate-spin"></div></div>
          ) : filteredItems.length === 0 ? (
             <div className="py-20 text-center text-slate-300 font-black text-xl italic bg-slate-50 rounded-[2rem] border border-slate-100">سلة المحذوفات فارغة.</div>
          ) : (
             <div className="rounded-2xl border-2 border-slate-900 overflow-hidden shadow-sm bg-white">
                {/* Scroll Container */}
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-right border-collapse min-w-[1300px]">
                    <thead>
                        <tr className="bg-slate-900 text-white text-[12px]">
                            <th className="p-4 w-12 font-black text-center border-l border-slate-700">ت</th>
                            <th className="p-4 w-28 font-black border-l border-slate-700">الدائرة</th>
                            <th className="p-4 font-black border-l border-slate-700">الاسم الكامل</th>
                            <th className="p-4 w-28 font-black border-l border-slate-700">اللقب</th>
                            <th className="p-4 font-black border-l border-slate-700">اسم الأم</th>
                            <th className="p-4 w-24 font-black border-l border-slate-700">التولد</th>
                            <th className="p-4 w-20 font-black text-center border-l border-slate-700">الصلة</th>
                            <th className="p-4 w-40 font-black border-l border-slate-700">المكتب / الجهة</th>
                            <th className="p-4 w-28 font-black border-l border-slate-700">الهاتف</th>
                            {/* عمود من قام بالحذف */}
                            <th className="p-4 w-40 text-center font-black bg-red-900/80 border-l border-red-800 text-red-50">حذف من قبل</th>
                            <th className="p-4 w-36 text-center font-black">تاريخ ووقت الحذف</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs font-bold text-slate-900 bg-white">
                        {filteredItems.map((item, idx) => {
                            const data = item.original_data;
                            const isReviewer = item.record_type === 'reviewer';
                            const affiliation = isReviewer ? 'محمود قبلان' : (data.affiliation || 'مكتب');
                            const familyMembers = data.familyMembers || [];

                            return (
                                <React.Fragment key={item.id}>
                                    {/* Head Row */}
                                    <tr 
                                      className="border-b border-slate-200 hover:bg-emerald-50 transition-colors bg-white cursor-pointer group"
                                      onClick={() => setSelectedItem(item)}
                                    >
                                        <td className="p-4 font-black text-slate-500 text-center border-l border-slate-100">{idx + 1}</td>
                                        <td className="p-4 text-blue-900 font-black border-l border-slate-100">{CIRCLE_NAMES[data.circleType as CircleType] || '-'}</td>
                                        <td className="p-4 font-black text-slate-900 border-l border-slate-100">{item.full_name}</td>
                                        <td className="p-4 font-black text-slate-700 border-l border-slate-100">{data.headSurname || '—'}</td>
                                        <td className="p-4 font-black text-slate-900 border-l border-slate-100">{data.headMotherName}</td>
                                        <td className="p-4 font-black text-slate-900 border-l border-slate-100" dir="ltr">{data.headDob}</td>
                                        <td className="p-4 text-center border-l border-slate-100"><span className="bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded">رئيس</span></td>
                                        <td className="p-4 text-indigo-900 font-black border-l border-slate-100">{affiliation}</td>
                                        <td className="p-4 text-blue-900 font-black border-l border-slate-100" dir="ltr">{data.headPhone || '—'}</td>
                                        
                                        {/* Deleted By Column */}
                                        <td className="p-4 text-center font-black text-red-700 bg-red-50/50 border-l border-red-100 group-hover:bg-red-100/50 transition-colors">
                                            {item.deleted_by}
                                        </td>
                                        
                                        <td className="p-4 text-center font-black text-slate-600">
                                            <div className="flex flex-col items-center justify-center" dir="ltr">
                                                <span className="text-[12px]">{new Date(item.deleted_at).toLocaleDateString('en-GB')}</span>
                                                <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                    {new Date(item.deleted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Family Members Rows */}
                                    {familyMembers.map((m: any, mIdx: number) => (
                                        <tr key={`${item.id}-m-${mIdx}`} className="border-b border-slate-200 bg-slate-50/50 hover:bg-emerald-50/50 cursor-pointer" onClick={() => setSelectedItem(item)}>
                                            <td colSpan={2} className="border-l border-slate-100"></td>
                                            <td className="p-4 font-black text-slate-800 text-[11px] flex items-center gap-2 border-l border-slate-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                                {m.fullName}
                                            </td>
                                            <td className="p-4 text-slate-600 font-black border-l border-slate-100">{m.surname || '—'}</td>
                                            <td className="p-4 font-black text-slate-800 border-l border-slate-100">{m.motherName}</td>
                                            <td className="p-4 font-black text-slate-700 text-center border-l border-slate-100" dir="ltr">{m.dob}</td>
                                            <td className="p-4 text-center border-l border-slate-100"><span className="bg-slate-200 text-slate-700 text-[10px] font-black px-2 py-1 rounded">{m.relationship}</span></td>
                                            
                                            {/* Empty cells for columns not applicable to members but keeping structure */}
                                            <td className="p-4 text-center text-slate-300 border-l border-slate-100">—</td>
                                            <td className="p-4 text-center text-slate-300 border-l border-slate-100">—</td>
                                            <td className="p-4 text-center bg-red-50/20 border-l border-red-50"></td>
                                            <td className="p-4 text-center"></td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                    </table>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrashBin;
