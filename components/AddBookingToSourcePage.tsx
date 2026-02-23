
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
    <div className="max-w-7xl mx-auto pb-40 animate-scale-up space-y-6">
      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600"></div>
        
        <div className="absolute top-0 right-0 p-4 z-10">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-10 pt-4">
           <h3 className="text-3xl font-black text-slate-900 mb-1">إضافة حجوزات مكتملة</h3>
           <p className="text-blue-600 font-bold flex items-center gap-2">المصدر الحالي: {source.sourceName}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div onClick={() => !loading && fileInputRef.current?.click()} className="p-12 border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center gap-5 cursor-pointer hover:border-emerald-600 hover:bg-emerald-50 transition-all shadow-inner group">
            <input type="file" multiple hidden ref={fileInputRef} accept="image/*" onChange={e => e.target.files && processImages(e.target.files)} />
            <div className="w-24 h-24 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 13 7 8"/><line x1="12" x2="12" y1="13" y2="1"/></svg></div>
            <div className="text-center"><span className="text-2xl font-black text-slate-800 block">رفع صور الحجوزات</span><p className="text-slate-400 font-bold mt-1">مطابقة بالاسم الثلاثي والدائرة</p></div>
          </div>
          <div onClick={() => setShowManualSearch(!showManualSearch)} className={`p-12 border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center gap-5 cursor-pointer transition-all group ${showManualSearch ? 'bg-blue-50 border-blue-600 shadow-lg' : 'hover:border-blue-600 hover:bg-blue-50 shadow-inner'}`}>
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
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
              <h4 className="text-2xl font-black text-slate-900">النتائج الجاهزة ({results.length})</h4>
              <button onClick={() => setResults([])} className="text-red-500 font-bold hover:underline">مسح الكل</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((item, i) => (
                <div key={i} className="p-5 rounded-[2rem] bg-emerald-50 border-2 border-emerald-200 flex gap-4 items-center shadow-sm">
                  {item.image ? (
                    <img src={item.image} className="w-20 h-20 rounded-2xl object-cover border border-white shadow-md" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-emerald-200 flex items-center justify-center text-emerald-800 text-2xl">📝</div>
                  )}
                  <div className="flex-1">
                    <p className="font-black text-slate-900 text-lg">{item.record.headFullName}</p>
                    <p className="text-xs font-bold text-emerald-700 mt-1">{CIRCLE_NAMES[item.record.circleType]} | {item.date}</p>
                  </div>
                  <button onClick={() => setResults(prev => prev.filter((_, idx) => idx !== i))} className="w-10 h-10 bg-white text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors shadow-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={handleConfirmAndTransfer} disabled={loading} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300 hover:bg-emerald-600 active:scale-95 transition-all">
              {loading ? 'جاري الحفظ...' : 'تأكيد ونقل الكل للمكتملة'}
            </button>
          </div>
        )}

        {failedRecognitions.length > 0 && (
          <div className="mt-12 pt-8 border-t-2 border-red-100">
            <h4 className="text-xl font-black text-red-600 mb-4">فشل التعرف ({failedRecognitions.length})</h4>
            <div className="grid grid-cols-1 gap-4">
              {failedRecognitions.map((fail, i) => (
                <div key={i} className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-4 items-center">
                  <img src={fail.imageData} className="w-16 h-16 rounded-xl object-cover grayscale" />
                  <div>
                    <p className="text-xs font-bold text-red-800">{fail.reason}</p>
                    <p className="text-[10px] text-red-400 mt-1">{fail.fileName}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setFailedRecognitions([])} className="mt-4 text-xs font-bold text-slate-400 hover:text-slate-600">تجاهل ومسح القائمة</button>
          </div>
        )}
      </div>
    </div>
  );
}
