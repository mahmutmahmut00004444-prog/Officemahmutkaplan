
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { CircleType, CIRCLE_NAMES, LoggedInUser, OfficeRecord } from '../types';

interface OfficeSmartListImporterProps {
  onGoBack: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  loggedInUser: LoggedInUser;
  onSuccess: () => void;
}

interface ExtractedMember {
  id: string;
  fullName: string;
  motherName: string;
  dob: string;
  relationship: string;
}

interface ExtractedHead {
  id: string;
  headFullName: string;
  headMotherName: string;
  headDob: string;
  members: ExtractedMember[];
}

export default function OfficeSmartListImporter({ onGoBack, showToast, loggedInUser, onSuccess }: OfficeSmartListImporterProps) {
  const [selectedCircle, setSelectedCircle] = useState<CircleType | ''>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedHead[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    setExtractedData([]); 
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const cleanBase64 = base64Data.split(',')[1];

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = 'gemini-3-flash-preview';
        
        // تم تحديث التعليمات للتعرف على العوائل
        const prompt = `
          You are an expert data entry assistant. Analyze this image of a list (table).
          Your goal is to extract families structure (Head of household and family members).

          **Logic for identifying a Family:**
          1. **Color Grouping:** If rows share the same background color, they belong to the same family. The first one is the Head, others are members.
          2. **Numbering Sequence:** 
             - A row with a number (e.g., 1, 2, 3...) is a **Head of Household**.
             - Rows immediately below it *without* a number (or with a dash/empty) are **Family Members** of that Head.

          **Extraction Fields:**
          - Full Name (name)
          - Mother's Name (mother)
          - Date of Birth (dob) - format YYYY-MM-DD if possible.
          - Relationship (for members): Try to infer from context (e.g., if names match father, put 'Son'/'Daughter', if distinct, put 'Wife'). If unknown, leave empty.

          **Output Format (JSON Only):**
          Return a JSON ARRAY of objects. Each object represents a **Head of Household**.
          Structure:
          [
            {
              "full_name": "Head Name",
              "mother_name": "Mother Name",
              "dob": "DOB",
              "members": [
                 { "full_name": "Member Name", "mother_name": "...", "dob": "...", "relationship": "..." },
                 ...
              ]
            },
            ...
          ]

          Important:
          - Output raw JSON only. No markdown code blocks.
          - Do not include headers.
        `;

        const response = await ai.models.generateContent({
          model: model,
          contents: {
            parts: [
              { inlineData: { mimeType: selectedFile.type, data: cleanBase64 } },
              { text: prompt }
            ]
          }
        });

        let jsonText = response.text || '[]';
        
        // تنظيف الرد
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBracket = jsonText.indexOf('[');
        const lastBracket = jsonText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            jsonText = jsonText.substring(firstBracket, lastBracket + 1);
        }

        try {
          const parsedData = JSON.parse(jsonText);
          if (Array.isArray(parsedData)) {
            const mappedData: ExtractedHead[] = parsedData.map((item: any, index: number) => ({
              id: `head-${Date.now()}-${index}`,
              headFullName: item.full_name || item.name || '',
              headMotherName: item.mother_name || item.mother || '',
              headDob: item.dob || item.birth_date || '',
              members: Array.isArray(item.members) ? item.members.map((m: any, mIdx: number) => ({
                id: `mem-${Date.now()}-${index}-${mIdx}`,
                fullName: m.full_name || m.name || '',
                motherName: m.mother_name || m.mother || '',
                dob: m.dob || m.birth_date || '',
                relationship: m.relationship || 'فرد'
              })) : []
            }));
            
            const validData = mappedData.filter(row => row.headFullName.trim() !== '');
            
            setExtractedData(validData);
            
            if (validData.length === 0) {
                showToast('تم التحليل ولكن لم يتم العثور على بيانات واضحة.', 'error');
            } else {
                const totalHeads = validData.length;
                const totalMembers = validData.reduce((acc, curr) => acc + curr.members.length, 0);
                showToast(`تم استخراج ${totalHeads} عائلة (${totalHeads + totalMembers} شخص) بنجاح.`, 'success');
            }
          } else {
            throw new Error('الرد لم يكن مصفوفة بيانات');
          }
        } catch (parseError) {
          console.error("JSON Parse Error:", parseError, jsonText);
          showToast('فشل قراءة البيانات من الصورة. يرجى التأكد من وضوح الصورة.', 'error');
        }
      };
    } catch (error: any) {
      console.error("AI Error:", error);
      showToast(`حدث خطأ أثناء المعالجة: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setExtractedData([]); 
    }
  };

  const handleUpdateHead = (id: string, field: keyof ExtractedHead, value: string) => {
    setExtractedData(prev => prev.map(head => head.id === id ? { ...head, [field]: value } : head));
  };

  const handleUpdateMember = (headId: string, memberId: string, field: keyof ExtractedMember, value: string) => {
    setExtractedData(prev => prev.map(head => {
      if (head.id === headId) {
        return {
          ...head,
          members: head.members.map(m => m.id === memberId ? { ...m, [field]: value } : m)
        };
      }
      return head;
    }));
  };

  const handleDeleteHead = (id: string) => {
    setExtractedData(prev => prev.filter(head => head.id !== id));
  };

  const handleDeleteMember = (headId: string, memberId: string) => {
    setExtractedData(prev => prev.map(head => {
      if (head.id === headId) {
        return { ...head, members: head.members.filter(m => m.id !== memberId) };
      }
      return head;
    }));
  };

  const handleReset = () => {
    setExtractedData([]);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveToDatabase = async () => {
    if (!selectedCircle) {
      showToast('يرجى اختيار الدائرة قبل الحفظ', 'error');
      return;
    }
    if (extractedData.length === 0) return;

    setIsSaving(true);
    try {
      const currentRecords: OfficeRecord[] = JSON.parse(localStorage.getItem('office_records') || '[]');
      const newRecords: OfficeRecord[] = [...currentRecords];

      // Loop through each family
      for (const head of extractedData) {
        const headId = crypto.randomUUID();
        
        const headRecord: OfficeRecord = {
          id: headId,
          circle_type: selectedCircle as CircleType,
          head_full_name: head.headFullName,
          head_mother_name: head.headMotherName,
          head_dob: head.headDob,
          head_surname: '', 
          head_phone: '', 
          affiliation: loggedInUser.username,
          created_at: new Date().toISOString(),
          office_family_members: head.members.map(m => ({
            id: crypto.randomUUID(),
            office_record_id: headId,
            full_name: m.fullName,
            mother_name: m.motherName,
            dob: m.dob,
            relationship: m.relationship || 'فرد',
            surname: ''
          }))
        };

        newRecords.push(headRecord);
      }

      localStorage.setItem('office_records', JSON.stringify(newRecords));
      showToast('تم حفظ جميع العوائل والأفراد بنجاح!', 'success');
      onSuccess();
    } catch (error: any) {
      console.error("Save Error:", error);
      showToast(`فشل الحفظ: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-40 animate-scale-up">
      <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>

        <div className="pt-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] mb-6 shadow-inner">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">رفع القوائم الذكي (AI)</h2>
          <p className="text-slate-500 font-bold mb-8 max-w-lg mx-auto leading-relaxed">
            استخراج ذكي لبيانات المراجعين مع التعرف التلقائي على رب الأسرة والأفراد (حسب اللون أو التسلسل).
          </p>

          <div className="max-w-lg mx-auto mb-8 bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-200 relative">
             {loading && (
               <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-[2rem]">
                 <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                 <p className="text-emerald-700 font-black animate-pulse text-lg">جاري استخراج العوائل...</p>
                 <p className="text-xs text-slate-400 font-bold mt-2">يتم تحليل الألوان والتسلسل بدقة</p>
               </div>
             )}

             <div className="space-y-4">
               <div>
                 <label className="block text-right text-sm font-black text-slate-800 mb-2 mr-1">
                   1. اختر الدائرة:
                 </label>
                 <select 
                   value={selectedCircle} 
                   onChange={(e) => setSelectedCircle(e.target.value as CircleType)} 
                   disabled={loading}
                   className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-sm outline-none focus:border-emerald-500 transition-all text-center disabled:opacity-50"
                 >
                   <option value="">-- اضغط لاختيار الدائرة --</option>
                   {Object.values(CircleType).map(t => (
                     <option key={t} value={t}>{CIRCLE_NAMES[t]}</option>
                   ))}
                 </select>
               </div>

               <div>
                 <label className="block text-right text-sm font-black text-slate-800 mb-2 mr-1">
                   2. اختر صورة القائمة:
                 </label>
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleFileSelect} 
                   accept="image/*" 
                   className="hidden" 
                 />
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   disabled={loading}
                   className={`w-full py-4 px-6 rounded-2xl border-2 border-dashed font-bold transition-all flex items-center justify-center gap-3 ${selectedFile ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-500 hover:border-emerald-400 hover:bg-slate-100'}`}
                 >
                   {selectedFile ? (
                     <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                        <span className="text-[10px] bg-emerald-200 px-2 py-0.5 rounded-full text-emerald-800">تغيير</span>
                     </>
                   ) : (
                     <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <span>اضغط لاختيار الصورة من الاستوديو</span>
                     </>
                   )}
                 </button>
               </div>

               <button 
                 onClick={processImage}
                 disabled={loading || !selectedCircle || !selectedFile}
                 className={`w-full py-5 rounded-[1.5rem] font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 mt-4 ${!selectedCircle || !selectedFile ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-emerald-600 active:scale-95'}`}
               >
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 12h5"/><path d="M17 12h5"/><path d="M12 2v5"/><path d="M12 17v5"/><path d="m15 15 3 3"/><path d="m6 6 3 3"/><path d="m6 18 3-3"/><path d="m15 9 3-3"/><circle cx="12" cy="12" r="3"/></svg>
                 <span>استخراج المعلومات</span>
               </button>
               
               {!selectedCircle && <p className="text-[10px] text-red-500 font-bold text-center">🛑 يرجى اختيار الدائرة أولاً</p>}
               {selectedCircle && !selectedFile && <p className="text-[10px] text-red-500 font-bold text-center">🛑 يرجى اختيار الصورة</p>}
             </div>
          </div>
        </div>
      </div>

      {/* عرض الجدول فقط إذا كانت هناك بيانات */}
      {extractedData.length > 0 && (
        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl animate-scale-up">
          <div className="flex items-center justify-between mb-6 px-2 border-b border-slate-100 pb-4">
            <div>
               <h3 className="text-xl font-black text-slate-900">البيانات المستخرجة ({extractedData.length} عائلة)</h3>
               <p className="text-xs font-bold text-emerald-600 mt-1">الدائرة: {selectedCircle ? CIRCLE_NAMES[selectedCircle as CircleType] : '-'}</p>
            </div>
            <span className="text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-full shadow-md animate-pulse">يرجى المراجعة قبل الحفظ</span>
          </div>

          <div className="table-container rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-8 max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-right bg-white relative">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-900 text-white border-b border-slate-200">
                  <th className="p-4 text-xs font-black w-12 text-center">#</th>
                  <th className="p-4 text-xs font-black w-16">الصفة</th>
                  <th className="p-4 text-xs font-black">الاسم الكامل</th>
                  <th className="p-4 text-xs font-black">اسم الأم</th>
                  <th className="p-4 text-xs font-black">المواليد</th>
                  <th className="p-4 text-xs font-black w-16 text-center">حذف</th>
                </tr>
              </thead>
              <tbody>
                {extractedData.map((head, hIdx) => (
                  <React.Fragment key={head.id}>
                    {/* Head Row */}
                    <tr className="border-b border-slate-200 bg-emerald-50/50 hover:bg-emerald-100 transition-colors">
                      <td className="p-4 text-center text-xs font-black text-emerald-800">{hIdx + 1}</td>
                      <td className="p-2"><span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-lg">رب أسرة</span></td>
                      <td className="p-2">
                        <input 
                          type="text" 
                          value={head.headFullName} 
                          onChange={(e) => handleUpdateHead(head.id, 'headFullName', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-emerald-500 outline-none font-black text-sm text-slate-900 py-2 px-1"
                          placeholder="اسم رب الأسرة"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="text" 
                          value={head.headMotherName} 
                          onChange={(e) => handleUpdateHead(head.id, 'headMotherName', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-emerald-500 outline-none font-bold text-sm text-slate-800 py-2 px-1"
                          placeholder="اسم الأم"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="text" 
                          value={head.headDob} 
                          onChange={(e) => handleUpdateHead(head.id, 'headDob', e.target.value)}
                          className="w-full bg-transparent border-b border-transparent focus:border-emerald-500 outline-none font-bold text-sm text-slate-800 py-2 px-1 text-left"
                          dir="ltr"
                          placeholder="YYYY-MM-DD"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => handleDeleteHead(head.id)}
                          className="p-2 text-red-300 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                          title="حذف العائلة بالكامل"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </td>
                    </tr>

                    {/* Members Rows */}
                    {head.members.map((member, mIdx) => (
                      <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-center text-xs text-slate-300 border-r-2 border-emerald-100"></td>
                        <td className="p-2">
                           <input 
                            type="text" 
                            value={member.relationship} 
                            onChange={(e) => handleUpdateMember(head.id, member.id, 'relationship', e.target.value)}
                            className="w-20 bg-slate-100 rounded px-2 py-1 text-[10px] font-bold text-slate-600 border-transparent focus:bg-white focus:border-blue-400 outline-none"
                            placeholder="الصلة"
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                            <input 
                              type="text" 
                              value={member.fullName} 
                              onChange={(e) => handleUpdateMember(head.id, member.id, 'fullName', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-bold text-xs text-slate-600 py-2 px-1"
                              placeholder="اسم الفرد"
                            />
                          </div>
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={member.motherName} 
                            onChange={(e) => handleUpdateMember(head.id, member.id, 'motherName', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-bold text-xs text-slate-500 py-2 px-1"
                            placeholder="اسم الأم"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={member.dob} 
                            onChange={(e) => handleUpdateMember(head.id, member.id, 'dob', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none font-bold text-xs text-slate-500 py-2 px-1 text-left"
                            dir="ltr"
                            placeholder="YYYY-MM-DD"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button 
                            onClick={() => handleDeleteMember(head.id, member.id)}
                            className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                            title="حذف الفرد"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-4 pt-2">
            <button 
              onClick={handleSaveToDatabase}
              disabled={isSaving}
              className="flex-1 bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>جاري حفظ العوائل...</span>
                </>
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  <span>حفظ العوائل في السجل</span>
                </>
              )}
            </button>
            <button 
              onClick={handleReset}
              disabled={isSaving}
              className="flex-1 bg-red-50 text-red-600 border-2 border-red-100 py-5 rounded-2xl font-black text-lg active:scale-95 transition-all hover:bg-red-100 flex items-center justify-center gap-2"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <span>إلغاء وحذف النتائج</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
