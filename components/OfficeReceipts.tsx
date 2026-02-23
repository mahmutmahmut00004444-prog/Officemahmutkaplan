import React, { useState, useMemo, useEffect } from 'react';
import { OfficeRecord, CIRCLE_NAMES, OfficeUser, LoggedInUser, RecycleBinItem, CircleType } from '../types';
import { supabase } from '../lib/supabase';

interface OfficeReceiptsProps {
  records: OfficeRecord[];
  onGoBack: () => void;
  loggedInUser: LoggedInUser | null;
  allOfficeUsers: OfficeUser[];
  onDeleteReceipt: (id: string) => Promise<void>; // New Prop
}

export default function OfficeReceipts({ records, onGoBack, loggedInUser, allOfficeUsers, onDeleteReceipt }: OfficeReceiptsProps) {
  // State for Navigation and Views
  const [selectedDateFolder, setSelectedDateFolder] = useState<string | null>(null);

  // Filters within the folder
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCircle, setActiveCircle] = useState<string>('ALL');
  const [selectedOffice, setSelectedOffice] = useState<string>('ALL');

  // Data
  const [trashReceipts, setTrashReceipts] = useState<OfficeRecord[]>([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // For share/download/delete loading state

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;

  // Modal State
  const [recordToDelete, setRecordToDelete] = useState<OfficeRecord | null>(null);

  const isAdmin = loggedInUser?.role === 'ADMIN';

  // Fetch deleted receipts from Recycle Bin to ensure they persist
  useEffect(() => {
    const fetchTrash = async () => {
      setIsLoadingTrash(true);
      try {
        const { data, error } = await supabase
          .from('recycle_bin')
          .select('*')
          .not('original_data->booking_image', 'is', null); // Only items with booking image

        if (error) throw error;

        const recovered: OfficeRecord[] = (data || []).map((item: RecycleBinItem) => {
           // Map recycle bin item back to OfficeRecord structure temporarily for display
           const original = item.original_data;
           return {
             ...original,
             id: item.original_id, 
             isArchived: true, 
             bookingImage: original.bookingImage,
             bookingDate: original.bookingDate,
             headFullName: original.headFullName,
             circleType: original.circleType,
             affiliation: original.affiliation || 'محذوف',
             bookingCreatedAt: new Date(original.bookingCreatedAt || item.deleted_at).getTime() // Fallback
           };
        });
        setTrashReceipts(recovered);
      } catch (e: any) {
        console.error("Error fetching trash receipts", String(e));
      } finally {
        setIsLoadingTrash(false);
      }
    };
    fetchTrash();
  }, []);

  // Merge Active and Deleted Records
  const allReceipts = useMemo(() => {
    const active = records.filter(r => !!r.bookingImage);
    return [...active, ...trashReceipts];
  }, [records, trashReceipts]);

  // Group by Date (YYYY-MM-DD) based on upload/creation time (bookingCreatedAt)
  const groupedByDate = useMemo(() => {
    const groups: Record<string, OfficeRecord[]> = {};
    
    allReceipts.forEach(record => {
        // We use bookingCreatedAt because it represents when the receipt was added/uploaded to the system
        const dateObj = record.bookingCreatedAt ? new Date(record.bookingCreatedAt) : new Date(record.createdAt);
        const dateKey = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD format
        
        // However, standard user permission filtering applies:
        if (!isAdmin && loggedInUser && record.affiliation !== loggedInUser.username) {
            return; // Skip records not belonging to user
        }

        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(record);
    });

    return groups;
  }, [allReceipts, isAdmin, loggedInUser]);

  const sortedDates = useMemo(() => {
      return Object.keys(groupedByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [groupedByDate]);

  // Helper to get Day Name in Arabic
  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-IQ', { weekday: 'long' });
  };

  // Filtered Records for the CURRENTLY OPEN FOLDER
  const currentFolderRecords = useMemo(() => {
      if (!selectedDateFolder) return [];
      let result = groupedByDate[selectedDateFolder] || [];

      // Apply Filters
      if (isAdmin && selectedOffice !== 'ALL') {
          result = result.filter(r => r.affiliation === selectedOffice);
      }

      if (activeCircle !== 'ALL') {
        result = result.filter(r => r.circleType === activeCircle);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(r => r.headFullName.toLowerCase().includes(q));
      }

      // Sort by time within the day
      return result.sort((a, b) => {
          const timeA = new Date(a.bookingCreatedAt || a.createdAt).getTime();
          const timeB = new Date(b.bookingCreatedAt || b.createdAt).getTime();
          return timeB - timeA;
      });
  }, [groupedByDate, selectedDateFolder, activeCircle, searchQuery, selectedOffice, isAdmin]);

  // Selection Logic
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === currentFolderRecords.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(currentFolderRecords.map(r => r.id)));
    }
  };

  // Helper to convert Base64 to File object
  const dataURLtoFile = async (dataurl: string, filename: string) => {
    const res = await fetch(dataurl);
    const blob = await res.blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  const downloadImage = (base64: string, name: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `وصل_حجز_${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkDownload = async () => {
    const selectedRecords = currentFolderRecords.filter(r => selectedIds.has(r.id));
    if (selectedRecords.length === 0) return;
    
    setIsProcessing(true);
    
    // Sequential download with delay to prevent browser blocking
    for (let i = 0; i < selectedRecords.length; i++) {
        const record = selectedRecords[i];
        if (record.bookingImage) {
            downloadImage(record.bookingImage, record.headFullName);
            // Wait 500ms between downloads
            await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
        }
    }
    
    setIsProcessing(false);
    setSelectedIds(new Set());
  };

  const handleSend = async () => {
      const selectedRecords = currentFolderRecords.filter(r => selectedIds.has(r.id));
      if (selectedRecords.length === 0) return;

      setIsProcessing(true);

      try {
        // Cast navigator to any to avoid TypeScript errors with 'share' property if it's missing from types
        const nav = navigator as any;
        if (nav.share) {
            const filesArray: File[] = await Promise.all(
                selectedRecords.map((r: OfficeRecord) => 
                    dataURLtoFile(r.bookingImage || '', `وصل_${r.headFullName.replace(/\s/g, '_')}.png`)
                )
            );

            // Check if data is valid for sharing
            if (nav.canShare && nav.canShare({ files: filesArray })) {
                await nav.share({
                    files: filesArray,
                    title: 'صور الحجوزات',
                    text: `تم إرفاق ${filesArray.length} وصل حجز.`
                });
                setSelectedIds(new Set()); // Clear selection on success
            } else {
                alert('عذراً، متصفحك لا يدعم مشاركة هذا العدد من الملفات أو نوعها دفعة واحدة.');
            }
        } else {
            alert('المشاركة غير مدعومة في هذا المتصفح. يرجى استخدام متصفح حديث (Chrome/Safari) على الهاتف.');
        }
      } catch (err: any) {
        // Handle AbortError (User cancelled share sheet) gracefully
        const error = err as any;
        const errorName = error?.name;
        const errorMessage = error?.message;
        
        const isCancelled = errorName === 'AbortError' || 
            (typeof errorMessage === 'string' && (errorMessage.toLowerCase().includes('cancel') || errorMessage.toLowerCase().includes('abort')));

        if (isCancelled) {
            console.log('User cancelled sharing');
        } else {
            console.error("Error sharing files:", err);
            const msg = typeof errorMessage === 'string' ? errorMessage : 'Unknown error';
            alert(`حدث خطأ أثناء محاولة المشاركة: ${msg}`);
        }
      } finally {
        setIsProcessing(false);
      }
  };

  // --- Deletion Logic ---
  const handleSingleDeleteRequest = (record: OfficeRecord) => {
    if (!isAdmin) return;
    setRecordToDelete(record);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    setIsProcessing(true);
    try {
        await onDeleteReceipt(recordToDelete.id);
        setRecordToDelete(null);
    } catch (e: any) {
        console.error(String(e));
    } finally {
        setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) return;
    const count = selectedIds.size;
    if (count === 0) return;

    if (confirm(`هل أنت متأكد من حذف ${count} وصولات محددة؟\n\nسيتم إزالة الصور وإلغاء حالة الحجز لجميع السجلات المحددة.`)) {
        setIsProcessing(true);
        try {
            const ids = Array.from(selectedIds);
            // Execute deletions sequentially or in parallel depending on the API design
            // Here we just loop through them as `onDeleteReceipt` handles one
            for (const id of ids) {
                await onDeleteReceipt(id);
            }
            setSelectedIds(new Set());
        } catch (e: any) {
            console.error(String(e));
        } finally {
            setIsProcessing(false);
        }
    }
  };

  // Helper to reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setActiveCircle('ALL');
    setSelectedOffice('ALL');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-40 animate-scale-up">
      {/* Custom Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl relative overflow-hidden">
            <h3 className="text-xl font-black mb-4 text-red-600">تأكيد حذف الوصل</h3>
            <p className="text-slate-500 font-bold mb-6 text-sm leading-relaxed">
              هل أنت متأكد من حذف صورة الحجز للمراجع <span className="text-slate-900">"{recordToDelete.headFullName}"</span>؟
              <br/><br/>
              <span className="text-red-500 text-xs">سيتم إزالة الصورة وإلغاء الحجز من السجلات المكتملة.</span>
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} disabled={isProcessing} className="w-full bg-red-600 text-white py-3 rounded-xl font-black shadow-lg active:scale-95 transition-all">
                {isProcessing ? 'جاري الحذف...' : 'نعم، حذف وإلغاء الحجز'}
              </button>
              <button onClick={() => setRecordToDelete(null)} disabled={isProcessing} className="w-full bg-slate-100 text-slate-500 py-3 rounded-xl font-black hover:bg-slate-200 transition-all">
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden min-h-[600px] flex flex-col">
        <div className="absolute top-0 right-0 p-4">
          <button 
            onClick={selectedDateFolder ? () => setSelectedDateFolder(null) : onGoBack} 
            className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
            <span className="text-xs font-black">{selectedDateFolder ? 'الرجوع للمجلدات' : 'الرئيسية'}</span>
          </button>
        </div>

        <div className="pt-8 flex-1">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8">
             <div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">أرشيف الوصولات</h2>
                <p className="text-slate-500 font-bold text-sm">
                   {selectedDateFolder ? `مجلد: ${selectedDateFolder} (${getDayName(selectedDateFolder)})` : 'المجلدات حسب التاريخ'}
                </p>
             </div>
          </div>

          {!selectedDateFolder ? (
             // Date Folders View
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortedDates.map(date => {
                    const count = groupedByDate[date].length;
                    return (
                        <div key={date} onClick={() => setSelectedDateFolder(date)} className="group bg-slate-50 border-2 border-slate-200 p-6 rounded-3xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all text-center">
                            <div className="w-16 h-16 bg-blue-200 text-blue-700 rounded-2xl mx-auto mb-3 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                            </div>
                            <h4 className="font-black text-slate-800 text-sm">{date}</h4>
                            <p className="text-[10px] text-slate-500 font-bold mt-1">{getDayName(date)}</p>
                            <span className="inline-block mt-2 bg-white px-3 py-1 rounded-full text-[10px] font-black text-blue-600 shadow-sm border border-blue-100">{count} وصل</span>
                        </div>
                    )
                })}
                {sortedDates.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-400 font-black italic text-lg">لا توجد وصولات محفوظة حتى الآن.</div>
                )}
             </div>
          ) : (
             // Receipts Inside Folder View
             <div className="flex flex-col h-full animate-scale-up">
                
                {/* Updated Toolbar Matching ReviewerTable Style */}
                <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 shadow-sm mb-6 sticky top-0 z-20">
                   {/* Top Row: Actions & Selection Info */}
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-4">
                         <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={selectedIds.size > 0 && selectedIds.size === currentFolderRecords.length}
                              onChange={toggleSelectAll}
                              className="w-5 h-5 accent-blue-600 cursor-pointer"
                            />
                            <span className="text-xs font-black text-slate-600 select-none">تحديد الكل</span>
                         </div>
                         <div className="text-slate-900 font-black text-xs italic flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                            {selectedIds.size > 0 ? `تم تحديد ${selectedIds.size} عنصر` : `عرض ${currentFolderRecords.length} وصل`}
                         </div>
                      </div>

                      {/* Bulk Actions */}
                      <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end w-full md:w-auto">
                         {selectedIds.size > 0 && (
                             <>
                                <button onClick={handleBulkDownload} disabled={isProcessing} className="h-9 bg-blue-600 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm flex items-center gap-1 animate-scale-up hover:bg-blue-700">
                                   {isProcessing ? 'جاري...' : <>تحميل <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg></>}
                                </button>
                                <button onClick={handleSend} disabled={isProcessing} className="h-9 bg-emerald-600 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm flex items-center gap-1 animate-scale-up hover:bg-emerald-700">
                                   مشاركة <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                </button>
                                {isAdmin && (
                                  <button onClick={handleBulkDelete} disabled={isProcessing} className="h-9 bg-red-600 text-white px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-sm flex items-center gap-1 animate-scale-up hover:bg-red-700">
                                      حذف <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                  </button>
                                )}
                                <button onClick={() => setSelectedIds(new Set())} className="h-9 bg-slate-200 text-slate-600 px-3 rounded-lg text-[10px] font-black active:scale-95 transition-all">إلغاء التحديد</button>
                             </>
                         )}
                      </div>
                   </div>

                   {/* Row 2: Filters Grid */}
                   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 items-center">
                      <input 
                        type="text" 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        placeholder="بحث بالاسم..." 
                        className="w-full h-9 px-4 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-black outline-none focus:border-blue-400 transition-all md:col-span-2" 
                      />
                      <select 
                        value={activeCircle} 
                        onChange={e => setActiveCircle(e.target.value)} 
                        className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer focus:border-blue-400"
                      >
                         <option value="ALL">كل الدوائر</option>
                         {Object.values(CircleType).map(t => <option key={t} value={t}>{CIRCLE_NAMES[t]}</option>)}
                      </select>
                      {isAdmin && (
                          <select 
                            value={selectedOffice} 
                            onChange={e => setSelectedOffice(e.target.value)} 
                            className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer focus:border-blue-400"
                          >
                             <option value="ALL">كل المكاتب</option>
                             {allOfficeUsers.map(o => <option key={o.id} value={o.office_name}>{o.office_name}</option>)}
                          </select>
                      )}
                      <button 
                        onClick={resetFilters} 
                        className="h-9 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black hover:bg-slate-300 transition-all"
                      >
                        إعادة تعيين
                      </button>
                   </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                   {currentFolderRecords.map(record => (
                       <div 
                         key={record.id} 
                         className={`relative bg-white border-2 rounded-2xl overflow-hidden shadow-sm transition-all group ${selectedIds.has(record.id) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-100 hover:border-slate-300'}`}
                         onClick={() => toggleSelection(record.id)}
                       >
                          {/* Selection Checkbox Overlay */}
                          <div className="absolute top-2 right-2 z-10">
                             <input type="checkbox" checked={selectedIds.has(record.id)} readOnly className="w-5 h-5 accent-blue-600 shadow-sm cursor-pointer" />
                          </div>

                          {/* Image */}
                          <div className="aspect-[3/4] bg-slate-100 relative">
                             {record.bookingImage ? (
                                <img src={record.bookingImage} className="w-full h-full object-cover" loading="lazy" />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300 font-black text-xs">لا توجد صورة</div>
                             )}
                             {/* Overlay Info */}
                             <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 text-white">
                                <p className="font-black text-[10px] truncate">{record.headFullName}</p>
                                <p className="text-[9px] font-bold opacity-80">{CIRCLE_NAMES[record.circleType]}</p>
                             </div>
                          </div>

                          {/* Footer Info */}
                          <div className="p-2 bg-slate-50 flex justify-between items-center border-t border-slate-100">
                             <div>
                                <p className="text-[8px] font-black text-slate-500">{record.affiliation}</p>
                                <p className="text-[8px] font-bold text-slate-400" dir="ltr">{new Date(record.bookingCreatedAt || record.createdAt).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})}</p>
                             </div>
                             <div className="flex gap-1">
                                {record.bookingImage && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); downloadImage(record.bookingImage!, record.headFullName); }}
                                        className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-colors shadow-sm"
                                        title="تحميل"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                    </button>
                                )}
                                {isAdmin && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleSingleDeleteRequest(record); }}
                                        className="w-7 h-7 bg-white border border-red-100 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors shadow-sm"
                                        title="حذف"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    </button>
                                )}
                             </div>
                          </div>
                       </div>
                   ))}
                   {currentFolderRecords.length === 0 && (
                       <div className="col-span-full py-10 text-center text-slate-300 font-black italic">لا توجد وصولات مطابقة للبحث.</div>
                   )}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}