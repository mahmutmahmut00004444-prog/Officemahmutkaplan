
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { Reviewer, OfficeRecord, ProcessingLog } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface SmartReaderProps {
  reviewers: Reviewer[];
  officeRecords: OfficeRecord[];
  onAutoAttach: (reviewerId: string, imageData: string, bookingDate: string) => void;
  onAutoAttachOffice: (officeId: string, imageData: string, bookingDate: string) => void;
  onGoBack: () => void;
}

const SmartReader: React.FC<SmartReaderProps> = ({ reviewers, officeRecords, onAutoAttach, onAutoAttachOffice, onGoBack }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<ProcessingLog[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeString = (str: string) => str?.trim().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه') || '';

  const processImage = async (file: File, dateKey: string): Promise<ProcessingLog> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const cleanBase64 = base64Data.split(',')[1];
        
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            config: { responseMimeType: "application/json" },
            contents: {
              parts: [
                { inlineData: { mimeType: file.type, data: cleanBase64 } },
                { text: "Extract the following data from the 'National Card Booking' image: 1. Full Name (name) 2. Booking Date (booking_date) strictly in YYYY-MM-DD format (e.g., if image says 2026/02/16, output 2026-02-16). Respond in JSON only." }
              ]
            }
          });

          // FIX: Sanitize the response text to remove potential Markdown code blocks
          let jsonText = response.text || '{}';
          jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
          
          const data = JSON.parse(jsonText);
          const extractedName = data.name || 'غير معروف';
          const extractedDate = data.booking_date || '';
          
          const normalizedExtracted = normalizeString(extractedName);
          let match: any = reviewers.find(r => !r.isBooked && !r.isArchived && (normalizeString(r.headFullName).includes(normalizedExtracted) || normalizedExtracted.includes(normalizeString(r.headFullName))));
          let tableType: any = match ? 'REVIEWERS' : 'NONE';

          if (!match) {
             match = officeRecords.find(o => !o.isBooked && !o.isArchived && (normalizeString(o.headFullName).includes(normalizedExtracted) || normalizedExtracted.includes(normalizeString(o.headFullName))));
             tableType = match ? 'OFFICES' : 'NONE';
          }

          if (match) {
            if (tableType === 'REVIEWERS') onAutoAttach(match.id, base64Data, extractedDate);
            else onAutoAttachOffice(match.id, base64Data, extractedDate);
          }
          
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            fileName: file.name,
            extractedName,
            extractedDate,
            targetTableType: tableType,
            matchedName: match?.headFullName || '',
            status: match ? 'success' : 'fail',
            imageData: base64Data,
            dateKey
          });

        } catch (err) {
          resolve({ id: 'err', timestamp: Date.now(), fileName: file.name, extractedName: 'خطأ في التحليل', targetTableType: 'NONE', matchedName: '', status: 'fail', imageData: base64Data, dateKey });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoading(true);
    const dateKey = new Date().toLocaleDateString('en-CA');
    const logs = [];
    for (let i = 0; i < files.length; i++) {
      const log = await processImage(files[i], dateKey);
      logs.push(log);
      setProgress(Math.round(((i + 1) / files.length) * 100));
      
      if (isSupabaseConfigured) {
        await supabase.from('processing_logs').insert({
          file_name: log.fileName, extracted_name: log.extractedName, extracted_date: log.extractedDate,
          target_table_type: log.targetTableType, matched_name: log.matchedName, status: log.status,
          image_data: log.imageData, date_key: log.dateKey
        });
      }
    }
    setHistory(prev => [...logs, ...prev]);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-40 animate-scale-up">
      <div className="bg-white p-8 md:p-12 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4"><button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg></button></div>
        
        <div className="text-center pt-8">
          <h2 className="text-3xl font-black text-slate-900">القارئ الذكي (تجهيز ونقل)</h2>
          <p className="text-slate-500 font-bold mb-10 italic">ارفع صور الحجز ليتم ربطها بالمراجعين فوراً ونقلهم للحجوزات المكتملة</p>
          
          <input type="file" multiple hidden ref={fileInputRef} onChange={handleFiles} accept="image/*" />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={loading} 
            className={`w-full py-20 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all ${loading ? 'bg-slate-50 border-blue-300 opacity-70' : 'bg-blue-50/20 border-blue-200 hover:border-blue-600 hover:bg-blue-50 group'}`}
          >
            {loading ? (
              <>
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xl font-black text-blue-700">جاري معالجة الصور ({progress}%)</span>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 13 7 8"/><line x1="12" x2="12" y1="13" y2="1"/></svg></div>
                <span className="text-2xl font-black text-slate-800">اضغط لرفع صور الحجوزات</span>
                <p className="text-slate-400 font-bold text-sm">يدعم سحب الاسم وتاريخ الموعد ونقله للمكتملة</p>
              </>
            )}
          </button>
        </div>

        {history.length > 0 && (
          <div className="mt-12 space-y-6">
             <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                <h3 className="text-xl font-black text-slate-900">نتائج المعالجة الأخيرة</h3>
                <button onClick={() => setHistory([])} className="text-slate-400 font-bold text-xs hover:text-red-500 transition-colors">مسح السجل</button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {history.map((log) => (
                 <div key={log.id} className={`p-5 rounded-2xl border-2 flex gap-4 items-center transition-all ${log.status === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-white shadow-sm shrink-0">
                       <img src={log.imageData} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                       <p className="text-[10px] font-black text-slate-400 truncate">{log.fileName}</p>
                       <p className={`font-black text-sm truncate ${log.status === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{log.status === 'success' ? `تم ربط: ${log.matchedName}` : `لم يتم التعرف على: ${log.extractedName}`}</p>
                       <p className="text-[9px] font-bold text-slate-500 italic mt-1">تاريخ الحجز المستخرج: {log.extractedDate || 'غير متوفر'}</p>
                    </div>
                    {log.status === 'success' && (
                       <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg></div>
                    )}
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default SmartReader;
