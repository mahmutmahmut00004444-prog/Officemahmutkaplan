
import React, { useState, useEffect } from 'react';
import { LoggedInUser, OfficeUser } from '../types';

interface NavbarProps {
  onToggleSidebar: () => void;
  onRefresh: () => Promise<void>;
  isSyncing: boolean;
  loggedInUser: LoggedInUser | null;
  onLogout: () => void;
  allOfficeUsers?: OfficeUser[]; 
}

const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onRefresh, isSyncing, loggedInUser, onLogout, allOfficeUsers }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); 

    return () => clearInterval(timer); 
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formattedDate = currentTime.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Calculate active users
  const activeUsersCount = allOfficeUsers ? allOfficeUsers.filter(u => {
    if (!u.last_seen) return false;
    const diff = new Date().getTime() - new Date(u.last_seen).getTime();
    return diff < 2 * 60 * 1000; 
  }).length : 0;

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50 px-3 py-2 md:px-4 md:py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 md:gap-4">
        <button 
          onClick={onToggleSidebar}
          className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 active:scale-90"
          aria-label="القائمة"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
        
        {/* Title Section - Adjusted for side-by-side display */}
        <div className="flex items-center gap-2 md:gap-3">
          <span className="text-base md:text-xl font-black text-blue-700 select-none leading-none whitespace-nowrap">نظام المراجعين</span>
          <span className="hidden sm:inline-block text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-200 pr-2">Cloud System</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-3">
        {/* Real-time Clock - Compact on mobile */}
        <div className="flex flex-col items-end text-center justify-center"> 
          <span className="text-[8px] md:text-[10px] font-bold text-slate-500 whitespace-nowrap">{formattedDate}</span> 
          <span className="text-xs md:text-sm font-black text-blue-800 leading-none" dir="ltr">{formattedTime}</span>
        </div>

        {/* Active Users Indicator for Admin */}
        {loggedInUser?.role === 'ADMIN' && activeUsersCount > 0 && (
           <div className="hidden lg:flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-black text-emerald-700">{activeUsersCount} نشط</span>
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
          className={`flex items-center justify-center gap-2 w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-2 rounded-xl border-2 border-slate-100 transition-all active:scale-95 ${isSyncing ? 'bg-slate-50 opacity-50' : 'bg-white hover:border-blue-200 hover:bg-blue-50'}`}
        >
          <svg className={`w-4 h-4 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
          <span className="text-[11px] font-black text-slate-700 hidden md:block">{isSyncing ? 'مزامنة...' : 'تحديث'}</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
