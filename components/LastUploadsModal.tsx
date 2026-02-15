
import React, { useState, useMemo } from 'react';
import { Reviewer, BookingSource, CIRCLE_NAMES, OfficeRecord } from '../types';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface LastUploadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewers: (Reviewer | OfficeRecord)[];
  bookingSources: BookingSource[];
  onCancelUpload: (id: string, sourceId: string | null) => Promise<void>;
  formatCurrency: (amount: number | string | undefined) => string;
}

const LastUploadsModal: React.FC<LastUploadsModalProps> = ({
  isOpen,
  onClose,
  reviewers,
  bookingSources,
  onCancelUpload,
  formatCurrency
}) => {
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  // Filter only uploaded reviewers/records
  const uploadedRecords = useMemo(() => {
    let list = reviewers.filter(r => r.isUploaded);
    
    if (selectedSource !== 'ALL') {
      if (selectedSource === 'MANUAL') {
        list = list.filter(r => !r.uploadedSourceId);
      } else {
        list = list.filter(r => r.uploadedSourceId === selectedSource);
      }
    }
    // Sort by most recently created/modified (proxy for upload time if not tracked)
    return list.sort((a, b) => (b.bookingCreatedAt || b.createdAt) - (a.bookingCreatedAt || a.createdAt));
  }, [reviewers, selectedSource]);

  const bookingSourcesMap = useMemo(() => new Map(bookingSources.map(s => [s.id, s.sourceName])), [bookingSources]);

  const handleExportPDF = async () => {
    if (uploadedRecords.length === 0) return;
    setIsExporting(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const MAX_ROWS_PER_PAGE = 25;
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB');

      const tableStyle = "width: 100%; border-collapse: collapse; direction: rtl; font-family: 'Cairo', sans-serif; border: 2.5px solid #000; background-color: #ffffff; margin: 0 auto;";
      const thStyle = "border: 2px solid #000; padding: 10px 4px; font-size: 11px; background: #000000; color: white; font-weight: 900; text-align: center;";
      const tdStyle = "border: 1.5px solid #000; padding: 6px 4px; font-size: 10px; color: #000; text-align: center; font-weight: 900; background-color: #ffffff;";
      const tdRightStyle = tdStyle + " text-align: right; padding-right: 8px;";

      const headerHtmlStr = `<tr>
        <th style="${thStyle}; width: 30px;">ت</th>
        <th style="${thStyle}; width: 100px;">الدائرة</th>
        <th style="${thStyle}; width: 200px;">الاسم الكامل</th>
        <th style="${thStyle}; width: 100px;">اللقب</th>
        <th style="${thStyle}; width: 150px;">اسم الأم</th>
        <th style="${thStyle}; width: 100px;">التولد</th>
        <th style="${thStyle}; width: 120px;">جهة الرفع</th>
      </tr>`;

      const pages: (Reviewer | OfficeRecord)[][] = [[]];
      let currentRowCount = 0;
      uploadedRecords.forEach(record => {
        const familySize = 1; 
        if (currentRowCount + familySize > MAX_ROWS_PER_PAGE && currentRowCount > 0) {
          pages.push([record]);
          currentRowCount = familySize;
        } else {
          pages[pages.length - 1].push(record);
          currentRowCount += familySize;
        }
      });

      for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        if (pIdx > 0) pdf.addPage();
        const chunk = pages[pIdx];
        const pageDiv = document.createElement('div');
        pageDiv.dir = "rtl";
        pageDiv.style.position = "absolute";
        pageDiv.style.left = "-10000px";
        pageDiv.style.top = "0";
        pageDiv.style.width = "800px"; 
        pageDiv.style.padding = "30px";
        pageDiv.style.backgroundColor = "#ffffff";
        
        let globalStartIdx = 1;
        for(let k=0; k<pIdx; k++) globalStartIdx += pages[k].length;

        const bodyHtml = chunk.map((r, idx) => {
          const globalIdx = globalStartIdx + idx;
          const sourceName = r.uploadedSourceId ? bookingSourcesMap.get(r.uploadedSourceId) : 'رفع يدوي (عام)';
          const officeName = 'affiliation' in r ? ` (${r.affiliation})` : '';

          return `<tr>
            <td style="${tdStyle}">${globalIdx}</td>
            <td style="${tdStyle}">${CIRCLE_NAMES[r.circleType]}</td>
            <td style="${tdRightStyle}">${r.headFullName}${officeName ? `<br/><span style="color:#666;font-size:8px;">${officeName}</span>` : ''}</td>
            <td style="${tdStyle}">${r.headSurname || '—'}</td>
            <td style="${tdRightStyle}">${r.headMotherName}</td>
            <td style="${tdStyle}">${r.headDob}</td>
            <td style="${tdStyle}">${sourceName}</td>
          </tr>`;
        }).join('');

        pageDiv.innerHTML = `
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="font-size: 22px; font-weight: 900; margin: 0; border-bottom: 3px solid #000; display: inline-block; padding-bottom: 5px;">كشف الأسماء المرفوعة</h1>
            <p style="font-size: 12px; font-weight: 700; margin: 10px 0;">التاريخ: ${dateStr} | المصدر: ${selectedSource === 'ALL' ? 'الكل' : (selectedSource === 'MANUAL' ? 'رفع يدوي' : bookingSourcesMap.get(selectedSource))} | العدد: ${uploadedRecords.length}</p>
          </div>
          <table style="${tableStyle}">
            <thead>${headerHtmlStr}</thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        `;
        
        document.body.appendChild(pageDiv);
        const canvas = await html2canvas(pageDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png', 1.0);
        const contentWidth = pdfWidth - (margin * 2);
        let contentHeight = (canvas.height * contentWidth) / canvas.width;
        if (contentHeight > pdfHeight - (margin * 2)) contentHeight = pdfHeight - (margin * 2);
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
        document.body.removeChild(pageDiv);
      }
      pdf.save(`Uploaded_Records_${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-scale-up" onClick={onClose}>
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] flex flex-col border-2 border-slate-900 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
           <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <span className="text-fuchsia-600">🟣</span>
                سجل المرفوعات (آخر ما تم رفعه)
              </h2>
              <p className="text-slate-500 font-bold text-xs mt-1">عرض الأسماء التي تم تغيير حالتها إلى "مرفوع" حسب المصدر (الوجبة)</p>
           </div>
           <button onClick={onClose} className="p-3 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors self-end md:self-auto">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
           </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
           <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-500 mb-1 mr-1">فلتر حسب المصدر (الوجبة)</label>
              <select 
                value={selectedSource} 
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 font-bold text-xs outline-none focus:border-fuchsia-500"
              >
                <option value="ALL">عرض الكل</option>
                <option value="MANUAL">رفع يدوي (بدون مصدر محدد)</option>
                {bookingSources.map(s => (
                  <option key={s.id} value={s.id}>{s.sourceName}</option>
                ))}
              </select>
           </div>
           
           <div className="flex items-end gap-2">
              <button 
                onClick={handleExportPDF} 
                disabled={isExporting || uploadedRecords.length === 0}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isExporting ? 'جاري التصدير...' : 'تصدير الكشف (PDF)'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              </button>
           </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden bg-white rounded-2xl border-2 border-slate-900 relative">
           <div className="absolute inset-0 overflow-auto custom-scrollbar">
              <table className="w-full text-right border-collapse min-w-[800px]">
                 <thead className="sticky top-0 z-10">
                    <tr className="bg-fuchsia-900 text-white text-[11px]">
                       <th className="p-4 font-black w-12 text-center">ت</th>
                       <th className="p-4 font-black">الاسم الكامل</th>
                       <th className="p-4 font-black w-32">الدائرة</th>
                       <th className="p-4 font-black w-28 text-center">الهاتف</th>
                       <th className="p-4 font-black w-32 text-center">المصدر (الوجبة)</th>
                       <th className="p-4 font-black w-32 text-center">تاريخ الإجراء</th>
                       <th className="p-4 font-black w-32 text-center">خيارات</th>
                    </tr>
                 </thead>
                 <tbody className="text-xs font-bold text-slate-800">
                    {uploadedRecords.length === 0 ? (
                       <tr><td colSpan={7} className="p-10 text-center text-slate-400 font-bold italic">لا توجد أسماء مرفوعة مطابقة للفلتر.</td></tr>
                    ) : (
                       uploadedRecords.map((r, idx) => {
                         const sourceName = r.uploadedSourceId ? bookingSourcesMap.get(r.uploadedSourceId) : 'رفع يدوي (عام)';
                         // Use createdAt as proxy for display since we don't track exact upload timestamp in this version
                         const dateDisplay = r.bookingCreatedAt ? new Date(r.bookingCreatedAt).toLocaleDateString('en-GB') : new Date(r.createdAt).toLocaleDateString('en-GB');
                         const isOffice = 'affiliation' in r;

                         return (
                           <tr key={r.id} className="border-b border-slate-100 hover:bg-fuchsia-50 transition-colors">
                              <td className="p-4 text-center text-slate-400">{idx + 1}</td>
                              <td className="p-4 font-black">
                                {r.headFullName}
                                {isOffice && <span className="block text-[9px] text-indigo-600 mt-1">مكتب: {(r as OfficeRecord).affiliation}</span>}
                              </td>
                              <td className="p-4 text-fuchsia-700">{CIRCLE_NAMES[r.circleType]}</td>
                              <td className="p-4 text-center text-slate-500" dir="ltr">{r.headPhone || '-'}</td>
                              <td className="p-4 text-center">
                                 <span className={`px-2 py-1 rounded-lg text-[10px] border ${r.uploadedSourceId ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                    {sourceName}
                                 </span>
                              </td>
                              <td className="p-4 text-center text-slate-400" dir="ltr">{dateDisplay}</td>
                              <td className="p-4 text-center">
                                 <button 
                                   onClick={() => onCancelUpload(r.id, r.uploadedSourceId || null)}
                                   className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-black hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                 >
                                    إلغاء الرفع
                                 </button>
                              </td>
                           </tr>
                         );
                       })
                    )}
                 </tbody>
              </table>
           </div>
        </div>
        
        <div className="mt-4 flex justify-between items-center text-[10px] font-bold text-slate-400 px-2">
           <span>العدد الكلي: {uploadedRecords.length}</span>
           <span>* تاريخ الإجراء المعروض هو تاريخ إنشاء السجل أو آخر تعديل للحجز</span>
        </div>

      </div>
    </div>
  );
};

export default LastUploadsModal;
