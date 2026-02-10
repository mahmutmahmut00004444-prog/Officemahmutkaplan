
import React, { useState, useRef, useEffect } from 'react';
import { Reviewer, OfficeRecord, CircleType } from '../types';
import { supabase } from '../lib/supabase';

interface BackupManagerProps {
  reviewers: Reviewer[];
  officeRecords: OfficeRecord[];
  onImport: (data: { reviewers?: Reviewer[], officeRecords?: OfficeRecord[] }) => Promise<void>;
  onGoBack: () => void; // Add onGoBack prop
}

interface ImportConfirmData {
  reviewers: Reviewer[];
  officeRecords: OfficeRecord[];
  reviewerCount: number;
  officeRecordCount: number;
}

const BackupManager: React.FC<BackupManagerProps> = ({ reviewers, officeRecords, onImport, onGoBack }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportSelection, setExportSelection] = useState({ reviewers: true, offices: true });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New state for import confirmation modal
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false);
  const [importDataToConfirm, setImportDataToConfirm] = useState<ImportConfirmData | null>(null);

  useEffect(() => {
    if (showImportConfirmModal) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [showImportConfirmModal]);

  const handleExport = () => {
    setIsExporting(true);
    try {
      const backupData = {
        version: "1.0",
        timestamp: Date.now(),
        data: {
          reviewers: exportSelection.reviewers ? reviewers : [],
          officeRecords: exportSelection.offices ? officeRecords : []
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `نظام_المراجعين_نسخة_احتياطية_${new Date().toLocaleDateString('en-CA')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("حدث خطأ أثناء التصدير");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input if no file selected
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.data) throw new Error("تنسيق ملف غير صالح: لا يحتوي على حقل 'data'");

        const reviewersToImport: Reviewer[] = json.data.reviewers || [];
        const officeRecordsToImport: OfficeRecord[] = json.data.officeRecords || [];

        setImportDataToConfirm({
          reviewers: reviewersToImport,
          officeRecords: officeRecordsToImport,
          reviewerCount: reviewersToImport.length,
          officeRecordCount: officeRecordsToImport.length,
        });
        setShowImportConfirmModal(true); // Show confirmation modal
        
      } catch (err: any) {
        alert(`فشل الاستيراد: ${err.message || 'الملف قد يكون تالفاً أو بتنسيق غير مدعوم.'}`);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input on error
        setIsImporting(false); // Stop loading indicator
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!importDataToConfirm) return;

    setShowImportConfirmModal(false); // Close modal
    try {
      await onImport({
        reviewers: importDataToConfirm.reviewers,
        officeRecords: importDataToConfirm.officeRecords
      });
      alert("تم استيراد البيانات بنجاح");
    } catch (err) {
      alert("فشل الاستيراد: حدث خطأ أثناء الحفظ في قاعدة البيانات.");
    } finally {
      setIsImporting(false); // Stop loading indicator
      if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input
      setImportDataToConfirm(null); // Clear data
    }
  };

  const cancelImport = () => {
    setShowImportConfirmModal(false); // Close modal
    setIsImporting(false); // Stop loading indicator
    if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input
    setImportDataToConfirm(null); // Clear data
  };


  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-scale-up pb-40">
      <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 z-10 p-2">
          <button 
            onClick={onGoBack}
            className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center"
            aria-label="رجوع"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10"></div>
        <div className="relative pt-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-3xl font-black text-slate-900">إدارة النسخ الاحتياطي</h2>
          </div>
          <p className="text-slate-500 font-bold italic">احفظ بياناتك وصورك في ملف واحد آمن للرجوع إليها لاحقاً</p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* لوحة التصدير */}
            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-200 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">تصدير البيانات</h3>
                  <p className="text-[10px] text-slate-400 font-bold">حفظ السجلات الحالية في ملف خارجي</p>
                </div>
              </div>

              <div className="space-y-3 py-4">
                <label className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-all">
                  <input type="checkbox" checked={exportSelection.reviewers} onChange={() => setExportSelection(prev => ({ ...prev, reviewers: !prev.reviewers }))} className="w-5 h-5 accent-blue-600" />
                  <span className="font-black text-slate-700 text-sm">سجلات محمود قبلان ({reviewers.length})</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-all">
                  <input type="checkbox" checked={exportSelection.offices} onChange={() => setExportSelection(prev => ({ ...prev, offices: !prev.offices }))} className="w-5 h-5 accent-blue-600" />
                  <span className="font-black text-slate-700 text-sm">سجلات المكاتب ({officeRecords.length})</span>
                </label>
              </div>

              <button 
                onClick={handleExport}
                disabled={isExporting || (!exportSelection.reviewers && !exportSelection.offices)}
                className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 active:scale-95 transition-all disabled:bg-slate-300"
              >
                {isExporting ? 'جاري التصدير...' : 'تصدير النسخة الاحتياطية'}
              </button>
            </div>

            {/* لوحة الاستيراد */}
            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-200 flex flex-col justify-between space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 13 7 8"/><line x1="12" x2="12" y1="13" y2="1"/></svg>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">استيراد البيانات</h3>
                  <p className="text-[10px] text-slate-400 font-bold">رفع نسخة احتياطية سابقة</p>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-[2rem] bg-white group hover:border-green-600 transition-all">
                <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImport} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="p-4 bg-green-50 text-green-600 rounded-full group-hover:scale-110 transition-transform">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="18" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
                  </div>
                  <span className="font-black text-slate-800">اختر ملف النسخة (.json)</span>
                </button>
              </div>

              {isImporting && (
                <div className="text-center animate-pulse">
                   <span className="text-xs font-black text-green-600 italic">جاري معالجة البيانات واستيراد الصور...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Confirmation Modal */}
      {showImportConfirmModal && importDataToConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[2rem] w-full max-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 z-10 p-2">
                <button 
                    onClick={cancelImport}
                    className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center"
                    aria-label="إغلاق"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
            </div>
            <h3 className="text-2xl font-black mb-4 text-green-700 pt-4">تأكيد الاستيراد</h3>
            <p className="text-slate-500 mb-6 font-bold text-sm">
              هل أنت متأكد من استيراد <span className="font-black text-blue-600">{importDataToConfirm.reviewerCount}</span> سجل مراجع و <span className="font-black text-indigo-600">{importDataToConfirm.officeRecordCount}</span> سجل مكتب؟ سيتم دمج السجلات الجديدة مع الموجودة.
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={confirmImport} 
                className="w-full bg-green-600 text-white py-4 rounded-xl font-black shadow-lg active:scale-95 transition-all"
              >
                نعم، استيراد
              </button>
              <button 
                onClick={cancelImport} 
                className="w-full text-slate-400 font-bold py-2"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManager;
