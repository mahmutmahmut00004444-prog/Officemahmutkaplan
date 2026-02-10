
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Session, LoggedInUser, Device, SessionStats } from '../types';
import ContextMenuModal, { ContextMenuItem } from './ContextMenuModal';

interface SessionsManagerProps {
  onGoBack: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  loggedInUser: LoggedInUser;
  onStatsUpdate?: (stats: SessionStats) => void;
}

type TabView = 'LIST' | 'ADDITIONS';

export default function SessionsManager({ onGoBack, showToast, loggedInUser, onStatsUpdate }: SessionsManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('LIST');
  
  // Forms State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneSource, setPhoneSource] = useState(''); // Sticky State
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(''); // Sticky State
  const [lastBookingDate, setLastBookingDate] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Source State
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState('ALL');
  const [filterDevice, setFilterDevice] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');
  const [filterUploaded, setFilterUploaded] = useState<'ALL' | 'UPLOADED' | 'NOT_UPLOADED'>('ALL');
  
  // Availability Logic State & Cooldown
  const [actualCooldownDays, setActualCooldownDays] = useState<number>(0);
  const [tempCooldownDays, setTempCooldownDays] = useState<number>(0);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  // Context Menu & Modals
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<Session | null>(null);

  // Edit Session State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editPhoneSource, setEditPhoneSource] = useState('');
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editLastBookingDate, setEditLastBookingDate] = useState('');
  const [editIsUploaded, setEditIsUploaded] = useState(false);

  // Manual Date Booking State
  const [isBookDateModalOpen, setIsBookDateModalOpen] = useState(false);
  const [manualBookDate, setManualBookDate] = useState('');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk Actions Confirmations
  const [showBulkCancelConfirm, setShowBulkCancelConfirm] = useState(false); // Global Cancel
  const [showBulkDeleteSelectedConfirm, setShowBulkDeleteSelectedConfirm] = useState(false); // Delete Selected

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect when searching
  useEffect(() => {
    if (searchQuery && tableContainerRef.current) {
      tableContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchSessions();
    fetchDevices();
    fetchCooldownSettings();
  }, []);

  const fetchCooldownSettings = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'session_cooldown_days')
        .single();
      
      if (data) {
        const val = parseInt(data.value) || 0;
        setActualCooldownDays(val);
        setTempCooldownDays(val);
      } else if (error && error.code !== 'PGRST116') { // Ignore "Row not found" error
        console.error('Error fetching settings:', error);
      }
    } catch (err) {
      console.error('Settings fetch error:', err);
    }
  };

  const formatDateInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    let formatted = '';
    if (digits.length > 0) {
      formatted += digits.substring(0, 4);
      if (digits.length > 4) {
        formatted += '-' + digits.substring(4, 6);
        if (digits.length > 6) {
          formatted += '-' + digits.substring(6, 8);
        }
      }
    }
    return formatted;
  };

  const fetchDevices = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDevices((data || []).map((d: any) => ({
        id: d.id,
        deviceName: d.device_name,
        createdAt: new Date(d.created_at).getTime(),
        createdBy: d.created_by
      })));
    } catch (err: any) {
      console.error('Error fetching devices:', err);
    }
  };

  const fetchSessions = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      let data, error;
      try {
        const res = await supabase
          .from('sessions')
          .select('*, devices(device_name)')
          .order('created_at', { ascending: true }); // الجديد في الأسفل
        data = res.data;
        error = res.error;
      } catch (e) {
        // Ignored
      }

      if (error) {
         console.warn("Fetch with join failed, falling back to simple fetch", error);
         const resSimple = await supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: true }); // الجديد في الأسفل
         data = resSimple.data;
         error = resSimple.error;
      }

      if (error) throw error;

      setSessions((data || []).map((s: any) => {
        let deviceData = s.devices;
        if (Array.isArray(deviceData)) deviceData = deviceData[0];
        
        return {
          id: s.id,
          phoneNumber: s.phone_number,
          phoneSource: s.phone_source,
          deviceId: s.device_id,
          device: deviceData ? { deviceName: deviceData.device_name } : undefined,
          lastBookingDate: s.last_booking_date,
          isBooked: s.is_booked || false,
          isUploaded: s.is_uploaded || false,
          createdAt: new Date(s.created_at).getTime(),
          createdBy: s.created_by
        };
      }));
    } catch (err: any) {
      showToast(`فشل جلب الجلسات: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Logic to check availability based on days
  const checkAvailability = (lastDateStr?: string) => {
    if (!lastDateStr) return true;
    if (actualCooldownDays === 0) return true; 
    
    const lastDate = new Date(lastDateStr);
    // Check if date is valid
    if (isNaN(lastDate.getTime())) return true;

    const today = new Date();
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    
    return diffDays >= actualCooldownDays;
  };

  // حساب تكرار الأرقام لكشف المكرر
  const phoneFrequencies = useMemo(() => {
    const freqs: Record<string, number> = {};
    sessions.forEach(s => {
      if (s.phoneNumber) {
        const cleanPhone = s.phoneNumber.trim();
        freqs[cleanPhone] = (freqs[cleanPhone] || 0) + 1;
      }
    });
    return freqs;
  }, [sessions]);

  // Update Stats Effect
  useEffect(() => {
    const total = sessions.length;
    const available = sessions.filter(s => checkAvailability(s.lastBookingDate)).length;
    const unavailable = total - available;
    if (onStatsUpdate) {
        onStatsUpdate({ total, available, unavailable });
    }
  }, [sessions, actualCooldownDays, onStatsUpdate]);

  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Search
    if (searchQuery.trim()) {
      result = result.filter(s => s.phoneNumber.includes(searchQuery.trim()));
    }

    // Filter Source
    if (filterSource !== 'ALL') {
      result = result.filter(s => (s.phoneSource || 'بدون مصدر') === filterSource);
    }

    // Filter Device
    if (filterDevice !== 'ALL') {
      result = result.filter(s => s.deviceId === filterDevice);
    }

    // Filter Availability Status
    if (filterStatus !== 'ALL') {
      result = result.filter(s => {
        const isAvailable = checkAvailability(s.lastBookingDate);
        return filterStatus === 'AVAILABLE' ? isAvailable : !isAvailable;
      });
    }

    // Filter Uploaded Status
    if (filterUploaded !== 'ALL') {
      result = result.filter(s => {
        return filterUploaded === 'UPLOADED' ? s.isUploaded : !s.isUploaded;
      });
    }

    return result;
  }, [sessions, searchQuery, filterSource, filterDevice, filterStatus, filterUploaded, actualCooldownDays]);

  // Combine DB sources and Custom added sources for the dropdown
  const uniqueSources = useMemo(() => {
    const dbSources = Array.from(new Set(sessions.map(s => s.phoneSource || '').filter(s => s !== '')));
    return Array.from(new Set([...dbSources, ...customSources]));
  }, [sessions, customSources]);

  // Multi-select handlers
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSessions.length && filteredSessions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map(s => s.id)));
    }
  };

  // --- Bulk Actions ---

  const handleBulkUploadSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('sessions').update({ is_uploaded: true }).in('id', ids);
      if (error) throw error;
      
      showToast(`تم رفع ${ids.length} جلسة بنجاح`, 'success');
      setSessions(prev => prev.map(s => ids.includes(s.id) ? { ...s, isUploaded: true } : s));
      setSelectedIds(new Set());
    } catch (err: any) {
      showToast(`فشل الرفع الجماعي: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUnuploadSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('sessions').update({ is_uploaded: false }).in('id', ids);
      if (error) throw error;
      
      showToast(`تم إلغاء رفع ${ids.length} جلسة`, 'success');
      setSessions(prev => prev.map(s => ids.includes(s.id) ? { ...s, isUploaded: false } : s));
      setSelectedIds(new Set());
    } catch (err: any) {
      showToast(`فشل العملية: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('sessions').delete().in('id', ids);
      if (error) throw error;
      
      showToast(`تم حذف ${ids.length} جلسة نهائياً`, 'success');
      setSessions(prev => prev.filter(s => !ids.includes(s.id)));
      setSelectedIds(new Set());
      setShowBulkDeleteSelectedConfirm(false);
    } catch (err: any) {
      showToast(`فشل الحذف الجماعي: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAllUploads = async () => {
    setIsSubmitting(true);
    try {
      // Sets is_uploaded = false for ALL sessions in the database
      const { error } = await supabase.from('sessions').update({ is_uploaded: false }).neq('id', '00000000-0000-0000-0000-000000000000'); 
      if (error) throw error;

      showToast('تم إلغاء رفع جميع الجلسات', 'success');
      setSessions(prev => prev.map(s => ({ ...s, isUploaded: false })));
      setShowBulkCancelConfirm(false);
    } catch (err: any) {
      showToast(`فشل الإلغاء: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) {
      showToast('يرجى إدخال اسم الهاتف (النسخة)', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('devices').insert({
        device_name: newDeviceName.trim(),
        created_by: loggedInUser.username
      });

      if (error) throw error;

      showToast('تم تسجيل النسخة (الجهاز) بنجاح', 'success');
      setNewDeviceName('');
      fetchDevices();
    } catch (err: any) {
      showToast(`خطأ في الحفظ: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNewSource = () => {
    if (!newSourceName.trim()) return;
    if (!uniqueSources.includes(newSourceName.trim())) {
      setCustomSources(prev => [...prev, newSourceName.trim()]);
    }
    setPhoneSource(newSourceName.trim()); // Auto select
    setNewSourceName('');
    setIsAddSourceModalOpen(false);
    showToast('تمت إضافة المصدر للقائمة', 'success');
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // التحقق من أن رقم الهاتف موجود
    if (!phoneNumber.trim()) {
      showToast('يرجى إدخال رقم الهاتف', 'error');
      return;
    }

    // التحقق من أن رقم الهاتف يتكون من 11 رقم حصراً
    if (phoneNumber.trim().length !== 11) {
      showToast('يجب أن يتكون رقم الهاتف من 11 رقم حصراً', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('sessions').insert({
        phone_number: phoneNumber.trim(),
        phone_source: phoneSource.trim(), // Stays sticky
        device_id: selectedDeviceId || null, // Stays sticky
        last_booking_date: lastBookingDate.trim(),
        created_by: loggedInUser.username
      });

      if (error) throw error;

      showToast('تم حفظ الجلسة بنجاح', 'success');
      setPhoneNumber('');
      // setPhoneSource(''); // REMOVED to keep sticky
      setLastBookingDate('');
      
      // Refresh the table immediately
      await fetchSessions();
    } catch (err: any) {
      showToast(`خطأ في الحفظ: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRowClick = (session: Session) => {
    setSelectedSession(session);
    setIsContextMenuOpen(true);
  };

  const handleMarkAsBooked = async () => {
    if (!selectedSession) return;
    const today = new Date().toISOString().split('T')[0];

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ 
          is_booked: true,
          last_booking_date: today 
        })
        .eq('id', selectedSession.id);

      if (error) throw error;
      showToast('تم تحديث تاريخ الحجز لليوم', 'success');
      
      setSessions(prev => prev.map(s => 
        s.id === selectedSession.id 
          ? { ...s, isBooked: true, lastBookingDate: today } 
          : s
      ));
    } catch (err: any) {
      showToast(`فشل التحديث: ${err.message}`, 'error');
    }
  };

  // وظيفة رفع الجلسة (تبديل الحالة)
  const handleToggleUploadStatus = async () => {
    if (!selectedSession) return;
    const newStatus = !selectedSession.isUploaded;
    
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ is_uploaded: newStatus })
        .eq('id', selectedSession.id);

      if (error) throw error;
      showToast(newStatus ? 'تم تغيير الحالة إلى مرفوع (جوزي)' : 'تم إلغاء حالة الرفع', 'success');
      
      setSessions(prev => prev.map(s => 
        s.id === selectedSession.id 
          ? { ...s, isUploaded: newStatus } 
          : s
      ));
    } catch (err: any) {
      showToast(`فشل التحديث: ${err.message}`, 'error');
    }
  };

  // --- Handlers for Edit Session ---
  const openEditModal = (session: Session) => {
    setEditPhoneNumber(session.phoneNumber);
    setEditPhoneSource(session.phoneSource || '');
    setEditDeviceId(session.deviceId || '');
    setEditLastBookingDate(session.lastBookingDate || '');
    setEditIsUploaded(session.isUploaded || false);
    setIsEditModalOpen(true);
  };

  const saveEditedSession = async () => {
    if (!selectedSession) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('sessions').update({
        phone_number: editPhoneNumber,
        phone_source: editPhoneSource,
        device_id: editDeviceId || null,
        last_booking_date: editLastBookingDate,
        is_uploaded: editIsUploaded
      }).eq('id', selectedSession.id);

      if (error) throw error;
      showToast('تم تعديل الجلسة بنجاح', 'success');
      await fetchSessions();
      setIsEditModalOpen(false);
    } catch (err: any) {
      showToast(`فشل التعديل: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers for Manual Date Booking ---
  const openBookDateModal = (session: Session) => {
    const today = new Date().toISOString().split('T')[0];
    setManualBookDate(today);
    setIsBookDateModalOpen(true);
  };

  const confirmBookDate = async () => {
    if (!selectedSession || !manualBookDate) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('sessions').update({
        is_booked: true,
        last_booking_date: manualBookDate
      }).eq('id', selectedSession.id);

      if (error) throw error;
      showToast(`تم الحجز بتاريخ ${manualBookDate}`, 'success');
      
      setSessions(prev => prev.map(s => 
        s.id === selectedSession.id 
          ? { ...s, isBooked: true, lastBookingDate: manualBookDate } 
          : s
      ));
      setIsBookDateModalOpen(false);
    } catch (err: any) {
      showToast(`فشل التحديث: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteSession = async () => {
    if (!deleteConfirmSession) return;
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', deleteConfirmSession.id);
      if (error) throw error;
      showToast('تم حذف الجلسة بنجاح', 'success');
      setSessions(prev => prev.filter(s => s.id !== deleteConfirmSession.id));
      setDeleteConfirmSession(null);
      
      if (selectedSession?.id === deleteConfirmSession.id) {
        setIsContextMenuOpen(false);
        setSelectedSession(null);
      }
    } catch (err: any) {
      showToast(`فشل الحذف: ${err.message}`, 'error');
    }
  };

  const handleUpdateCooldown = async () => {
    if (confirmationText.trim() === 'تأكيد') {
      try {
        const basePayload = {
          key: 'session_cooldown_days',
          value: tempCooldownDays.toString(),
          updated_at: new Date().toISOString()
        };

        let { error } = await supabase.from('app_settings').upsert({
          ...basePayload,
          updated_by: loggedInUser.username,
        });

        if (error) {
           const msg = error.message.toLowerCase();
           if (
             msg.includes('updated_by') || 
             msg.includes('schema cache') || 
             msg.includes('column') ||
             error.code === '42703'
           ) {
              const retry = await supabase.from('app_settings').upsert(basePayload);
              error = retry.error;
           }
        }

        if (error) throw error;

        setActualCooldownDays(tempCooldownDays);
        setIsConfirmModalOpen(false);
        setConfirmationText('');
        showToast('تم حفظ مدة الصلاحية بنجاح', 'success');
      } catch (err: any) {
        showToast(`فشل الحفظ: ${err.message}`, 'error');
      }
    } else {
      showToast('كلمة التأكيد غير صحيحة', 'error');
    }
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!selectedSession) return [];
    return [
      { 
        label: '✏️ تعديل البيانات', 
        onClick: () => openEditModal(selectedSession),
      },
      { isSeparator: true },
      { 
        label: selectedSession.isUploaded ? '🚫 إلغاء الرفع' : '🤎 تم الرفع (جوزي)', 
        onClick: handleToggleUploadStatus,
      },
      { isSeparator: true },
      { 
        label: '✅ تم الحجز (اليوم)', 
        onClick: handleMarkAsBooked,
      },
      { 
        label: '📅 تم الحجز (تاريخ يدوي)', 
        onClick: () => openBookDateModal(selectedSession),
      },
      { isSeparator: true },
      { 
        label: '🗑️ حذف الجلسة نهائياً', 
        onClick: () => setDeleteConfirmSession(selectedSession), 
        isDestructive: true 
      }
    ];
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-40">
      {/* Context Menu */}
      <ContextMenuModal 
        isOpen={isContextMenuOpen} 
        onClose={() => setIsContextMenuOpen(false)} 
        menuItems={getContextMenuItems()} 
        title={selectedSession ? `خيارات الرقم: <strong>${selectedSession.phoneNumber}</strong>` : ''} 
      />

      {/* Edit Session Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-[2rem] w-full max-w-sm border-2 border-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
             <h3 className="text-xl font-black text-slate-900 mb-4">تعديل الجلسة</h3>
             <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase">الجهاز</label>
                  <select value={editDeviceId} onChange={e => setEditDeviceId(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none">
                    <option value="">-- بدون جهاز --</option>
                    {devices.map(d => <option key={d.id} value={d.id}>{d.deviceName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase">رقم الهاتف</label>
                  <input type="text" value={editPhoneNumber} onChange={e => setEditPhoneNumber(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase">المصدر</label>
                  <select value={editPhoneSource} onChange={e => setEditPhoneSource(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none">
                    <option value="">-- اختر المصدر --</option>
                    {uniqueSources.map(src => <option key={src} value={src}>{src}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase">تاريخ آخر حجز</label>
                  <input type="text" value={editLastBookingDate} onChange={e => setEditLastBookingDate(formatDateInput(e.target.value))} placeholder="YYYY-MM-DD" maxLength={10} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none text-center" />
                </div>
                <div className="pt-2">
                   <button 
                     type="button" 
                     onClick={() => setEditIsUploaded(!editIsUploaded)} 
                     className={`w-full py-3 rounded-xl border-2 font-black transition-all ${editIsUploaded ? 'bg-amber-100 text-amber-900 border-amber-900' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                   >
                     {editIsUploaded ? 'حالة الرفع: تم الرفع ✅' : 'حالة الرفع: غير مرفوع'}
                   </button>
                </div>
             </div>
             <div className="flex gap-2 mt-6">
               <button onClick={saveEditedSession} disabled={isSubmitting} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-sm shadow-md active:scale-95 transition-all">{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</button>
               <button onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black text-sm">إلغاء</button>
             </div>
          </div>
        </div>
      )}

      {/* Manual Date Booking Modal */}
      {isBookDateModalOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-[2rem] w-full max-w-xs border-2 border-slate-900 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
             <h3 className="text-xl font-black text-slate-900 mb-2">تحديد تاريخ الحجز</h3>
             <p className="text-slate-500 font-bold text-xs mb-4">اكتب التاريخ يدوياً لتحديث حالة الرقم</p>
             <input 
               autoFocus
               type="text" 
               value={manualBookDate} 
               onChange={e => setManualBookDate(formatDateInput(e.target.value))} 
               placeholder="YYYY-MM-DD" 
               maxLength={10}
               className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-lg outline-none focus:border-green-500 mb-6 text-center"
             />
             <div className="flex gap-2">
               <button onClick={confirmBookDate} disabled={isSubmitting || !manualBookDate} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black text-sm shadow-md active:scale-95 transition-all">تأكيد الحجز</button>
               <button onClick={() => setIsBookDateModalOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black text-sm">إلغاء</button>
             </div>
          </div>
        </div>
      )}

      {/* Add New Source Modal */}
      {isAddSourceModalOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-[2rem] w-full max-w-sm border-2 border-slate-900 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
             <h3 className="text-lg font-black text-slate-900 mb-4">إضافة مصدر جديد</h3>
             <input 
               autoFocus
               type="text" 
               value={newSourceName} 
               onChange={e => setNewSourceName(e.target.value)} 
               placeholder="اسم المصدر (مثلاً: تلكرام)" 
               className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-sm outline-none focus:border-blue-500 mb-4"
             />
             <div className="flex gap-2">
               <button onClick={handleAddNewSource} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-sm">إضافة</button>
               <button onClick={() => setIsAddSourceModalOpen(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black text-sm">إلغاء</button>
             </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Cooldown Change */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
             <h3 className="text-xl font-black text-slate-900 mb-4">تأكيد تغيير مدة الصلاحية</h3>
             <p className="text-slate-500 font-bold text-sm mb-6">هل أنت متأكد من تغيير مدة صلاحية الرقم إلى <span className="text-blue-600 font-black text-lg">{tempCooldownDays}</span> يوم؟</p>
             <p className="text-red-500 font-bold text-xs mb-2">اكتب كلمة "تأكيد" للمتابعة:</p>
             <input 
               autoFocus
               type="text" 
               value={confirmationText} 
               onChange={e => setConfirmationText(e.target.value)} 
               placeholder="تأكيد" 
               className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-sm outline-none focus:border-blue-500 mb-6 text-center"
             />
             <div className="flex gap-2">
               <button onClick={handleUpdateCooldown} disabled={confirmationText.trim() !== 'تأكيد'} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black text-sm disabled:opacity-50">حفظ التغيير</button>
               <button onClick={() => { setIsConfirmModalOpen(false); setTempCooldownDays(actualCooldownDays); setConfirmationText(''); }} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black text-sm">إلغاء</button>
             </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmSession && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-black mb-3 text-red-600">تأكيد الحذف</h3>
            <p className="text-slate-500 mb-8 font-bold text-sm leading-relaxed">
              هل أنت متأكد من حذف الرقم <span className="text-slate-900 font-black" dir="ltr">{deleteConfirmSession.phoneNumber}</span>؟
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDeleteSession} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">موافق (حذف)</button>
              <button onClick={() => setDeleteConfirmSession(null)} className="w-full text-slate-400 font-black py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel All Uploads Confirmation Modal */}
      {showBulkCancelConfirm && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-black mb-3 text-red-600">إلغاء جميع الرفوعات</h3>
            <p className="text-slate-500 mb-8 font-bold text-sm leading-relaxed">
              هل أنت متأكد من إلغاء حالة الرفع لجميع الجلسات في النظام؟
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleCancelAllUploads} disabled={isSubmitting} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">نعم، إلغاء الجميع</button>
              <button onClick={() => setShowBulkCancelConfirm(false)} className="w-full text-slate-400 font-black py-2">تراجع</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Selected Confirmation Modal */}
      {showBulkDeleteSelectedConfirm && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-black mb-3 text-red-600">حذف الجلسات المحددة</h3>
            <p className="text-slate-500 mb-8 font-bold text-sm leading-relaxed">
              هل أنت متأكد من حذف <span className="text-red-600 font-black">{selectedIds.size}</span> جلسات بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={handleBulkDeleteSelected} disabled={isSubmitting} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">تأكيد الحذف</button>
              <button onClick={() => setShowBulkDeleteSelectedConfirm(false)} className="w-full text-slate-400 font-black py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border-2 border-slate-900 shadow-2xl relative overflow-hidden min-h-[600px] flex flex-col animate-scale-up">
        
        {/* Header Section: Title & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
           <div>
              <h2 className="text-2xl font-black text-slate-900">سجل الجلسات والأجهزة</h2>
              <p className="text-slate-500 font-bold text-xs mt-1 italic">إدارة أرقام الهواتف وربطها بالنسخ (الأجهزة)</p>
           </div>
           
           <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full md:w-auto">
              <button 
                onClick={() => setActiveTab('LIST')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'LIST' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                سجل الجلسات
              </button>
              <button 
                onClick={() => setActiveTab('ADDITIONS')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'ADDITIONS' ? 'bg-white text-fuchsia-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                إضافة جلسة / جهاز
              </button>
              <button 
                onClick={onGoBack}
                className="w-9 h-full bg-white text-slate-600 rounded-lg shadow-sm border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-center ml-1"
                title="رجوع"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
              </button>
           </div>
        </div>

        <div className="flex-1 flex flex-col h-full">
          {activeTab === 'ADDITIONS' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-scale-up">
               {/* Device Registration Form */}
               <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                   <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</div>
                      تسجيل نسخة جديدة (جهاز)
                   </h3>
                   <form onSubmit={handleSaveDevice} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase pr-2">اسم الهاتف (النسخة)</label>
                        <input 
                          type="text" 
                          value={newDeviceName} 
                          onChange={e => setNewDeviceName(e.target.value)} 
                          placeholder="مثلاً: iPhone 14 Pro - أحمد" 
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-slate-500 transition-all"
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-xs shadow-md hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isSubmitting ? 'جاري الحفظ...' : 'حفظ الجهاز'}
                      </button>
                   </form>
               </div>

               {/* Add Session Form */}
               <div className="bg-cyan-50 p-6 rounded-[2rem] border border-cyan-100">
                  <h3 className="text-base font-black text-cyan-900 mb-4 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-cyan-700 text-white flex items-center justify-center text-[10px]">2</div>
                      إضافة جلسة جديدة
                   </h3>
                  <form onSubmit={handleSaveSession} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[9px] font-black text-cyan-700 uppercase pr-2">اختيار النسخة (الجهاز)</label>
                      <select 
                        value={selectedDeviceId} 
                        onChange={e => setSelectedDeviceId(e.target.value)} 
                        className="w-full p-3 bg-white border border-cyan-200 rounded-xl font-bold text-xs outline-none focus:border-cyan-500 transition-all text-slate-700"
                      >
                        <option value="">-- بدون جهاز (اختياري) --</option>
                        {devices.map(d => (
                          <option key={d.id} value={d.id}>{d.deviceName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-cyan-700 uppercase pr-2">رقم الهاتف</label>
                      <input 
                        type="tel" 
                        inputMode="numeric"
                        maxLength={11}
                        value={phoneNumber} 
                        onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))} 
                        placeholder="أدخل رقم الهاتف (11 رقم)" 
                        className="w-full p-3 bg-white border border-cyan-200 rounded-xl font-bold text-xs outline-none focus:border-cyan-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-cyan-700 uppercase pr-2">مصدر الرقم</label>
                      <div className="flex gap-2">
                        <select 
                          value={phoneSource} 
                          onChange={e => setPhoneSource(e.target.value)} 
                          className="w-full p-3 bg-white border border-cyan-200 rounded-xl font-bold text-xs outline-none focus:border-cyan-500 transition-all"
                        >
                          <option value="">-- اختر المصدر --</option>
                          {uniqueSources.map(src => (
                            <option key={src} value={src}>{src}</option>
                          ))}
                        </select>
                        <button 
                          type="button" 
                          onClick={() => setIsAddSourceModalOpen(true)}
                          className="w-10 bg-cyan-600 text-white rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-all hover:bg-cyan-700"
                          title="إضافة مصدر جديد"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[9px] font-black text-cyan-700 uppercase pr-2">آخر حجز (اختياري)</label>
                      <input 
                        type="text" 
                        value={lastBookingDate} 
                        onChange={e => setLastBookingDate(formatDateInput(e.target.value))} 
                        placeholder="YYYY-MM-DD" 
                        maxLength={10}
                        className="w-full p-3 bg-white border border-cyan-200 rounded-xl font-bold text-xs outline-none focus:border-cyan-500 transition-all text-center"
                      />
                    </div>
                    <div className="md:col-span-2 pt-2">
                      <button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="w-full bg-cyan-600 text-white py-3 rounded-xl font-black text-xs shadow-md hover:bg-cyan-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? 'جاري الحفظ...' : 'حفظ الجلسة'}
                      </button>
                    </div>
                  </form>
               </div>
            </div>
          )}

          {activeTab === 'LIST' && (
            <div className="animate-scale-up flex-1 flex flex-col space-y-4 overflow-hidden">
              
              {/* New Toolbar matching ReviewerTable style */}
              <div className="bg-white p-3 rounded-2xl border-2 border-slate-900 shadow-sm">
                 
                 {/* Top Row: Cooldown (acting as the "header/settings" of the toolbar) */}
                 <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-100 pb-3 mb-3 gap-2">
                    <div className="flex items-center gap-2">
                        <div className="text-xs font-black text-slate-800">خيارات البحث والفلترة</div>
                        <div className="flex items-center gap-2 mr-4">
                            <span className="text-[10px] font-black text-slate-500 whitespace-nowrap">مدة صلاحية الرقم:</span>
                            <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200">
                                <input 
                                type="number" 
                                min="0"
                                value={tempCooldownDays} 
                                onChange={e => setTempCooldownDays(parseInt(e.target.value) || 0)} 
                                className="w-10 text-center font-black text-xs bg-transparent outline-none text-blue-600"
                                />
                                <span className="text-[9px] font-bold text-slate-400">يوم</span>
                            </div>
                            {tempCooldownDays !== actualCooldownDays && (
                            <button onClick={() => setIsConfirmModalOpen(true)} className="bg-green-600 text-white px-3 py-1 rounded-lg text-[9px] font-black hover:bg-green-700 transition-colors shadow-sm">حفظ</button>
                            )}
                        </div>
                    </div>
                    {/* Bulk Action Buttons */}
                    <div className="flex gap-2">
                        {selectedIds.size > 0 ? (
                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                                <button onClick={handleBulkUploadSelected} className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm active:scale-95 transition-all">رفع المحدد ({selectedIds.size})</button>
                                <button onClick={handleBulkUnuploadSelected} className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-slate-300 transition-all">إلغاء رفع المحدد</button>
                                <button onClick={() => setShowBulkDeleteSelectedConfirm(true)} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm active:scale-95 transition-all">حذف المحدد</button>
                            </div>
                        ) : (
                            <button onClick={() => setShowBulkCancelConfirm(true)} className="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-red-100 transition-all">إلغاء رفع الجميع</button>
                        )}
                    </div>
                 </div>

                 {/* Grid Filters */}
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 items-center">
                    {/* Search - Expanded */}
                    <div className="md:col-span-2">
                        <input 
                          type="text" 
                          placeholder="بحث برقم الهاتف..." 
                          value={searchQuery} 
                          onChange={e => setSearchQuery(e.target.value)} 
                          className="w-full h-9 px-4 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-black outline-none focus:border-blue-400" 
                        />
                    </div>
                    
                    {/* Source */}
                    <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
                      <option value="ALL">كل المصادر</option>
                      {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    {/* Device */}
                    <select value={filterDevice} onChange={e => setFilterDevice(e.target.value)} className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
                      <option value="ALL">كل الأجهزة</option>
                      {devices.map(d => <option key={d.id} value={d.id}>{d.deviceName}</option>)}
                    </select>

                    {/* Status */}
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
                      <option value="ALL">الحالة</option>
                      <option value="AVAILABLE">✅ متاح</option>
                      <option value="UNAVAILABLE">❌ محظور</option>
                    </select>

                    {/* Uploaded */}
                    <select value={filterUploaded} onChange={e => setFilterUploaded(e.target.value as any)} className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none cursor-pointer">
                      <option value="ALL">الرفع</option>
                      <option value="UPLOADED">🟣 مرفوع</option>
                      <option value="NOT_UPLOADED">⚪ غير</option>
                    </select>

                    {/* Reset */}
                    <button 
                      onClick={() => { setSearchQuery(''); setFilterSource('ALL'); setFilterDevice('ALL'); setFilterStatus('ALL'); setFilterUploaded('ALL'); setSelectedIds(new Set()); }} 
                      className="h-9 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black hover:bg-slate-300 transition-colors col-span-2 lg:col-span-6"
                    >
                      إعادة تعيين الفلاتر
                    </button>
                 </div>
              </div>

              <div ref={tableContainerRef} className="table-container rounded-[2rem] border-2 border-slate-900 overflow-hidden shadow-xl bg-white flex flex-col h-[500px]">
                <div className="overflow-auto custom-scrollbar flex-1">
                  <table className="w-full text-right border-collapse min-w-[700px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-cyan-900 text-white shadow-md">
                        <th className="py-3 px-4 text-[10px] font-black text-center w-10">
                            <input 
                                type="checkbox" 
                                onChange={toggleSelectAll} 
                                checked={filteredSessions.length > 0 && selectedIds.size === filteredSessions.length}
                                className="accent-cyan-500 cursor-pointer w-4 h-4"
                            />
                        </th>
                        <th className="py-3 px-4 text-[10px] font-black text-center w-10">ت</th>
                        <th className="py-3 px-4 text-[10px] font-black">الجهاز (النسخة)</th>
                        <th className="py-3 px-4 text-[10px] font-black">رقم الهاتف</th>
                        <th className="py-3 px-4 text-[10px] font-black">المصدر</th>
                        <th className="py-3 px-4 text-[10px] font-black text-center">آخر حجز</th>
                        <th className="py-3 px-4 text-[10px] font-black text-center">الحالة</th>
                        <th className="py-3 px-4 text-[10px] font-black text-center">الرفع</th>
                        <th className="py-3 px-4 text-[10px] font-black text-center w-20">خيارات</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {loading ? (
                        <tr><td colSpan={9} className="py-24 text-center font-bold text-slate-400 text-xs">جاري تحميل البيانات...</td></tr>
                      ) : filteredSessions.length === 0 ? (
                        <tr><td colSpan={9} className="py-24 text-center font-bold text-slate-400 text-xs italic">لا توجد جلسات مطابقة.</td></tr>
                      ) : (
                        filteredSessions.map((s, idx) => {
                          const isAvailable = checkAvailability(s.lastBookingDate);
                          const isDuplicate = phoneFrequencies[s.phoneNumber?.trim()] > 1; // Calculate Duplicate
                          const isSelected = selectedIds.has(s.id);

                          let rowClass = 'border-b border-slate-100 transition-colors group cursor-pointer ';
                          
                          if (isSelected) {
                              rowClass += 'bg-blue-50 border-blue-200 ';
                          } else if (isDuplicate) {
                              rowClass += 'bg-red-200 hover:bg-red-300 border-red-300';
                          } else if (s.isUploaded) {
                              rowClass += 'bg-amber-100 hover:bg-amber-200 border-amber-200';
                          } else if (!isAvailable) {
                              rowClass += 'bg-red-50 hover:bg-red-100';
                          } else {
                              rowClass += 'bg-green-50 hover:bg-green-100';
                          }

                          return (
                            <tr 
                              key={s.id} 
                              onClick={() => handleRowClick(s)}
                              className={rowClass}
                            >
                              <td className="py-2 px-4 text-center" onClick={(e) => { e.stopPropagation(); toggleSelection(s.id); }}>
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected} 
                                    onChange={() => {}} // Handled by onClick
                                    className="accent-blue-600 cursor-pointer w-4 h-4"
                                  />
                              </td>
                              <td className="py-2 px-4 text-center font-black text-slate-400 text-[10px]">{idx + 1}</td>
                              <td className="py-2 px-4">
                                {s.device ? (
                                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black border border-slate-200">{s.device.deviceName}</span>
                                ) : (
                                  <span className="text-slate-300 text-[10px] font-bold">—</span>
                                )}
                              </td>
                              <td 
                                className={`py-2 px-4 font-black text-[11px] ${isDuplicate ? 'text-red-900 underline decoration-red-700 decoration-2 underline-offset-4' : (!isAvailable && !s.isUploaded ? 'text-red-700' : 'text-slate-800')}`} 
                                dir="ltr"
                              >
                                {s.phoneNumber}
                              </td>
                              <td className="py-2 px-4 font-bold text-slate-600 text-[10px]">{s.phoneSource || '—'}</td>
                              <td className="py-2 px-4 text-center font-black text-blue-700 text-[10px]" dir="ltr">{s.lastBookingDate || '—'}</td>
                              <td className="py-2 px-4 text-center">
                                 {isAvailable ? 
                                   <span className="text-[8px] font-black text-green-600 bg-white/60 px-2 py-0.5 rounded border border-green-200">متاح</span> :
                                   <span className="text-[8px] font-black text-red-600 bg-white/60 px-2 py-0.5 rounded border border-red-200">محظور</span>
                                 }
                              </td>
                              <td className="py-2 px-4 text-center">
                                 {s.isUploaded ? 
                                   <span className="text-[8px] font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">مرفوع</span> :
                                   <span className="text-[9px] font-bold text-slate-400">—</span>
                                 }
                              </td>
                              <td className="py-2 px-4 text-center">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmSession(s); }}
                                  className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all shadow-sm active:scale-95"
                                  title="حذف"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
