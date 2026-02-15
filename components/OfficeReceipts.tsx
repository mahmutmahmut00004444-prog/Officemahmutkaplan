
import React, { useState, useMemo, useEffect } from 'react';
import { OfficeRecord, CIRCLE_NAMES, OfficeUser, LoggedInUser, RecycleBinItem, CircleType } from '../types';
import { supabase } from '../lib/supabase';

interface OfficeReceiptsProps {
  records: OfficeRecord[];
  onGoBack: () => void;
  loggedInUser: LoggedInUser | null;
  allOfficeUsers: OfficeUser[];
}

export default function OfficeReceipts({ records, onGoBack, loggedInUser, allOfficeUsers }: OfficeReceiptsProps) {
  // State for Navigation and Views
  const [selectedDateFolder, setSelectedDateFolder] = useState<string | null>(null);

  // Filters within the folder
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCircle, setActiveCircle] = useState<string>('ALL');
  const [selectedOffice, setSelectedOffice] = useState<string>('ALL');

  // Data
  const [trashReceipts, setTrashReceipts] = useState<OfficeRecord[]>([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // For share/download loading state

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedIds.size > 0;

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
      } catch (e) {
        console.error("Error fetching trash receipts", e);
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
            await new Promise(resolve => setTimeout(resolve, 500));
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
        if (navigator.share) {
            const filesArray = await Promise.all(
                selectedRecords.map(r => 
                    dataURLtoFile(r.bookingImage!, `وصل_${r.headFullName.replace(/\s/g, '_')}.png`)
                )
            );

            // Check if data is valid for sharing
            if (navigator.canShare && navigator.canShare({ files: filesArray })) {
                await navigator.share({
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
      } catch (error: any) {
        // Handle AbortError (User cancelled share sheet) gracefully
        if (error.name === 'AbortError' || error.message?.includes('canceled') || error.message?.includes('cancelled')) {
            console.log('User cancelled sharing');
            // Do not show an alert for cancellation
        } else {
            console.error("Error sharing files:", error);
            alert(`حدث خطأ أثناء محاولة المشاركة: ${error.message}`);
        }
      } finally {
        setIsProcessing(false);
      }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-40 animate-scale-up">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden min-h-[600px] flex flex-col">
        <div className="absolute top-0 right-0 p-4">
          <button 
            onClick={selectedDateFolder ? () => setSelectedDateFolder(null) : onGoBack} 
            className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
            {selectedDateFolder && <span className="text-xs font-black hidden md:inline">رجوع للأرشيف</span>}
          </button>
        </div>

        <div className="pt-8 flex-1 flex flex-col">
          <div className="flex flex-col gap-4 mb-6">
             <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
               <span className="text-emerald-600">🗂️</span>
               {selectedDateFolder ? (
                 <div className="flex items-center gap-2">
                    <span>وصولات يوم:</span>
                    <span className="text-emerald-600 underline decoration-wavy decoration-emerald-300">{getDayName(selectedDateFolder)}</span>
                    <span className="text-lg text-slate-400 font-bold">({selectedDateFolder})</span>
                 </div>
               ) : 'أرشيف الوصولات اليومي'}
             </h2>
             {!selectedDateFolder && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                    <svg className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <div>
                        <p className="font-black text-emerald-800 text-sm">نظام الأرشفة التلقائي:</p>
                        <p className="text-xs font-bold text-emerald-700 mt-1">يتم حفظ الوصولات وتجميعها في مجلدات حسب تاريخ الرفع. اضغط على اليوم لعرض الوصولات.</p>
                    </div>
                </div>
             )}
          </div>

          {/* FOLDER VIEW (List of Dates as Days) */}
          {!selectedDateFolder && (
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-scale-up">
                {isLoadingTrash && <div className="col-span-full py-4 text-center text-slate-400 font-bold animate-pulse">جاري تحديث الأرشيف...</div>}
                
                {sortedDates.length === 0 && !isLoadingTrash ? (
                    <div className="col-span-full py-20 text-center text-slate-300 font-black text-xl italic">لا توجد وصولات محفوظة.</div>
                ) : (
                    sortedDates.map(date => {
                        const dayName = getDayName(date);
                        return (
                            <button 
                                key={date} 
                                onClick={() => setSelectedDateFolder(date)}
                                className="bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-300 rounded-[2rem] p-6 flex flex-col items-center justify-center gap-3 transition-all group shadow-sm hover:shadow-md active:scale-95"
                            >
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform border border-slate-100">
                                    <span className="text-3xl">📅</span>
                                </div>
                                <div className="text-center w-full">
                                    <span className="block font-black text-emerald-700 text-lg mb-1">{dayName}</span>
                                    <span className="block font-bold text-slate-500 text-xs dir-ltr bg-slate-200/50 rounded-lg py-1 px-2">{date}</span>
                                    <span className="block text-[10px] font-black text-slate-400 mt-2 border-t border-slate-200 pt-1 w-full">{groupedByDate[date].length} وصل</span>
                                </div>
                            </button>
                        );
                    })
                )}
             </div>
          )}

          {/* DETAIL VIEW (Grid of Images for Selected Date) */}
          {selectedDateFolder && (
             <div className="flex-1 flex flex-col animate-scale-up">
                {/* Unified Toolbar - Matches ReviewerTable/OfficeTable Style */}
                <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 shadow-sm mb-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 items-center">
                        <div className="md:col-span-2">
                            <input 
                            type="text" 
                            placeholder="بحث عن اسم المراجع..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="w-full h-9 px-4 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-black outline-none" 
                            />
                        </div>
                        <select 
                        value={activeCircle} 
                        onChange={e => setActiveCircle(e.target.value)}
                        className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer"
                        >
                        <option value="ALL">جميع الدوائر</option>
                        {Object.values(CIRCLE_NAMES).map((name, idx) => (
                            <option key={idx} value={Object.keys(CIRCLE_NAMES)[idx]}>{name}</option>
                        ))}
                        </select>
                        {isAdmin && (
                            <select 
                                value={selectedOffice} 
                                onChange={e => setSelectedOffice(e.target.value)}
                                className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer"
                            >
                                <option value="ALL">جميع المكاتب</option>
                                {allOfficeUsers.map(u => (
                                    <option key={u.id} value={u.office_name}>{u.office_name}</option>
                                ))}
                            </select>
                        )}
                        
                        <div className="flex items-center gap-2 md:col-span-2 justify-end">
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.size === currentFolderRecords.length && currentFolderRecords.length > 0} 
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                                />
                                <span className="text-[10px] font-black text-slate-600">تحديد الكل</span>
                            </div>
                            
                            {isSelectionMode && (
                                <>
                                    <button 
                                    onClick={handleBulkDownload} 
                                    disabled={isProcessing}
                                    className="h-9 bg-slate-900 text-white px-3 rounded-lg font-black text-[10px] shadow-sm active:scale-95 transition-all flex items-center gap-1 disabled:opacity-70"
                                    >
                                        {isProcessing ? '...' : `تنزيل (${selectedIds.size})`}
                                    </button>
                                    <button 
                                    onClick={handleSend} 
                                    disabled={isProcessing}
                                    className="h-9 bg-blue-600 text-white px-3 rounded-lg font-black text-[10px] shadow-sm active:scale-95 transition-all flex items-center gap-1 disabled:opacity-70"
                                    >
                                        {isProcessing ? '...' : 'إرسال'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid */}
                {currentFolderRecords.length === 0 ? (
                    <div className="py-20 text-center text-slate-300 font-black text-lg">لا توجد وصولات مطابقة للبحث في هذا اليوم.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-2">
                        {currentFolderRecords.map(record => (
                            <div 
                                key={record.id} 
                                onClick={() => toggleSelection(record.id)}
                                className={`bg-white border-2 rounded-[2rem] overflow-hidden shadow-sm transition-all group flex flex-col relative cursor-pointer ${selectedIds.has(record.id) ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-emerald-300'}`}
                            >
                                <div className="absolute top-3 right-3 z-10">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(record.id)} 
                                        onChange={() => {}} 
                                        className="w-5 h-5 accent-emerald-600 shadow-md cursor-pointer"
                                    />
                                </div>

                                <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                                    <img src={record.bookingImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Booking" />
                                    <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent">
                                        <p className="text-white text-[10px] font-bold text-center">{CIRCLE_NAMES[record.circleType]}</p>
                                    </div>
                                </div>
                                
                                <div className="p-4 flex flex-col gap-2 flex-1">
                                    <div>
                                        <h3 className="font-black text-slate-900 text-xs truncate">{record.headFullName}</h3>
                                        {record.affiliation && <p className="text-[9px] text-indigo-600 font-bold truncate">{record.affiliation}</p>}
                                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                                            تاريخ الحجز: <span className="text-emerald-700" dir="ltr">{record.bookingDate || '-'}</span>
                                        </p>
                                    </div>
                                    
                                    <div className="mt-auto pt-2 flex gap-2">
                                        <button 
                                        onClick={(e) => { e.stopPropagation(); downloadImage(record.bookingImage!, record.headFullName); }}
                                        className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-black text-[10px] active:scale-95 transition-all hover:bg-slate-200"
                                        >
                                        تنزيل
                                        </button>
                                    </div>
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
}
