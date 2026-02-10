
import React, { useState, useRef, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BookingSource, Reviewer, OfficeRecord, CIRCLE_NAMES, CircleType } from '../types';

interface AddBookingToSourcePageProps {
  onGoBack: () => void;
  source: BookingSource;
  allReviewers: Reviewer[];
  allOfficeRecords: OfficeRecord[];
  onBookReviewer: (reviewerId: string, sourceId: string, imageData: string | null, date: string | null) => Promise<void>;
  onBookOfficeRecord: (officeRecordId: string, sourceId: string, imageData: string | null, date: string | null) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
}

interface FailedRecognition {
  fileName: string;
  imageData: string;
  reason: string;
}

interface PendingBooking {
  type: 'reviewer' | 'office';
  record: any;
  image: string | null;
  date: string;
}

export default function AddBookingToSourcePage({ onGoBack, source, allReviewers, allOfficeRecords, onBookReviewer, onBookOfficeRecord, showToast }: AddBookingToSourcePageProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PendingBooking[]>([]);
  const [failedRecognitions, setFailedRecognitions] = useState<FailedRecognition[]>([]);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [showManualSearch, setShowManualSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // وظيفة متطورة لتنظيف النصوص العربية ومعالجة الاختلافات الإملائية
  const normalizeArabic = (str: string) => {
    if (!str) return '';
    return str
      .trim()
      .replace(/[\u064B-\u065F]/g, "") // إزالة التشكيل
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ")
      .replace(/[^\u0621-\u064A\s]/g, ""); // إزالة أي رموز غير عربية
  };

  // تحويل نص الدائرة المستخرج إلى كود الدائرة
  const mapExtractedCircle = (text: string): CircleType | null => {
    const norm = normalizeArabic(text);
    if (norm.includes("ايمن")) return CircleType.RIGHT_MOSUL;
    if (norm.includes("ايسر")) return CircleType.LEFT_MOSUL;
    if (norm.includes("حمام")) return CircleType.HAMMAM_ALALIL;
    if (norm.includes("شوره")) return CircleType.ALSHOURA;
    if (norm.includes("بعاج")) return CircleType.BAAJ;
    return null; // سيتم البحث في "أخرى" كخيار أخير إذا لم يطابق
  };

  const findMatch = (extractedName: string, extractedCircleText: string) => {
    const normalizedExtractedName = normalizeArabic(extractedName);
    const extractedParts = normalizedExtractedName.split(' ');
    const extractedCircle = mapExtractedCircle(extractedCircleText);

    // نحتاج على الأقل لاسم ثلاثي للمطابقة الدقيقة
    if (extractedParts.length < 3) return null;

    const extractedTriple = extractedParts.slice(0, 3).join(' ');

    return [...allReviewers, ...allOfficeRecords].find(r => {
      if (r.isBooked || r.isArchived) return false; 
      
      const normalizedRecordName = normalizeArabic(r.headFullName);
      const recordParts = normalizedRecordName.split(' ');
      const recordTriple = recordParts.slice(0, 3).join(' ');

      // الشرط: تطابق الاسم الثلاثي وتطابق الدائرة
      const isNameMatch = recordTriple === extractedTriple;
      const isCircleMatch = extractedCircle ? r.circleType === extractedCircle : true; // إذا لم تكتشف الدائرة بوضوح، نعتمد على الاسم فقط

      return isNameMatch && isCircleMatch;
    });
  };

  const processImages = async (files: FileList) => {
    setLoading(true);
    const newResults: PendingBooking[] = [];
    const newFailed: FailedRecognition[] = [];
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          try {
            const resp = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              config: { responseMimeType: "application/json" },
              contents: { 
                parts: [
                  { inlineData: { mimeType: file.type, data: base64.split(',')[1] } }, 
                  { text: "Extract: 1. Full name (name). 2. Department or Circle name (circle) like 'موصل الأيمن' or 'البعاج'. 3. Booking date (date) as YYYY-MM-DD. Respond in JSON only." }
                ] 
              }
            });
            
            // FIX: Sanitize the response text to remove potential Markdown code blocks
            let jsonText = resp.text || '{}';
            jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
            const res = JSON.parse(jsonText);
            
            const match = findMatch(res.name || '', res.circle || '');

            if (match) {
              if (!results.some(item => item.record.id === match.id) && !newResults.some(item => item.record.id === match.id)) {
                newResults.push({ 
                  type: allReviewers.some(x => x.id === match.id) ? 'reviewer' : 'office', 
                  record: match, 
                  image: base64, 
                  date: res.date || new Date().toISOString().split('T')[0]
                });
              }
            } else {
              newFailed.push({ 
                fileName: file.name, 
                imageData: base64, 
                reason: `لم يتم العثور على سجل مطابق للاسم الثلاثي "${res.name || 'غير واضح'}" والدائرة "${res.circle || 'غير واضحة'}"` 
              });
            }
          } catch (e) {
            newFailed.push({ fileName: file.name, imageData: base64, reason: 'فشل في تحليل الصورة' });
          }
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    }
    
    setResults(prev => [...prev, ...newResults]);
    setFailedRecognitions(prev => [...prev, ...newFailed]);
    setLoading(false);
    if (newResults.length > 0) showToast(`تم التعرف على ${newResults.length} حجز بنجاح`, 'success');
  };

  const manualSearchResults = useMemo(() => {
    if (!manualSearchQuery.trim()) return [];
    const q = normalizeArabic(manualSearchQuery);
    return [...allReviewers, ...allOfficeRecords]
      .filter(r => !r.isBooked && !r.isArchived && !results.some(p => p.record.id === r.id))
      .filter(r => normalizeArabic(r.headFullName).includes(q))
      .slice(0, 8);
  }, [manualSearchQuery, allReviewers, allOfficeRecords, results]);

  const addManualBooking = (record: any) => {
    setResults(prev => [...prev, {
      type: allReviewers.some(r => r.id === record.id) ? 'reviewer' : 'office',
      record,
      image: null,
      date: new Date().toISOString().split('T')[0]
    }]);
    setManualSearchQuery('');
    showToast('أضيف لقائمة التأكيد', 'success');
  };

  const handleConfirmAndTransfer = async () => {
    if (results.length === 0) return;
    setLoading(true);
    try {
      for (const item of results) {
        if (item.type === 'reviewer') {
          await onBookReviewer(item.record.id, source.id, item.image, item.date);
        } else {
          await onBookOfficeRecord(item.record.id, source.id, item.image, item.date);
        }
      }
      showToast('تم النقل بنجاح واحتساب الرصيد للمصدر', 'success');
      onGoBack();
    } catch (e) { showToast('خطأ في الحفظ النهائي', 'error'); }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto pb-40 animate-scale-up space-y-6">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600"></div>
        <div className="flex items-center justify-between mb-10 pt-4">
           <div>
              <h3 className="text-3xl font-black text-slate-900 mb-1">إضافة حجوزات مكتملة</h3>
              <p className="text-blue-600 font-bold flex items-center gap-2">المصدر الحالي: {source.sourceName}</p>
           </div>
           <button onClick={onGoBack} className="p-4 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div onClick={() => !loading && fileInputRef.current?.click()} className="p-12 border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center gap-5 cursor-pointer hover:border-emerald-600 hover:bg-emerald-50 transition-all shadow-inner">
            <input type="file" multiple hidden ref={fileInputRef} accept="image/*" onChange={e => e.target.files && processImages(e.target.files)} />
            <div className="w-24 h-24 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 13 7 8"/><line x1="12" x2="12" y1="13" y2="1"/></svg></div>
            <div className="text-center"><span className="text-2xl font-black text-slate-800 block">رفع صور الحجوزات</span><p className="text-slate-400 font-bold mt-1">مطابقة بالاسم الثلاثي والدائرة</p></div>
          </div>
          <div onClick={() => setShowManualSearch(!showManualSearch)} className={`p-12 border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center gap-5 cursor-pointer transition-all ${showManualSearch ? 'bg-blue-50 border-blue-600 shadow-lg' : 'hover:border-blue-600 hover:bg-blue-50 shadow-inner'}`}>
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
            <div className="text-center"><span className="text-2xl font-black text-slate-800 block">بحث وإضافة يدوية</span><p className="text-slate-400 font-bold mt-1">اختيار مباشر من قاعدة البيانات</p></div>
          </div>
        </div>

        {showManualSearch && (
          <div className="mb-10 p-8 bg-blue-50 rounded-[3rem] border-2 border-blue-200 animate-scale-up">
            <input autoFocus type="text" placeholder="ابحث بالاسم..." className="w-full p-6 bg-white border-2 border-blue-100 rounded-[2rem] font-black text-xl outline-none focus:border-blue-600 shadow-md" value={manualSearchQuery} onChange={e => setManualSearchQuery(e.target.value)} />
            <div className="mt-8 space-y-3">
              {manualSearchResults.map(r => (
                <button key={r.id} onClick={() => addManualBooking(r)} className="w-full p-5 bg-white hover:bg-blue-600 hover:text-white rounded-[1.5rem] flex items-center justify-between transition-all font-black group shadow-sm text-right">
                  <div>
                    <p className="text-lg">{r.headFullName}</p>
                    <p className="text-[10px] opacity-70 font-bold">{CIRCLE_NAMES[r.circleType]} | {'affiliation' in r ? r.affiliation : 'سجل محمود قبلان'}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14m-7-7v14"/></svg></div>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-8 animate-scale-up pt-8 border-t-2 border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-2xl font-black text-slate-800">الحجوزات الجاهزة ({results.length})</h4>
              <button onClick={() => setResults([])} className="text-slate-400 font-bold text-sm hover:text-red-500">إلغاء الكل</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((res, i) => (
                <div key={i} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 flex items-center gap-6 shadow-sm hover:border-emerald-400 transition-all group">
                  <div className="relative w-20 h-20 shrink-0 bg-slate-50 rounded-2xl flex items-center justify-center border-2 border-slate-100 overflow-hidden shadow-inner">
                    {res.image ? <img src={res.image} className="w-full h-full object-cover" /> : <div className="text-slate-200 text-3xl">⌨️</div>}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-black text-slate-900 text-base truncate">{res.record.headFullName}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">{CIRCLE_NAMES[res.record.circleType]}</span>
                      <span className="text-[10px] font-black text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 italic">{res.date}</span>
                    </div>
                  </div>
                  <button onClick={() => setResults(prev => prev.filter((_, idx) => idx !== i))} className="text-red-300 p-3 hover:text-red-600 transition-all"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </div>
              ))}
            </div>
            <div className="pt-6">
              <button onClick={handleConfirmAndTransfer} disabled={results.length === 0 || loading} className="w-full bg-slate-900 text-white py-7 rounded-[2rem] font-black text-2xl shadow-2xl hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-4">
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري الحفظ والنقل...</span>
                  </div>
                ) : "تأكيد الحجز ونقل السجلات للمكتملة"}
              </button>
            </div>
          </div>
        )}

        {failedRecognitions.length > 0 && (
          <div className="mt-12 p-8 bg-red-50 rounded-[3rem] border-2 border-red-100 border-dashed">
             <h4 className="text-red-600 font-black mb-6 flex items-center gap-3 text-lg"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> صور لم يتم التعرف عليها أو لا يوجد سجل مطابق ({failedRecognitions.length})</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {failedRecognitions.map((fail, i) => (
                 <div key={i} className="bg-white p-4 rounded-2xl border border-red-100 flex gap-4 items-center shadow-sm opacity-80">
                    <img src={fail.imageData} className="w-16 h-16 rounded-xl object-cover grayscale" />
                    <div className="overflow-hidden"><p className="text-xs font-black text-slate-800 truncate">{fail.fileName}</p><p className="text-[10px] font-bold text-red-500 mt-1 leading-tight">{fail.reason}</p></div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
