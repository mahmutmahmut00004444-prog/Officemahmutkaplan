
import React, { useState, useEffect, useRef } from 'react';
import { OfficeUser, LoggedInUser, CIRCLE_NAMES, CircleType } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import ContextMenuModal, { ContextMenuItem } from './ContextMenuModal'; 
import { formatCurrency } from '../lib/formatCurrency';

interface ManageOfficesProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  loggedInUser: LoggedInUser | null;
  onLogout: () => void;
  fetchAllData: (silent?: boolean) => Promise<void>;
  allOfficeUsers: OfficeUser[]; 
  onGoBack: () => void;
  onOpenOfficeStatement: (office: OfficeUser) => void;
}

const ManageOffices: React.FC<ManageOfficesProps> = ({ showToast, loggedInUser, onLogout, fetchAllData, allOfficeUsers, onGoBack, onOpenOfficeStatement }) => {
  const [offices, setOffices] = useState<OfficeUser[]>([]);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeUsername, setNewOfficeUsername] = useState(''); // حقل جديد
  const [newOfficePassword, setNewOfficePassword] = useState('');
  const [newOfficePhone, setNewOfficePhone] = useState('');
  const [newPriceRightMosul, setNewPriceRightMosul] = useState<number | ''>('');
  const [newPriceLeftMosul, setNewPriceLeftMosul] = useState<number | ''>('');
  const [newPriceHammamAlAlil, setNewPriceHammamAlAlil] = useState<number | ''>('');
  const [newPriceAlShoura, setNewPriceAlShoura] = useState<number | ''>('');
  const [newPriceBaaj, setNewPriceBaaj] = useState<number | ''>('');
  const [newPriceOthers, setNewPriceOthers] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [submittingNewOffice, setSubmittingNewOffice] = useState(false);
  
  const [deleteOfficeConfirm, setDeleteOfficeConfirm] = useState<OfficeUser | null>(null);
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState<OfficeUser | null>(null);
  const [forceLogoutConfirm, setForceLogoutConfirm] = useState<OfficeUser | null>(null); 
  const [newResetPassword, setNewResetPassword] = useState('');

  const [editingOfficeUser, setEditingOfficeUser] = useState<OfficeUser | null>(null);
  const [editOfficeName, setEditOfficeName] = useState('');
  const [editOfficeUsername, setEditOfficeUsername] = useState(''); // حقل جديد
  const [editPassword, setEditPassword] = useState(''); 
  const [editOfficePhone, setEditOfficePhone] = useState('');
  const [editPriceRightMosul, setEditPriceRightMosul] = useState<number | ''>('');
  const [editPriceLeftMosul, setEditPriceLeftMosul] = useState<number | ''>('');
  const [editPriceHammamAlAlil, setEditPriceHammamAlAlil] = useState<number | ''>('');
  const [editPriceAlShoura, setEditPriceAlShoura] = useState<number | ''>('');
  const [editPriceBaaj, setEditPriceBaaj] = useState<number | ''>('');
  const [editPriceOthers, setEditPriceOthers] = useState<number | ''>('');

  const [isContextMenuModalOpen, setIsContextMenuModalOpen] = useState(false);
  const [currentContextMenuOffice, setCurrentContextMenuOffice] = useState<OfficeUser | null>(null);
  const [showNewOfficeForm, setShowNewOfficeForm] = useState(false);
  const newOfficeNameRef = useRef<HTMLInputElement>(null);

  const isAdmin = loggedInUser?.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin) setOffices(allOfficeUsers);
  }, [allOfficeUsers, isAdmin]);

  useEffect(() => {
    if (showNewOfficeForm && newOfficeNameRef.current) newOfficeNameRef.current.focus();
  }, [showNewOfficeForm]);

  const handleCreateOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newOfficeName.trim() || !newOfficePassword.trim() || !newOfficeUsername.trim()) {
      showToast('الرجاء إدخال البيانات المطلوبة (الاسم، اليوزر، الرمز)', 'error');
      return;
    }
    setSubmittingNewOffice(true);
    try {
      const { error } = await supabase.from('office_users').insert({
        office_name: newOfficeName.trim(),
        username: newOfficeUsername.trim(), // الحقل الجديد
        password: newOfficePassword.trim(),
        phone_number: newOfficePhone.trim(),
        created_by: loggedInUser.username,
        price_right_mosul: Number(newPriceRightMosul) || 0,
        price_left_mosul: Number(newPriceLeftMosul) || 0,
        price_hammam_alalil: Number(newPriceHammamAlAlil) || 0,
        price_alshoura: Number(newPriceAlShoura) || 0,
        price_baaj: Number(newPriceBaaj) || 0,
        price_others: Number(newPriceOthers) || 0,
      });
      if (error) throw error;
      showToast('تم إنشاء المكتب بنجاح', 'success');
      setNewOfficeName(''); setNewOfficeUsername(''); setNewOfficePassword(''); setNewPriceRightMosul(''); setNewPriceLeftMosul(''); setShowNewOfficeForm(false);
      fetchAllData(true);
    } catch (error: any) { 
      showToast(`خطأ في الإنشاء: ${error.message}`, 'error'); 
    } 
    finally { setSubmittingNewOffice(false); }
  };

  const handleUpdateOfficeUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingOfficeUser) return;
    setLoading(true);
    try {
      const nameChanged = editOfficeName.trim() !== editingOfficeUser.office_name;
      if (nameChanged) {
        const { error: updateRecordsError } = await supabase
          .from('office_records')
          .update({ affiliation: editOfficeName.trim() })
          .eq('affiliation', editingOfficeUser.office_name);
        if (updateRecordsError) throw new Error('فشل تحديث تبعية السجلات');
      }

      const payload: any = { 
        office_name: editOfficeName.trim(), 
        username: editOfficeUsername.trim(), // الحقل الجديد
        phone_number: editOfficePhone.trim(),
        price_right_mosul: Number(editPriceRightMosul) || 0, 
        price_left_mosul: Number(editPriceLeftMosul) || 0, 
        price_hammam_alalil: Number(editPriceHammamAlAlil) || 0,
        price_alshoura: Number(editPriceAlShoura) || 0,
        price_baaj: Number(editPriceBaaj) || 0,
        price_others: Number(editPriceOthers) || 0 
      };
      
      if (editPassword.trim()) payload.password = editPassword.trim();

      const { error } = await supabase
        .from('office_users')
        .update(payload)
        .eq('id', editingOfficeUser.id);

      if (error) throw error;
      showToast('تم تحديث بيانات المكتب بنجاح', 'success');
      setEditingOfficeUser(null);
      await fetchAllData(true);
    } catch (e: any) { 
      showToast(`فشل التحديث: ${e.message}`, 'error'); 
    } 
    finally { setLoading(false); }
  };

  const handleConfirmDeleteOffice = async () => {
    if (!deleteOfficeConfirm) return;
    setLoading(true);
    try {
      await supabase.from('office_records').update({ affiliation: 'المكتب المحذوف' }).eq('affiliation', deleteOfficeConfirm.office_name);
      await supabase.from('office_users').delete().eq('id', deleteOfficeConfirm.id);
      showToast('تم حذف المكتب', 'success');
      setDeleteOfficeConfirm(null);
      fetchAllData(true);
    } catch (e) { showToast('فشل الحذف', 'error'); } 
    finally { setLoading(false); }
  };

  const handleEditOfficeUser = (office: OfficeUser) => {
    setEditingOfficeUser(office);
    setEditOfficeName(office.office_name);
    setEditOfficeUsername(office.username || ''); // تعبئة اليوزر
    setEditOfficePhone(office.phone_number || '');
    setEditPassword('');
    setEditPriceRightMosul(office.priceRightMosul || '');
    setEditPriceLeftMosul(office.priceLeftMosul || '');
    setEditPriceHammamAlAlil(office.priceHammamAlAlil || '');
    setEditPriceAlShoura(office.priceAlShoura || '');
    setEditPriceBaaj(office.priceBaaj || '');
    setEditPriceOthers(office.priceOthers || '');
    setIsContextMenuModalOpen(false);
  };

  const handleResetPassword = (office: OfficeUser) => {
    setResetPasswordConfirm(office);
    setNewResetPassword('');
    setIsContextMenuModalOpen(false);
  };

  const handleForceLogout = (office: OfficeUser) => {
    setForceLogoutConfirm(office);
    setIsContextMenuModalOpen(false);
  };

  const handleConfirmForceLogout = async () => {
     if (!forceLogoutConfirm) return;
     setLoading(true);
     try {
       await supabase.from('office_users').update({ force_logout: true }).eq('id', forceLogoutConfirm.id);
       showToast(`تم إرسال أمر تسجيل الخروج لـ ${forceLogoutConfirm.office_name}`, 'success');
       setForceLogoutConfirm(null);
     } catch (e) { showToast('فشل العملية', 'error'); }
     finally { setLoading(false); }
  };

  const handleDeleteOffice = (office: OfficeUser) => {
    setDeleteOfficeConfirm(office);
    setIsContextMenuModalOpen(false);
  };

  const handleContextMenuClick = (office: OfficeUser) => {
    setCurrentContextMenuOffice(office);
    setIsContextMenuModalOpen(true);
  };

  const handlePriceInput = (value: string, setter: (val: number | '') => void) => {
    const num = parseFloat(value);
    setter(isNaN(num) ? '' : num);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-scale-up pb-40">
      {deleteOfficeConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-[2rem] w-full max-sm text-center border-2 border-slate-900 animate-scale-up">
            <h3 className="text-xl font-black mb-2 text-red-600">حذف المكتب</h3>
            <p className="text-slate-500 mb-6 font-bold text-sm">حذف حساب "{deleteOfficeConfirm.office_name}"؟</p>
            <div className="flex gap-2">
              <button onClick={handleConfirmDeleteOffice} disabled={loading} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black">حذف</button>
              <button onClick={() => setDeleteOfficeConfirm(null)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {resetPasswordConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-[2rem] w-full max-sm text-center border-2 border-slate-900 animate-scale-up">
            <h3 className="text-xl font-black mb-2 text-blue-600">كلمة مرور جديدة</h3>
            <input type="text" value={newResetPassword} onChange={e => setNewResetPassword(e.target.value)} placeholder="كلمة المرور الجديدة" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-center mb-6" />
            <div className="flex gap-2">
              <button onClick={async () => {
                await supabase.from('office_users').update({ password: newResetPassword }).eq('id', resetPasswordConfirm.id);
                showToast('تم التحديث', 'success');
                setResetPasswordConfirm(null);
              }} disabled={loading || !newResetPassword.trim()} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black">تأكيد</button>
              <button onClick={() => setResetPasswordConfirm(null)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {forceLogoutConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up">
            <h3 className="text-2xl font-black mb-3">طرد المكتب</h3>
            <p className="text-slate-500 mb-8 font-bold text-sm">طرد "{forceLogoutConfirm.office_name}" فوراً؟</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleConfirmForceLogout} disabled={loading} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black">تأكيد الطرد</button>
              <button onClick={() => setForceLogoutConfirm(null)} className="w-full text-slate-400 font-bold py-2">تراجع</button>
            </div>
          </div>
        </div>
      )}

      {editingOfficeUser && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-xl border-2 border-slate-900 shadow-2xl animate-scale-up">
            <h3 className="text-2xl font-black mb-6 text-center text-slate-900">تعديل بيانات المكتب</h3>
            <form onSubmit={handleUpdateOfficeUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" value={editOfficeName} onChange={e => setEditOfficeName(e.target.value)} placeholder="اسم المكتب" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-center" />
                <input type="text" value={editOfficeUsername} onChange={e => setEditOfficeUsername(e.target.value)} placeholder="اسم المستخدم (اليوزر)" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-center" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" value={editOfficePhone} onChange={e => setEditOfficePhone(e.target.value)} placeholder="رقم الهاتف" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-center" />
                <input type="text" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="كلمة السر الجديدة (اختياري)" className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-center" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-black mr-2">الأيمن</label><input type="number" step="any" value={editPriceRightMosul} onChange={e => handlePriceInput(e.target.value, setEditPriceRightMosul)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black mr-2">الأيسر</label><input type="number" step="any" value={editPriceLeftMosul} onChange={e => handlePriceInput(e.target.value, setEditPriceLeftMosul)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black mr-2">حمام العليل</label><input type="number" step="any" value={editPriceHammamAlAlil} onChange={e => handlePriceInput(e.target.value, setEditPriceHammamAlAlil)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black mr-2">الشورة</label><input type="number" step="any" value={editPriceAlShoura} onChange={e => handlePriceInput(e.target.value, setEditPriceAlShoura)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black mr-2">البعاج</label><input type="number" step="any" value={editPriceBaaj} onChange={e => handlePriceInput(e.target.value, setEditPriceBaaj)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black mr-2">أخرى</label><input type="number" step="any" value={editPriceOthers} onChange={e => handlePriceInput(e.target.value, setEditPriceOthers)} className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-center" /></div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black">حفظ التغييرات</button>
                <button type="button" onClick={() => setEditingOfficeUser(null)} className="flex-1 bg-slate-100 py-4 rounded-xl font-black">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ContextMenuModal
        isOpen={isContextMenuModalOpen}
        onClose={() => setIsContextMenuModalOpen(false)}
        menuItems={[
          { label: '💵 كشف رصيد المكتب', onClick: () => onOpenOfficeStatement(currentContextMenuOffice!) },
          { label: '📥 تسديد حساب المكتب الآن', onClick: () => { 
              onOpenOfficeStatement(currentContextMenuOffice!); 
          } },
          { isSeparator: true },
          { label: 'تعديل بيانات المكتب والأسعار', onClick: () => handleEditOfficeUser(currentContextMenuOffice!) },
          { label: 'تغيير الرمز السري للحساب', onClick: () => handleResetPassword(currentContextMenuOffice!) },
          { label: 'طرد المكتب (خروج قسري)', onClick: () => handleForceLogout(currentContextMenuOffice!), isDestructive: true },
          { isSeparator: true },
          { label: 'حذف المكتب نهائياً', onClick: () => handleDeleteOffice(currentContextMenuOffice!), isDestructive: true }
        ]}
        title={currentContextMenuOffice ? `إدارة المكتب: ${currentContextMenuOffice.office_name}` : ''}
      />

      <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 z-10 p-2">
          <button onClick={onGoBack} className="p-3 bg-white text-slate-600 rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg></button>
        </div>
        <div className="relative pt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-black text-slate-900">إدارة مكاتب الوكلاء</h2>
            <button onClick={() => setShowNewOfficeForm(!showNewOfficeForm)} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-all"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M12 4v16m8-8H4"/></svg></button>
          </div>
          
          {showNewOfficeForm && (
            <form onSubmit={handleCreateOffice} className="mt-8 grid grid-cols-1 gap-4 animate-scale-up p-6 bg-slate-50 rounded-3xl border-2 border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input ref={newOfficeNameRef} type="text" value={newOfficeName} onChange={e => setNewOfficeName(e.target.value)} placeholder="اسم المكتب الجديد" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm outline-none" />
                <input type="text" value={newOfficeUsername} onChange={e => setNewOfficeUsername(e.target.value)} placeholder="اسم المستخدم (اليوزر)" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm outline-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" value={newOfficePhone} onChange={e => setNewOfficePhone(e.target.value)} placeholder="رقم الهاتف" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm outline-none" />
                <input type="text" value={newOfficePassword} onChange={e => setNewOfficePassword(e.target.value)} placeholder="الرمز السري" className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-black text-sm outline-none" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {['الأيمن', 'الأيسر', 'حمام العليل', 'الشورة', 'البعاج', 'أخرى'].map((l, idx) => {
                  const setters = [setNewPriceRightMosul, setNewPriceLeftMosul, setNewPriceHammamAlAlil, setNewPriceAlShoura, setNewPriceBaaj, setNewPriceOthers];
                  const vals = [newPriceRightMosul, newPriceLeftMosul, newPriceHammamAlAlil, newPriceAlShoura, newPriceBaaj, newPriceOthers];
                  return (
                    <div key={l} className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 mr-2">{l}</label>
                      <input type="number" step="any" value={vals[idx]} onChange={e => handlePriceInput(e.target.value, setters[idx])} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-black text-center" />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submittingNewOffice} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl">تفعيل حساب المكتب</button>
                <button type="button" onClick={() => setShowNewOfficeForm(false)} className="px-8 bg-slate-200 text-slate-600 rounded-2xl font-black">إلغاء</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border-2 border-slate-900 shadow-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right min-w-[800px]">
            <thead>
              <tr className="bg-blue-900 text-white">
                <th className="px-6 py-4 text-[11px] font-black w-16 text-center">ت</th>
                <th className="px-6 py-4 text-[11px] font-black">اسم المكتب</th>
                <th className="px-6 py-4 text-[11px] font-black">اسم المستخدم (اليوزر)</th>
                <th className="px-6 py-4 text-[11px] font-black text-center w-24">خيارات</th>
              </tr>
            </thead>
            <tbody>
              {offices.map((o, i) => (
                <tr key={o.id} onClick={() => handleContextMenuClick(o)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group">
                  <td className="px-6 py-4 text-xs font-black text-slate-400 text-center">{i + 1}</td>
                  <td className="px-6 py-4 text-sm font-black text-slate-800">{o.office_name}</td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-600">{o.username || o.office_name}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-2 bg-slate-100 text-slate-500 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default ManageOffices;
