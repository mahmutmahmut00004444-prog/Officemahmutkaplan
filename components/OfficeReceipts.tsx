
import React, { useState, useMemo, useEffect } from 'react';
import { OfficeRecord, CIRCLE_NAMES, OfficeUser, LoggedInUser, RecycleBinItem } from '../types';
import { supabase } from '../lib/supabase';

interface OfficeReceiptsProps {
  records: OfficeRecord[];
  onGoBack: () => void;
  loggedInUser: LoggedInUser | null;
  allOfficeUsers: OfficeUser[];
}

export default function OfficeReceipts({ records, onGoBack, loggedInUser, allOfficeUsers }: OfficeReceiptsProps) {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCircle, setActiveCircle] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedOffice, setSelectedOffice] = useState<string>('ALL');

  // Data
  const [trashReceipts, setTrashReceipts] = useState<OfficeRecord[]>([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);

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
             id: item.original_id, // Use original ID or trash ID? Better allow selection via original ID logic
             isArchived: true, // Mark as effectively archived/deleted
             // Ensure properties exist
             bookingImage: original.bookingImage,
             bookingDate: original.bookingDate,
             headFullName: original.headFullName,
             circleType: original.circleType,
             affiliation: original.affiliation || 'محذوف',
             bookingCreatedAt: new Date(original.bookingCreatedAt || item.deleted_at).getTime() // Fallback to delete time if no booking time
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
    // Filter active records that have images
    const active = records.filter(r => !!r.bookingImage);
    // Combine with trash
    return [...active, ...trashReceipts];
  }, [records, trashReceipts]);

  // Apply Filters
  const filteredRecords = useMemo(() => {
    let result = allReceipts;
    
    // User Permission Filter
    if (!isAdmin && loggedInUser) {
        result = result.filter(r => r.affiliation === loggedInUser.username);
    } else if (isAdmin && selectedOffice !== 'ALL') {
        result = result.filter(r => r.affiliation === selectedOffice);
    }

    if (activeCircle !== 'ALL') {
      result = result.filter(r => r.circleType === activeCircle);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.headFullName.toLowerCase().includes(q));
    }

    if (dateFilter) {
      result = result.filter(r => r.bookingDate === dateFilter);
    }

    // Sort by Date (Newest First)
    return result.sort((a, b) => {
        const dateA = new Date(a.bookingCreatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.bookingCreatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
    });
  }, [allReceipts, activeCircle, searchQuery, dateFilter, selectedOffice, isAdmin, loggedInUser]);

  // Grouping Logic (Batches of 5 days)
  const groupedBatches = useMemo(() => {
    const batches: Record<string, OfficeRecord[]> = {};
    const today = new Date().setHours(0,0,0,0);

    filteredRecords.forEach(record => {
       const recordDate = new Date(record.bookingCreatedAt || record.createdAt || 0).setHours(0,0,0,0);
       const diffTime = Math.abs(today - recordDate);
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
       
       // Batch 1: 0-5 days, Batch 2: 6-10 days, etc.
       const batchIndex = Math.floor(diffDays / 5) + 1;
       const key = `وجبة ${batchIndex} (${(batchIndex-1)*5} - ${batchIndex*5} أيام)`;
       
       if (!batches[key]) batches[key] = [];
       batches[key].push(record);
    });
    return batches;
  }, [filteredRecords]);

  // Selection Logic
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const downloadImage = (base64: string, name: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `وصل_حجز_${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkDownload = () => {
    const selectedRecords = filteredRecords.filter(r => selectedIds.has(r.id));
    if (selectedRecords.length === 0) return;
    
    // Simple iterative download (browsers might block too many, but simplest without ZIP lib)
    let delay = 0;
    selectedRecords.forEach(record => {
        setTimeout(() => {
            if (record.bookingImage) downloadImage(record.bookingImage, record.headFullName);
        }, delay);
        delay += 500; // Stagger downloads
    });
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
      // This refers to deleting the *Receipt*, essentially clearing booking info or deleting trash item
      // For now, simpler to just allow "Clear Selection" as "Delete" logic is complex with mixed sources
      alert("خاصية الحذف الجماعي للصور غير مفعلة حالياً لحماية البيانات. يرجى الحذف من السجل الرئيسي.");
  };

  const handleSend = () => {
      // Web Share API is limited for files. Just alert for now.
      alert(`سيتم إرسال ${selectedIds.size} وصل (غير مدعوم مباشرة في المتصفح، يرجى التنزيل ثم الإرسال).`);
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
                 <p className="font-black text-amber-800 text-sm">نظام الأرشفة التلقائي:</p>
                 <p className="text-xs font-bold text-amber-700 mt-1">يتم أرشفة الوصولات تلقائياً في وجبات (كل 5 أيام وجبة). حتى عند حذف العائلة من السجل، تبقى الصورة محفوظة هنا.</p>
               </div>
             </div>
          </div>

          {/* Filters Toolbar */}
          <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 mb-6 space-y-3">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <input 
                  type="text" 
                  placeholder="بحث عن اسم المراجع..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 font-bold text-xs outline-none focus:border-emerald-500" 
                />
                <select 
                  value={activeCircle} 
                  onChange={e => setActiveCircle(e.target.value)}
                  className="w-full h-11 px-2 rounded-xl border border-slate-200 font-bold text-xs outline-none focus:border-emerald-500"
                >
                  <option value="ALL">جميع الدوائر</option>
                  {Object.values(CIRCLE_NAMES).map((name, idx) => (
                    <option key={idx} value={Object.keys(CIRCLE_NAMES)[idx]}>{name}</option>
                  ))}
                </select>
                <input 
                   type="date" 
                   value={dateFilter} 
                   onChange={e => setDateFilter(e.target.value)} 
                   className="w-full h-11 px-2 rounded-xl border border-slate-200 font-bold text-xs outline-none focus:border-emerald-500"
                />
                {isAdmin && (
                    <select 
                        value={selectedOffice} 
                        onChange={e => setSelectedOffice(e.target.value)}
                        className="w-full h-11 px-2 rounded-xl border border-slate-200 font-bold text-xs outline-none focus:border-emerald-500"
                    >
                        <option value="ALL">جميع المكاتب</option>
                        {allOfficeUsers.map(u => (
                            <option key={u.id} value={u.office_name}>{u.office_name}</option>
                        ))}
                    </select>
                )}
             </div>
             
             {/* Bulk Actions Bar */}
             <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0} 
                        onChange={toggleSelectAll}
                        className="w-5 h-5 accent-emerald-600 cursor-pointer"
                    />
                    <span className="text-xs font-black text-slate-600">تحديد الكل ({filteredRecords.length})</span>
                </div>
                
                {isSelectionMode && (
                    <div className="flex gap-2">
                        <button onClick={handleBulkDownload} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            تنزيل ({selectedIds.size})
                        </button>
                        <button onClick={handleSend} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                            إرسال
                        </button>
                        <button onClick={handleBulkDelete} className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl font-black text-xs shadow-sm active:scale-95 transition-all">
                            حذف
                        </button>
                    </div>
                )}
             </div>
          </div>

          {isLoadingTrash && <div className="text-center py-4 text-emerald-600 font-bold animate-pulse text-xs">جاري تحديث الأرشيف...</div>}

          {/* Batched Grid */}
          {Object.keys(groupedBatches).length === 0 ? (
            <div className="py-20 text-center">
               <div className="inline-block p-6 bg-slate-50 rounded-full mb-4">
                 <svg className="w-12 h-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
               </div>
               <p className="text-slate-400 font-black text-lg">لا توجد وصولات مطابقة.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(groupedBatches).map(([batchName, rawRecords]) => {
                const batchRecords = rawRecords as OfficeRecord[];
                return (
                <div key={batchName} className="animate-scale-up">
                    <h3 className="text-lg font-black text-slate-800 mb-4 px-2 border-r-4 border-emerald-500 mr-1 flex items-center justify-between">
                        <span>{batchName}</span>
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{batchRecords.length} وصل</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {batchRecords.map(record => (
                        <div 
                            key={record.id} 
                            onClick={() => toggleSelection(record.id)}
                            className={`bg-white border-2 rounded-[2rem] overflow-hidden shadow-sm transition-all group flex flex-col relative cursor-pointer ${selectedIds.has(record.id) ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-100 hover:border-emerald-300'}`}
                        >
                        {/* Selection Overlay */}
                        <div className="absolute top-3 right-3 z-10">
                            <input 
                                type="checkbox" 
                                checked={selectedIds.has(record.id)} 
                                onChange={() => {}} // handled by parent div
                                className="w-5 h-5 accent-emerald-600 shadow-md cursor-pointer"
                            />
                        </div>

                        {/* Image Area */}
                        <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                            <img src={record.bookingImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Booking" />
                            <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent">
                                <p className="text-white text-[10px] font-bold text-center">{CIRCLE_NAMES[record.circleType]}</p>
                            </div>
                        </div>
                        
                        {/* Content Area */}
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
                </div>
              )})}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
