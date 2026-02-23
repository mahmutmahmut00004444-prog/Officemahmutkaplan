
import React, { useState, useRef, useEffect } from 'react';
import { Reviewer, OfficeRecord, CircleType, BookingSource, OfficeUser, OfficeSettlement, SettlementTransaction, Session, Device } from '../types';
import { supabase } from '../lib/supabase';

interface BackupManagerProps {
  reviewers: Reviewer[];
  officeRecords: OfficeRecord[];
  
  // New Props for full backup support
  bookingSources?: BookingSource[];
  allOfficeUsers?: OfficeUser[];
  officeSettlements?: OfficeSettlement[];
  sourceSettlements?: SettlementTransaction[];
  
  onImport: (data: any) => Promise<void>;
  onGoBack: () => void;
}

interface ImportConfirmData {
  reviewers: Reviewer[];
  officeRecords: OfficeRecord[];
  
  bookingSources?: BookingSource[];
  allOfficeUsers?: OfficeUser[];
  officeSettlements?: OfficeSettlement[];
  sourceSettlements?: SettlementTransaction[];
  
  reviewerCount: number;
  officeRecordCount: number;
  otherCounts: number; // Sum of other items
}

const BackupManager: React.FC<BackupManagerProps> = ({ 
  reviewers, officeRecords, 
  bookingSources, allOfficeUsers, officeSettlements, sourceSettlements,
  onImport, onGoBack 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportSelection, setExportSelection] = useState({ reviewers: true, offices: true, fullSystem: true });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // To ensure a "World Class" full backup, we fetch fresh data directly from Supabase 
      // instead of relying solely on props which might be paginated or filtered.
      
      const [
        revRes, offRecRes, 
        usersRes, sourcesRes, 
        offSetRes, srcSetRes,
        sessRes, devRes
      ] = await Promise.all([
        supabase.from('reviewers').select('*, family_members(*)'),
        supabase.from('office_records').select('*, office_family_members(*)'),
        supabase.from('office_users').select('*'),
        supabase.from('booking_sources').select('*'),
        supabase.from('office_settlements').select('*'),
        supabase.from('settlement_transactions').select('*'),
        supabase.from('sessions').select('*'),
        supabase.from('devices').select('*')
      ]);

      const backupData = {
        version: "2.0", // Upgraded version
        timestamp: Date.now(),
        type: exportSelection.fullSystem ? 'FULL_SYSTEM' : 'PARTIAL',
        data: {
          reviewers: exportSelection.reviewers ? (revRes.data || []) : [],
          officeRecords: exportSelection.offices ? (offRecRes.data || []) : [],
          
          // Full System Data
          officeUsers: exportSelection.fullSystem ? (usersRes.data || []) : [],
          bookingSources: exportSelection.fullSystem ? (sourcesRes.data || []) : [],
          officeSettlements: exportSelection.fullSystem ? (offSetRes.data || []) : [],
          sourceSettlements: exportSelection.fullSystem ? (srcSetRes.data || []) : [],
          sessions: exportSelection.fullSystem ? (sessRes.data || []) : [],
          devices: exportSelection.fullSystem ? (devRes.data || []) : [],
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `نظام_المراجعين_شامل_${new Date().toLocaleDateString('en-CA')}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء التصدير. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (fileInputRef.current) fileInputRef.current.value = ''; 
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.data) throw new Error("تنسيق ملف غير صالح: لا يحتوي على حقل 'data'");

        const d = json.data;
        
        // Helper to normalize data structure if coming from old backup format
        const reviewersToImport = d.reviewers || [];
        const officeRecordsToImport = d.officeRecords || [];
        
        const otherCounts = (d.officeUsers?.length || 0) + (d.bookingSources?.length || 0) + (d.officeSettlements?.length || 0) + (d.sourceSettlements?.length || 0) + (d.sessions?.length || 0);

        setImportDataToConfirm({
          reviewers: reviewersToImport,
          officeRecords: officeRecordsToImport,
          
          bookingSources: d.bookingSources,
          allOfficeUsers: d.officeUsers,
          officeSettlements: d.officeSettlements,
          sourceSettlements: d.sourceSettlements,
          
          reviewerCount: reviewersToImport.length,
          officeRecordCount: officeRecordsToImport.length,
          otherCounts: otherCounts
        });
        setShowImportConfirmModal(true);
        
      } catch (err: any) {
        alert(`فشل الاستيراد: ${err.message || 'الملف قد يكون تالفاً أو بتنسيق غير مدعوم.'}`);
        if (fileInputRef.current) fileInputRef.current.value = ''; 
        setIsImporting(false); 
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!importDataToConfirm) return;

    setShowImportConfirmModal(false); 
    try {
      // Pass the whole data object to parent onImport which will handle the logic
      await onImport({
        reviewers: importDataToConfirm.reviewers,
        officeRecords: importDataToConfirm.officeRecords,
        bookingSources: importDataToConfirm.bookingSources,
        officeUsers: importDataToConfirm.allOfficeUsers,
        officeSettlements: importDataToConfirm.officeSettlements,
        sourceSettlements: importDataToConfirm.sourceSettlements,
        // Pass sessions/devices if needed, handled in parent
        sessions: (importDataToConfirm as any).sessions, 
        devices: (importDataToConfirm as any).devices,
      });
      alert("تم استيراد كافة البيانات بنجاح");
    } catch (err) {
      console.error(err);
      alert("فشل الاستيراد: حدث خطأ أثناء الحفظ في قاعدة البيانات.");
    } finally {
      setIsImporting(false); 
      if (fileInputRef.current) fileInputRef.current.value = ''; 
      setImportDataToConfirm(null); 
    }
  };

  const cancelImport = () => {
    setShowImportConfirmModal(false); 
    setIsImporting(false); 
    if (fileInputRef.current) fileInputRef.current.value = ''; 
    setImportDataToConfirm(null); 
  };


  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-scale-up pb-40">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
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
            <h2 className="text-3xl font-black text-slate-900">إدارة النسخ الاحتياطي الشامل</h2>
          </div>
          <p className="text-slate-500 font-bold italic">احفظ نسخة كاملة من النظام (المراجعين، المكاتب، الحسابات، الإعدادات) واسترجعها في أي وقت.</p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* لوحة التصدير */}
            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-200 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">تصدير كامل</h3>
                  <p className="text-[10px] text-slate-400 font-bold">حفظ كل شيء في ملف واحد</p>
                </div>
              </div>

              <div className="space-y-3 py-4">
                <label className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:border-blue-400 transition-all">
                  <input type="checkbox" checked={exportSelection.fullSystem} onChange={() => setExportSelection(prev => ({ ...prev, fullSystem: !prev.fullSystem }))} className="w-5 h-5 accent-blue-600" />
                  <div className="flex flex-col">
                     <span className="font-black text-slate-900 text-sm">نسخة شاملة للنظام</span>
                     <span className="text-[10px] text-slate-400 font-bold">تشمل: الحسابات، المكاتب، المصادر، الأجهزة...</span>
                  </div>
                </label>
                
                {!exportSelection.fullSystem && (
                    <>
                        <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                        <input type="checkbox" checked={exportSelection.reviewers} onChange={() => setExportSelection(prev => ({ ...prev, reviewers: !prev.reviewers }))} className="w-4 h-4 accent-blue-600" />
                        <span className="font-bold text-slate-600 text-xs">سجلات محمود قبلان</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                        <input type="checkbox" checked={exportSelection.offices} onChange={() => setExportSelection(prev => ({ ...prev, offices: !prev.offices }))} className="w-4 h-4 accent-blue-600" />
                        <span className="font-bold text-slate-600 text-xs">سجلات المكاتب</span>
                        </label>
                    </>
                )}
              </div>

              <button 
                onClick={handleExport}
                disabled={isExporting}
                className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 active:scale-95 transition-all disabled:bg-slate-300"
              >
                {isExporting ? 'جاري تحضير الملف...' : 'تصدير النسخة الاحتياطية'}
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
                  <p className="text-[10px] text-slate-400 font-bold">استرجاع نسخة سابقة</p>
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
                   <span className="text-xs font-black text-green-600 italic">جاري قراءة الملف وتحليل البيانات...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Confirmation Modal */}
      {showImportConfirmModal && importDataToConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-md text-center border-2 border-slate-900 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 z-10 p-2">
                <button 
                    onClick={cancelImport}
                    className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center"
                    aria-label="إغلاق"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
            </div>
            <h3 className="text-2xl font-black mb-4 text-green-700 pt-4">ملخص الاستيراد</h3>
            
            <div className="bg-slate-50 p-4 rounded-xl mb-6 text-right space-y-2 border border-slate-200">
                <p className="text-xs font-bold text-slate-600 flex justify-between"><span>📝 سجلات محمود قبلان:</span> <span className="font-black text-slate-900">{importDataToConfirm.reviewerCount}</span></p>
                <p className="text-xs font-bold text-slate-600 flex justify-between"><span>🏢 سجلات المكاتب:</span> <span className="font-black text-slate-900">{importDataToConfirm.officeRecordCount}</span></p>
                {importDataToConfirm.otherCounts > 0 && (
                    <p className="text-xs font-bold text-slate-600 flex justify-between border-t border-slate-200 pt-2 mt-2">
                        <span>⚙️ بيانات النظام (إعدادات، حسابات...):</span> 
                        <span className="font-black text-slate-900">{importDataToConfirm.otherCounts} عنصر</span>
                    </p>
                )}
            </div>

            <p className="text-slate-500 mb-6 font-bold text-xs">
              سيتم دمج هذه البيانات مع قاعدة البيانات الحالية. هل أنت متأكد؟
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={confirmImport} 
                className="w-full bg-green-600 text-white py-4 rounded-xl font-black shadow-lg active:scale-95 transition-all"
              >
                تأكيد الاستيراد الشامل
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
