
import React, { useState, useMemo } from 'react';
import { Reviewer, OfficeRecord, CIRCLE_NAMES, CircleType } from '../types';

interface BookingAlbumProps {
  reviewers: Reviewer[];
  officeRecords: OfficeRecord[];
  onGoBack: () => void;
}

export default function BookingAlbum({ reviewers, officeRecords, onGoBack }: BookingAlbumProps) {
  const [activeCircle, setActiveCircle] = useState<string>('ALL');
  const [bookingDateFilter, setBookingDateFilter] = useState('');
  const [creationDateFilter, setCreationDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const allBooked = useMemo(() => {
    return [...reviewers, ...officeRecords]
      .filter(r => !!r.bookingImage)
      // تم تغيير الترتيب هنا ليكون الأقدم في الأعلى (تصاعدي)
      .sort((a, b) => (a.bookingCreatedAt || a.createdAt || 0) - (b.bookingCreatedAt || b.createdAt || 0));
  }, [reviewers, officeRecords]);

  const filteredItems = useMemo(() => {
    let result = allBooked;
    if (activeCircle !== 'ALL') result = result.filter(r => r.circleType === activeCircle);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.headFullName.toLowerCase().includes(q));
    }
    if (bookingDateFilter) result = result.filter(r => r.bookingDate === bookingDateFilter);
    if (creationDateFilter) {
      result = result.filter(r => {
        if (!r.bookingCreatedAt) return false;
        return new Date(r.bookingCreatedAt).toLocaleDateString('en-CA') === creationDateFilter;
      });
    }
    return result;
  }, [allBooked, activeCircle, searchQuery, bookingDateFilter, creationDateFilter]);

  const downloadImage = (base64: string, name: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = `حجز_${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-40 animate-scale-up">
      {previewImage && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/95 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl border-2 border-white" />
        </div>
      )}

      <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative">
        <div className="absolute top-0 right-0 p-4"><button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg></button></div>
        
        <div className="pt-8">
          <h2 className="text-3xl font-black text-slate-900 mb-2">ألبوم صور الحجوزات</h2>
          <p className="text-slate-500 font-bold mb-8">استعراض وتحميل كافة صور الحجوزات بشكل منظم</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 shadow-inner">
             <input type="text" placeholder="بحث بالاسم..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="p-4 rounded-xl border border-slate-200 font-bold text-sm" />
             <div className="flex flex-col"><label className="text-[10px] font-black text-slate-400 mr-2">تاريخ الحجز</label><input type="date" value={bookingDateFilter} onChange={e => setBookingDateFilter(e.target.value)} className="p-4 rounded-xl border border-slate-200 font-black text-sm" /></div>
             <div className="flex flex-col"><label className="text-[10px] font-black text-slate-400 mr-2">تاريخ الإنشاء</label><input type="date" value={creationDateFilter} onChange={e => setCreationDateFilter(e.target.value)} className="p-4 rounded-xl border border-slate-200 font-black text-sm" /></div>
             <button onClick={() => { setSearchQuery(''); setBookingDateFilter(''); setCreationDateFilter(''); setActiveCircle('ALL'); }} className="h-full bg-slate-200 text-slate-600 rounded-xl font-black text-sm self-end">تفريغ الفلاتر</button>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            <button onClick={() => setActiveCircle('ALL')} className={`px-6 py-3 rounded-xl font-black text-xs transition-all ${activeCircle === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>الكل ({allBooked.length})</button>
            {Object.values(CircleType).map(t => {
              const count = allBooked.filter(r => r.circleType === t).length;
              if (count === 0) return null;
              return <button key={t} onClick={() => setActiveCircle(t)} className={`px-6 py-3 rounded-xl font-black text-xs transition-all ${activeCircle === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{CIRCLE_NAMES[t]} ({count})</button>
            })}
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-40 text-center text-slate-300 font-black text-2xl italic">لا توجد صور حجوزات مطابقة.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map(r => (
                <div key={r.id} className="bg-white border-2 border-slate-100 rounded-3xl overflow-hidden shadow-md group hover:border-blue-600 transition-all">
                  <div className="relative aspect-[3/4] cursor-pointer overflow-hidden" onClick={() => setPreviewImage(r.bookingImage!)}>
                    <img src={r.bookingImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={r.headFullName} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                       <p className="text-white text-xs font-black">اضغط للتكبير</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h4 className="font-black text-slate-900 truncate text-[13px]">{r.headFullName}</h4>
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span>{CIRCLE_NAMES[r.circleType]}</span>
                      <span>{r.bookingDate}</span>
                    </div>
                    <button onClick={() => downloadImage(r.bookingImage!, r.headFullName)} className="w-full py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all mt-2">
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                       تنزيل الصورة
                    </button>
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
