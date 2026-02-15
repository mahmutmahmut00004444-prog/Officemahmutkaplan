
import React from 'react';
import { ViewType, UserRole, LoggedInUser, SessionStats } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewType) => void;
  onResetClick: () => void;
  onLogout: () => void;
  currentView: ViewType;
  stats: { total: number; booked: number; notBooked: number; uploaded: number; notUploaded: number };
  loggedInUser: LoggedInUser | null;
  sessionStats?: SessionStats; // New prop for session specific stats
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onNavigate, onResetClick, onLogout, currentView, stats, loggedInUser, sessionStats }) => {
  
  // تعريف العناصر مع الألوان والأيقونات المخصصة
  const adminMenuItems = [
    { 
      id: 'FORM', 
      label: 'إضافة مراجع جديد', 
      sub: 'سجل محمود قبلان', 
      icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', // User Plus
      colorName: 'blue',
      activeClass: 'bg-blue-600 border-blue-600 shadow-blue-200',
      iconClass: 'text-blue-600 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white',
      textClass: 'group-hover:text-blue-700'
    },
    { 
      id: 'ALL', 
      label: 'سجلات محمود قبلان', 
      sub: 'عرض وإدارة البيانات', 
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', // Clipboard List
      colorName: 'indigo',
      activeClass: 'bg-indigo-600 border-indigo-600 shadow-indigo-200',
      iconClass: 'text-indigo-600 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white',
      textClass: 'group-hover:text-indigo-700'
    },
    { 
      id: 'OFFICE_FORM', 
      label: 'إضافة مراجعين المكاتب', 
      sub: 'إضافة سريعة للمكاتب', 
      icon: 'M12 4v16m8-8H4', // Plus (Simple) or custom
      colorName: 'purple',
      activeClass: 'bg-purple-600 border-purple-600 shadow-purple-200',
      iconClass: 'text-purple-600 bg-purple-50 group-hover:bg-purple-600 group-hover:text-white',
      textClass: 'group-hover:text-purple-700'
    },
    { 
      id: 'OFFICE_ALL', 
      label: 'سجلات المكاتب', 
      sub: 'قاعدة بيانات المكاتب', 
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5', // Office Building
      colorName: 'fuchsia',
      activeClass: 'bg-fuchsia-600 border-fuchsia-600 shadow-fuchsia-200',
      iconClass: 'text-fuchsia-600 bg-fuchsia-50 group-hover:bg-fuchsia-600 group-hover:text-white',
      textClass: 'group-hover:text-fuchsia-700'
    },
    { 
      id: 'OFFICE_RECEIPTS', 
      label: 'الوصولات (صور الحجوزات)', 
      sub: 'أرشيف الوصولات والصور', 
      icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      colorName: 'emerald',
      activeClass: 'bg-emerald-600 border-emerald-600 shadow-emerald-200',
      iconClass: 'text-emerald-600 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white',
      textClass: 'group-hover:text-emerald-700'
    },
    { 
      id: 'SESSIONS', 
      label: 'الجلسات', 
      sub: 'إدارة أرقام الهواتف', 
      icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', // Phone
      colorName: 'cyan',
      activeClass: 'bg-cyan-600 border-cyan-600 shadow-cyan-200',
      iconClass: 'text-cyan-600 bg-cyan-50 group-hover:bg-cyan-600 group-hover:text-white',
      textClass: 'group-hover:text-cyan-700'
    },
    { 
      id: 'USER_ACTIVITY', 
      label: 'نشاطات المستخدمين', 
      sub: 'حالة اتصال المكاتب الآن', 
      icon: 'M5.636 5.636a9 9 0 1012.728 0M12 3v9', // Power / Activity
      colorName: 'rose',
      activeClass: 'bg-rose-600 border-rose-600 shadow-rose-200',
      iconClass: 'text-rose-600 bg-rose-50 group-hover:bg-rose-600 group-hover:text-white',
      textClass: 'group-hover:text-rose-700'
    },
    { 
      id: 'SETTINGS', 
      label: 'الإعدادات', 
      sub: 'إدارة النظام والسجلات المحجوزة', 
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', // Cog
      colorName: 'slate',
      activeClass: 'bg-slate-700 border-slate-700 shadow-slate-200',
      iconClass: 'text-slate-600 bg-slate-100 group-hover:bg-slate-700 group-hover:text-white',
      textClass: 'group-hover:text-slate-700'
    },
  ];

  const officeMenuItems = [
    { 
      id: 'OFFICE_ALL', 
      label: 'سجلات المكاتب', 
      sub: 'قاعدة بيانات المكتب', 
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5',
      colorName: 'fuchsia',
      activeClass: 'bg-fuchsia-600 border-fuchsia-600 shadow-fuchsia-200',
      iconClass: 'text-fuchsia-600 bg-fuchsia-50 group-hover:bg-fuchsia-600 group-hover:text-white',
      textClass: 'group-hover:text-fuchsia-700'
    },
    { 
      id: 'OFFICE_FORM', 
      label: 'إضافة مراجعين', 
      sub: 'إضافة يدوية (فردي)', 
      icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
      colorName: 'purple',
      activeClass: 'bg-purple-600 border-purple-600 shadow-purple-200',
      iconClass: 'text-purple-600 bg-purple-50 group-hover:bg-purple-600 group-hover:text-white',
      textClass: 'group-hover:text-purple-700'
    },
    { 
      id: 'OFFICE_RECEIPTS', 
      label: 'الوصولات (صور الحجوزات)', 
      sub: 'تحميل صور الحجوزات المكتملة', 
      icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
      colorName: 'emerald',
      activeClass: 'bg-emerald-600 border-emerald-600 shadow-emerald-200',
      iconClass: 'text-emerald-600 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white',
      textClass: 'group-hover:text-emerald-700'
    },
    { 
      id: 'SETTINGS', 
      label: 'الإعدادات', 
      sub: 'السجلات المحجوزة والأرشيف', 
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      colorName: 'slate',
      activeClass: 'bg-slate-700 border-slate-700 shadow-slate-200',
      iconClass: 'text-slate-600 bg-slate-100 group-hover:bg-slate-700 group-hover:text-white',
      textClass: 'group-hover:text-slate-700'
    },
  ];

  const menuItems = loggedInUser?.role === 'ADMIN' ? adminMenuItems : officeMenuItems;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] md:hidden transition-opacity duration-300" onClick={onClose} />
      )}
      <aside className={`fixed top-0 right-0 h-full bg-white w-72 shadow-2xl z-[110] transform transition-all duration-300 ease-out border-l border-slate-100 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-800 tracking-tighter">لوحة التحكم</h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-white rounded-xl shadow-sm transition-all active:scale-90">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg bg-blue-600 border border-white/20">م</div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-black text-slate-900 truncate">{loggedInUser?.username || 'المستخدم'}</div>
              <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none">{loggedInUser?.role === 'ADMIN' ? 'المدير العام' : 'حساب مكتب'}</div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button 
                key={item.id} 
                onClick={() => { onNavigate(item.id as ViewType); onClose(); }} 
                className={`w-full group relative flex items-center gap-4 p-3 rounded-2xl text-right transition-all border-2 ${isActive ? `${item.activeClass} text-white shadow-xl scale-[1.02]` : 'bg-white border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-100 hover:shadow-sm'}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-white/20 text-white' : item.iconClass}`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                </div>
                <div className="flex flex-col text-right">
                  <span className={`font-black text-[13px] leading-tight transition-colors ${!isActive ? item.textClass : ''}`}>{item.label}</span>
                  <span className={`text-[10px] font-bold mt-0.5 ${isActive ? 'text-white/80' : 'text-slate-400 group-hover:text-slate-500'}`}>{item.sub}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-4">
          {/* عرض الإحصائيات بناءً على الصفحة الحالية */}
          {currentView === 'SESSIONS' && sessionStats ? (
            <div className="grid grid-cols-2 gap-2 animate-scale-up">
              <div className="bg-blue-50 p-2 rounded-xl border border-blue-200 text-center shadow-sm col-span-2">
                <div className="text-[9px] text-blue-600 font-black mb-1 uppercase tracking-tighter">إجمالي الجلسات</div>
                <div className="text-xl font-black text-blue-900">{sessionStats.total}</div>
              </div>
              <div className="bg-green-50 p-2 rounded-xl border border-green-200 text-center shadow-sm">
                <div className="text-[9px] text-green-600 font-black mb-1 uppercase tracking-tighter">متاح</div>
                <div className="text-lg font-black text-green-700">{sessionStats.available}</div>
              </div>
              <div className="bg-red-50 p-2 rounded-xl border border-red-200 text-center shadow-sm">
                <div className="text-[9px] text-red-600 font-black mb-1 uppercase tracking-tighter">غير متاح</div>
                <div className="text-lg font-black text-red-700">{sessionStats.unavailable}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 text-center shadow-sm">
                <div className="text-[9px] text-slate-400 font-black mb-1 uppercase tracking-tighter">إجمالي السجلات</div>
                <div className="text-xl font-black text-slate-900">{stats.total}</div>
              </div>
              <div className="bg-white p-3 rounded-2xl border-2 border-green-500 text-center shadow-sm">
                <div className="text-[9px] text-green-600 font-black mb-1 uppercase tracking-tighter">محجوزة</div>
                <div className="text-xl font-black text-green-700">{stats.booked}</div>
              </div>
            </div>
          )}
          
          <button 
            onClick={onLogout} 
            className="w-full p-3 bg-white text-red-600 rounded-full shadow-lg border border-red-100 hover:bg-red-50 hover:text-red-800 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            <span className="font-black text-sm">تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
