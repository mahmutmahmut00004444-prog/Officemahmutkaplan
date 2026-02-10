
import React, { useState, useEffect } from 'react';
import { LoggedInUser, OfficeUser } from '../types';

interface NavbarProps {
  onToggleSidebar: () => void;
  onRefresh: () => Promise<void>;
  isSyncing: boolean;
  loggedInUser: LoggedInUser | null;
  onLogout: () => void;
  allOfficeUsers?: OfficeUser[]; // Added prop
}

const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onRefresh, isSyncing, loggedInUser, onLogout, allOfficeUsers }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer); // Cleanup on unmount
  }, []);

  // استخدام نظام 24 ساعة
  const formattedTime = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  // استخدام en-GB للتاريخ (يوم/شهر/سنة) بالأرقام الإنجليزية
  const formattedDate = currentTime.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Calculate active users
  const activeUsersCount = allOfficeUsers ? allOfficeUsers.filter(u => {
    if (!u.last_seen) return false;
    const diff = new Date().getTime() - new Date(u.last_seen).getTime();
    return diff < 2 * 60 * 1000; // Active if seen in last 2 minutes
  }).length : 0;

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 active:scale-90"
          aria-label="القائمة"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
        <div className="flex flex-col">
          {loggedInUser?.role !== 'OFFICE' && (
            <span className="text-xl font-black text-blue-700 select-none leading-none">نظام المراجعين</span>
          )}
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Cloud Management System</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Real-time Clock - Now visible on all screen sizes */}
        <div className="flex flex-col items-end text-center md:flex"> 
          <span className="text-[10px] font-bold text-slate-500">{formattedDate}</span> 
          <span className="text-sm font-black text-blue-800" dir="ltr">{formattedTime}</span>
        </div>

        {/* Active Users Indicator for Admin */}
        {loggedInUser?.role === 'ADMIN' && activeUsersCount > 0 && (
           <div className="hidden lg:flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-black text-emerald-700">{activeUsersCount} نشط الآن</span>
           </div>
        )}

        {loggedInUser && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
            <div className={`w-2 h-2 rounded-full ${loggedInUser.role === 'ADMIN' ? 'bg-blue-600' : 'bg-indigo-600'} animate-pulse`}></div>
            <span className="text-[11px] font-black text-slate-700">{loggedInUser.username}</span>
          </div>
        )}

        <button 
          onClick={onRefresh}
          disabled={isSyncing}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-100 transition-all active:scale-95 ${isSyncing ? 'bg-slate-50 opacity-50' : 'bg-white hover:border-blue-200 hover:bg-blue-50'}`}
        >
          <svg className={`w-4 h-4 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
          <span className="text-[11px] font-black text-slate-700 hidden md:block">{isSyncing ? 'جاري المزامنة...' : 'تحديث البيانات'}</span>
        </button>

        {loggedInUser && (
          <button 
            onClick={onLogout}
            className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95 flex items-center justify-center"
            aria-label="تسجيل الخروج"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
