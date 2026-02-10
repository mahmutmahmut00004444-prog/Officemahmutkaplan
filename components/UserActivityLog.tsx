
import React, { useState, useEffect, useMemo } from 'react';
import { OfficeUser } from '../types';

interface UserActivityLogProps {
  allOfficeUsers: OfficeUser[];
  onGoBack: () => void;
}

export default function UserActivityLog({ allOfficeUsers, onGoBack }: UserActivityLogProps) {
  const [now, setNow] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState('');

  // Update "now" every minute to refresh relative times
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const sortedUsers = useMemo(() => {
    return [...allOfficeUsers]
      .filter(u => 
        u.office_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => {
        const timeA = a.last_seen ? new Date(a.last_seen).getTime() : 0;
        const timeB = b.last_seen ? new Date(b.last_seen).getTime() : 0;
        return timeB - timeA; // Most recently active first
      });
  }, [allOfficeUsers, searchQuery]);

  const getStatus = (lastSeen?: string) => {
    if (!lastSeen) return { label: 'غير معروف', color: 'text-slate-400', bg: 'bg-slate-100', isOnline: false };
    
    const lastSeenTime = new Date(lastSeen).getTime();
    if (isNaN(lastSeenTime)) return { label: 'غير معروف', color: 'text-slate-400', bg: 'bg-slate-100', isOnline: false };

    const diffMinutes = (now - lastSeenTime) / (1000 * 60);

    if (diffMinutes < 2) { // Less than 2 minutes ago
      return { label: 'نشط الآن', color: 'text-emerald-700', bg: 'bg-emerald-100', isOnline: true };
    } else {
      return { label: 'غير متصل', color: 'text-slate-500', bg: 'bg-slate-50', isOnline: false };
    }
  };

  const formatLastActiveTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace('am', 'ص').replace('pm', 'م');
  };

  const stats = useMemo(() => {
    let online = 0;
    let offline = 0;
    allOfficeUsers.forEach(u => {
        const status = getStatus(u.last_seen);
        if (status.isOnline) online++; else offline++;
    });
    return { total: allOfficeUsers.length, online, offline };
  }, [allOfficeUsers, now]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-40 animate-scale-up">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-5 rounded-[2rem] border-2 border-slate-100 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي المكاتب</p>
               <p className="text-3xl font-black text-slate-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
         </div>
         <div className="bg-emerald-50 p-5 rounded-[2rem] border-2 border-emerald-100 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-[10px] font-black text-emerald-600 uppercase">نشط الآن</p>
               <p className="text-3xl font-black text-emerald-900">{stats.online}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-200 rounded-2xl flex items-center justify-center text-emerald-700 animate-pulse">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
         </div>
         <div className="bg-slate-50 p-5 rounded-[2rem] border-2 border-slate-200 shadow-sm flex items-center justify-between opacity-80">
            <div>
               <p className="text-[10px] font-black text-slate-500 uppercase">غير متصل</p>
               <p className="text-3xl font-black text-slate-700">{stats.offline}</p>
            </div>
            <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-500">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
         </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>

        <div className="pt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-black text-slate-900">سجل النشاطات</h2>
            <input 
              type="text" 
              placeholder="بحث عن مكتب..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-blue-400 transition-all"
            />
          </div>

          <div className="table-container rounded-3xl border border-slate-200 overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="p-4 text-[10px] font-black text-center w-16">ت</th>
                    <th className="p-4 text-[10px] font-black w-16">الحالة</th>
                    <th className="p-4 text-[10px] font-black">اسم المكتب</th>
                    <th className="p-4 text-[10px] font-black">اسم المستخدم</th>
                    <th className="p-4 text-[10px] font-black text-center">آخر ظهور</th>
                    <th className="p-4 text-[10px] font-black text-center">المدة</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold text-slate-700">
                  {sortedUsers.map((user, idx) => {
                    const status = getStatus(user.last_seen);
                    return (
                      <tr key={user.id} className={`border-b border-slate-100 transition-colors ${status.isOnline ? 'bg-emerald-50/30 hover:bg-emerald-50' : 'hover:bg-slate-50'}`}>
                        <td className="p-4 text-center text-xs font-black text-slate-400">{idx + 1}</td>
                        <td className="p-4">
                           <div className={`w-3 h-3 rounded-full mx-auto ${status.isOnline ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                        </td>
                        <td className="p-4">
                           <span className={`font-black ${status.isOnline ? 'text-slate-900' : 'text-slate-500'}`}>{user.office_name}</span>
                        </td>
                        <td className="p-4">
                           <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">{user.username}</span>
                        </td>
                        <td className="p-4 text-center">
                           <span className="text-xs font-bold text-blue-600" dir="ltr">{formatLastActiveTime(user.last_seen)}</span>
                        </td>
                        <td className="p-4 text-center">
                           <span className={`text-[10px] font-black px-3 py-1 rounded-full ${status.bg} ${status.color}`}>
                              {status.label}
                           </span>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400 font-bold italic">لا توجد نتائج مطابقة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
