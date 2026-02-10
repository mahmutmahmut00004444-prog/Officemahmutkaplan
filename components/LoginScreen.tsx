
import React, { useState, useEffect } from 'react';

interface LoginScreenProps {
  onLogin: (username: string, password_hash: string) => Promise<void>;
  errorMessage: string | null;
  isLoading: boolean;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, errorMessage, isLoading }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    await onLogin(username, password);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden font-cairo" dir="rtl">
      
      {/* Simple Background Decor */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
         <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
         <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
      </div>

      <div className="w-full max-w-md z-10 p-6 animate-scale-up">
        <div className="bg-white rounded-[2.5rem] shadow-2xl border-2 border-white/50 p-8 md:p-10 backdrop-blur-sm">
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-lg mb-4 transform rotate-3 hover:rotate-0 transition-transform duration-300">
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h1 className="text-2xl font-black text-slate-800">تسجيل الدخول</h1>
            <p className="text-sm font-bold text-slate-400 mt-1">نظام إدارة المراجعين المركزي</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            {/* خدعة لمنع المتصفح من حفظ المعلومات */}
            <input type="text" style={{display: 'none'}} />
            <input type="password" style={{display: 'none'}} />

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 mr-2">اسم المستخدم</label>
              <div className="relative">
                <input 
                  type="text" 
                  name="username_field_no_save"
                  id="username_field_no_save"
                  autoComplete="off"
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  className="w-full h-14 pl-4 pr-12 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition-all text-right placeholder:text-slate-300"
                  placeholder="أدخل اسم المستخدم"
                  disabled={isLoading}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 mr-2">كلمة المرور</label>
              <div className="relative">
                <input 
                  type="password" 
                  name="password_field_no_save"
                  id="password_field_no_save"
                  autoComplete="new-password"
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full h-14 pl-4 pr-12 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition-all text-right placeholder:text-slate-300"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center gap-2 animate-pulse">
                 <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                 <span className="text-xs font-black text-red-600">{errorMessage}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>جاري الدخول...</span>
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100 pt-6">
             <p className="text-[10px] font-bold text-slate-400">جميع الحقوق محفوظة © 2025</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
