
import React from 'react';
import { ViewType, LoggedInUser } from '../types';

interface SettingsPageProps {
  onNavigate: (view: ViewType) => void;
  onResetClick: () => void;
  onGoBack: () => void;
  loggedInUser: LoggedInUser | null;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate, onResetClick, onGoBack, loggedInUser }) => {
  const isAdmin = loggedInUser?.role === 'ADMIN';

  const settingsOptions = [
    { 
      id: 'MANAGE_OFFICES', 
      label: 'إدارة المكاتب', 
      desc: 'حسابات الوكلاء والأسعار وتفاصيلهم', 
      icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 11-8 0 4 4 0 018 0z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
      color: 'indigo',
      roles: ['ADMIN']
    },
    { 
      id: 'BOOKING_SOURCES_MANAGER', 
      label: 'مصدر الحجوزات', 
      desc: 'إدارة مصادر الحجز والديون والمستحقات', 
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      color: 'emerald',
      roles: ['ADMIN']
    },
    { 
      id: 'COMPLETED_BOOKINGS', 
      label: 'السجلات المحجوزة', 
      desc: 'عرض كافة الحجوزات المكتملة وإدارتها', 
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'blue',
      roles: ['ADMIN', 'OFFICE']
    },
    { 
      id: 'BACKUP', 
      label: 'النسخة الاحتياطية', 
      desc: 'تصدير بيانات النظام بالكامل أو استيراد نسخة سابقة', 
      icon: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
      color: 'amber',
      roles: ['ADMIN']
    },
    { 
      id: 'ARCHIVE_BOOKINGS', 
      label: 'أرشيف الحجوزات', 
      desc: 'السجلات التي تم أرشفتها مسبقاً', 
      icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
      color: 'slate',
      roles: ['ADMIN']
    },
    { 
      id: 'TRASH', 
      label: 'سلة المحذوفات', 
      desc: 'استعادة الملفات المحذوفة خلال 72 ساعة', 
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      color: 'red',
      roles: ['ADMIN']
    },
  ];

  const visibleOptions = settingsOptions.filter(opt => {
    if (!loggedInUser) return false;
    return opt.roles.includes(loggedInUser.role);
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-scale-up pb-40">
      <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>
        
        <div className="pt-8">
          <h2 className="text-3xl font-black text-slate-900 mb-2">إعدادات النظام</h2>
          <p className="text-slate-500 font-bold mb-10 italic">إدارة الخيارات المتقدمة وأدوات النظام</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleOptions.map((opt) => (
              <button 
                key={opt.id}
                onClick={() => onNavigate(opt.id as ViewType)}
                className="flex items-center gap-6 p-6 bg-slate-50 border-2 border-slate-200 rounded-[2rem] hover:border-slate-900 hover:bg-white transition-all text-right group shadow-sm hover:shadow-xl"
              >
                <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center bg-white shadow-md border border-slate-100 group-hover:scale-110 transition-transform`}>
                  <svg className={`w-8 h-8 text-${opt.color}-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d={opt.icon} /></svg>
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-lg font-black text-slate-900 mb-1">{opt.label}</h3>
                  <p className="text-xs font-bold text-slate-400 leading-relaxed">{opt.desc}</p>
                </div>
              </button>
            ))}

            {isAdmin && (
              <button 
                onClick={onResetClick}
                className="flex items-center gap-6 p-6 bg-red-50 border-2 border-red-100 rounded-[2rem] hover:border-red-600 hover:bg-white transition-all text-right group shadow-sm hover:shadow-xl"
              >
                <div className="w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center bg-white shadow-md border border-red-100 group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-lg font-black text-red-600 mb-1">تصفير كافة السجلات</h3>
                  <p className="text-xs font-bold text-red-400 leading-relaxed">حذف نهائي لكافة البيانات من النظام (يتطلب تأكيد)</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
