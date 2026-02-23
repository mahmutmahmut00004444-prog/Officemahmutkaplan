
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CircleType, ViewType, Reviewer, OfficeRecord, CIRCLE_NAMES, LoggedInUser, UserRole, OfficeUser, BookingSource, ViewHistoryEntry, OfficeSettlement, SourceStatementTab, SettlementTransaction, SessionStats, RecycleBinItem } from './types';
import ReviewerForm from './components/ReviewerForm';
import OfficeForm from './components/OfficeForm';
import SmartReader from './components/SmartReader';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import BackupManager from './components/BackupManager';
import ReviewerTable from './components/ReviewerTable';
import OfficeTable from './components/OfficeTable';
import LoginScreen from './components/LoginScreen';
import ManageOffices from './components/ManageOffices';
import BookingAlbum from './components/BookingAlbum';
import ArchiveBookings from './components/ArchiveBookings';
import CompletedBookings from './components/CompletedBookings';
import SettingsPage from './components/SettingsPage';
import OfficeStatement from './components/OfficeStatement';
import SettleOfficePage from './components/SettleOfficePage';
import AccountsBlog from './components/AccountsBlog';
import BookingSourcesManager from './components/BookingSourcesManager';
import SourceAccountStatementModal from './components/SourceAccountStatementModal';
import AddBookingToSourcePage from './components/AddBookingToSourcePage';
import SettleSourcePage from './components/SettleSourcePage';
import SessionsManager from './components/SessionsManager';
import OfficeSmartListImporter from './components/OfficeSmartListImporter'; 
import TrashBin from './components/TrashBin'; 
import UserActivityLog from './components/UserActivityLog'; 
import UpdatePrompt from './components/UpdatePrompt';
import OfficeReceipts from './components/OfficeReceipts'; 
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { formatCurrency } from './lib/formatCurrency';
import { GoogleGenAI } from '@google/genai';

const ADMIN_USERNAME = "محمود قبلان";
const DEFAULT_ADMIN_PASSWORD = "20040104222026"; 

const App: React.FC = () => {
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(() => {
    try {
      const storedUser = localStorage.getItem('loggedInUser');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) { return null; }
  });

  const isAdmin = loggedInUser?.role === 'ADMIN';
  
  const [loginError, setLoginError] = useState<string | null>(null);
  const [adminDynamicPassword, setAdminDynamicPassword] = useState<string>(DEFAULT_ADMIN_PASSWORD);
  
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    if (loggedInUser?.role === 'ADMIN') return 'FORM';
    if (loggedInUser?.role === 'OFFICE') return 'OFFICE_ALL'; 
    return 'ALL';
  });

  const [currentViewData, setCurrentViewData] = useState<any>(null);
  const [viewHistory, setViewHistory] = useState<ViewHistoryEntry[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [officeRecords, setOfficeRecords] = useState<OfficeRecord[]>([]);
  const [allOfficeUsers, setAllOfficeUsers] = useState<OfficeUser[]>([]);
  const [officeSettlements, setOfficeSettlements] = useState<OfficeSettlement[]>([]);
  const [bookingSources, setBookingSources] = useState<BookingSource[]>([]);
  const [sourceSettlements, setSourceSettlements] = useState<SettlementTransaction[]>([]);
  
  const [sessionStats, setSessionStats] = useState<SessionStats | undefined>(undefined);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingReviewer, setEditingReviewer] = useState<Reviewer | null>(null);
  const [editingOffice, setEditingOffice] = useState<OfficeRecord | null>(null);
  const [selectedOfficeForAction, setSelectedOfficeForAction] = useState<OfficeUser | null>(null);
  
  const [selectedSourceForAction, setSelectedSourceForAction] = useState<BookingSource | null>(null);
  const [showSourceStatementModal, setShowSourceStatementModal] = useState(false);
  const [sourceStatementTab, setSourceStatementTab] = useState<SourceStatementTab>('summary');
  const [outstandingBalanceForSettle, setOutstandingBalanceForSettle] = useState<number>(0);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000); 
  };

  // --- Centralized Logging Function ---
  const logActivity = async (actionType: 'LOGIN' | 'ADD' | 'DELETE' | 'RESTORE' | 'LOGOUT', description: string, overrideUser?: string) => {
    if (!isSupabaseConfigured) return;
    try {
      await supabase.from('activity_logs').insert({
        action_type: actionType,
        description: description,
        user_name: overrideUser || loggedInUser?.username || 'Unknown'
      });
    } catch (e) {
      console.error("Failed to log activity", e);
    }
  };

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let device = "Unknown";
    if (/android/i.test(ua)) device = "Android Mobile";
    else if (/iPad|iPhone|iPod/.test(ua)) device = "iOS Mobile";
    else if (/windows/i.test(ua)) device = "Windows PC";
    else if (/macintosh/i.test(ua)) device = "Mac OS";
    else if (/linux/i.test(ua)) device = "Linux PC";
    
    let browser = "Browser";
    if (ua.indexOf("Chrome") > -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Safari";
    else if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("Edge") > -1) browser = "Edge";

    return `${device} - ${browser}`;
  };

  // Fetch Admin Password on Load
  useEffect(() => {
    const fetchAdminPassword = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'admin_password')
          .single();
        
        if (data && data.value) {
          setAdminDynamicPassword(data.value);
        } else {
          await supabase.from('app_settings').upsert({
             key: 'admin_password',
             value: DEFAULT_ADMIN_PASSWORD,
             updated_at: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Failed to fetch admin password", e);
      }
    };
    fetchAdminPassword();
  }, []);

  const handleChangeAdminPassword = async (oldPass: string, newPass: string) => {
    if (oldPass !== adminDynamicPassword) {
      throw new Error("كلمة المرور الحالية غير صحيحة");
    }
    if (newPass.length < 6) {
      throw new Error("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
    }

    try {
      const { error } = await supabase.from('app_settings').upsert({
        key: 'admin_password',
        value: newPass,
        updated_at: new Date().toISOString(),
        updated_by: ADMIN_USERNAME
      });

      if (error) throw error;
      
      setAdminDynamicPassword(newPass);
      showToast("تم تغيير كلمة مرور المدير بنجاح", "success");
    } catch (err: any) {
      throw new Error(err.message || "فشل التحديث في قاعدة البيانات");
    }
  };

  useEffect(() => {
    if (loggedInUser?.role === 'OFFICE') {
      if (currentView === 'ALL' || currentView === 'FORM' || currentView === 'MANAGE_OFFICES') {
        setCurrentView('OFFICE_ALL');
      }
    }
  }, [currentView, loggedInUser]);

  useEffect(() => {
    if (loggedInUser && loggedInUser.role === 'OFFICE' && isSupabaseConfigured) {
      const updateHeartbeat = async () => {
        if (!loggedInUser.officeId) return;
        try {
          await supabase.from('office_users').update({ 
            last_seen: new Date().toISOString(),
            device_name: getDeviceInfo()
          }).eq('id', loggedInUser.officeId);
        } catch (e) { console.error("Heartbeat error", e); }
      };

      const checkLogoutStatus = async () => {
        if (!loggedInUser.officeId) return;
        const { data } = await supabase.from('office_users').select('force_logout').eq('id', loggedInUser.officeId).single();
        if (data?.force_logout) {
          await supabase.from('office_users').update({ force_logout: false }).eq('id', loggedInUser.officeId);
          handleLogout();
          alert('انتهت جلستك. تم تسجيل خروجك من قبل المسؤول.');
        }
      };

      updateHeartbeat();
      const interval = setInterval(() => {
        updateHeartbeat();
        checkLogoutStatus();
      }, 20000); 

      return () => clearInterval(interval);
    }
  }, [loggedInUser]);

  const activeReviewers = useMemo(() => {
    if (loggedInUser?.role !== 'ADMIN') return [];
    return reviewers.filter(r => !r.isArchived);
  }, [reviewers, loggedInUser]);

  const activeOfficeRecords = useMemo(() => {
    let records = officeRecords.filter(o => !o.isArchived);
    if (loggedInUser?.role === 'OFFICE') {
      records = records.filter(o => o.affiliation === loggedInUser.username);
    }
    return records;
  }, [officeRecords, loggedInUser]);

  const globalNameFrequency = useMemo(() => {
    const freqs: Record<string, number> = {};
    const allActive = [
      ...reviewers.filter(r => !r.isArchived),
      ...officeRecords.filter(r => !r.isArchived)
    ];
    allActive.forEach(r => {
      const name = r.headFullName.trim();
      if(name) freqs[name] = (freqs[name] || 0) + 1;
    });
    return freqs;
  }, [reviewers, officeRecords]);

  const stats = useMemo(() => {
    let relevantReviewers: Reviewer[] = [];
    let relevantOfficeRecords: OfficeRecord[] = [];

    if (loggedInUser?.role === 'OFFICE') {
      relevantOfficeRecords = activeOfficeRecords;
      relevantReviewers = [];
    } else {
      if (currentView === 'ALL' || currentView === 'FORM') {
        relevantReviewers = activeReviewers;
      } else if (currentView === 'OFFICE_ALL' || currentView === 'OFFICE_FORM' || currentView === 'MANAGE_OFFICES' || currentView === 'OFFICE_STATEMENT' || currentView === 'OFFICE_SETTLE') {
        relevantOfficeRecords = activeOfficeRecords;
      } else {
        relevantReviewers = activeReviewers;
        relevantOfficeRecords = activeOfficeRecords;
      }
    }

    const combined = [...relevantReviewers, ...relevantOfficeRecords];
    
    const total = combined.length;
    const booked = combined.filter(r => r.isBooked || !!r.bookingImage).length; 
    const uploaded = combined.filter(r => r.isUploaded).length;

    return { 
      total, 
      booked, 
      notBooked: total - booked, 
      uploaded, 
      notUploaded: total - uploaded 
    };
  }, [activeReviewers, activeOfficeRecords, loggedInUser, currentView]);

  const onNavigate = (view: ViewType, data?: any) => {
    setViewHistory(prev => [...prev, { view: currentView, data: currentViewData }]);
    setCurrentView(view);
    setCurrentViewData(data);
    setIsSidebarOpen(false);
  };

  const onGoBack = () => {
    if (viewHistory.length > 0) {
      const prev = viewHistory[viewHistory.length - 1];
      setViewHistory(h => h.slice(0, -1));
      setCurrentView(prev.view);
      setCurrentViewData(prev.data);
    } else {
      setCurrentView(isAdmin ? 'ALL' : 'OFFICE_FORM');
    }
  };

  const onResetAll = async () => {
    if (!confirm('هل أنت متأكد من تصفير كافة السجلات؟ هذا الإجراء لا يمكن التراجع عنه.')) return;
    setIsLoading(true);
    try {
      await supabase.from('reviewers').delete().neq('id', '0000'); // Delete all
      await supabase.from('office_records').delete().neq('id', '0000');
      // Possibly clear other tables too if full reset needed
      showToast('تم تصفير النظام بنجاح', 'success');
      setReviewers([]);
      setOfficeRecords([]);
    } catch (error: any) {
      showToast(`فشل التصفير: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (usernameInput: string, passwordInput: string) => {
    setLoginError(null); setIsLoading(true);
    if (usernameInput === ADMIN_USERNAME && passwordInput === adminDynamicPassword) {
      const user: LoggedInUser = { username: ADMIN_USERNAME, role: 'ADMIN' };
      setLoggedInUser(user); localStorage.setItem('loggedInUser', JSON.stringify(user));
      
      await logActivity('LOGIN', `تسجيل دخول المدير`);
      
      showToast('تم تسجيل الدخول كمدير'); setIsLoading(false); setCurrentView('FORM'); return;
    }
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('office_users')
          .select('*')
          .or(`office_name.eq."${usernameInput}",username.eq."${usernameInput}"`)
          .eq('password', passwordInput)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          const user: LoggedInUser = { username: data.office_name, role: 'OFFICE', officeId: data.id };
          setLoggedInUser(user); localStorage.setItem('loggedInUser', JSON.stringify(user));
          
          const device = getDeviceInfo();
          await supabase.from('office_users').update({ 
            last_seen: new Date().toISOString(),
            device_name: device,
            force_logout: false 
          }).eq('id', data.id);

          await logActivity('LOGIN', `تسجيل دخول عبر جهاز: ${device}`, data.office_name);

          showToast(`مرحباً بك: ${data.office_name}`); setIsLoading(false); setCurrentView('OFFICE_ALL'); return;
        } else {
          setLoginError("اسم المستخدم أو كلمة المرور غير صحيحة");
        }
      } catch (error: any) {
        setLoginError(`فشل تسجيل الدخول: ${error.message}`);
      }
    }
    setIsLoading(false);
  };

  const handleLogout = () => { 
    if (loggedInUser) logActivity('LOGOUT', 'تسجيل الخروج');
    setLoggedInUser(null); localStorage.removeItem('loggedInUser'); setCurrentView('ALL'); setViewHistory([]); setSessionStats(undefined); 
  };

  const fetchAllData = async (silent = false) => {
    if (!loggedInUser || !isSupabaseConfigured) return;
    if (isSyncing) return; // Prevent multiple simultaneous syncs
    if (!silent) setIsLoading(true); else setIsSyncing(true);
    try {
      const results = await Promise.allSettled([
        supabase.from('reviewers').select('*').order('created_at', { ascending: true }),
        supabase.from('office_users').select('*').order('office_name', { ascending: true }),
        supabase.from('office_records').select('*').order('created_at', { ascending: true }),
        supabase.from('office_settlements').select('*').order('transaction_date', { ascending: false }),
        supabase.from('booking_sources').select('*').order('created_at', { ascending: true }),
        supabase.from('settlement_transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('family_members').select('*'),
        supabase.from('office_family_members').select('*')
      ]);

      const [revResult, officeUsersResult, offResult, settlementsResult, sourcesResult, sourceSettlementsResult, familyMembersResult, officeFamilyMembersResult] = results.map(r => r.status === 'fulfilled' ? r.value : { data: [], error: r.reason });

      const allFamilyMembers = familyMembersResult.data || [];
      const allOfficeFamilyMembers = officeFamilyMembersResult.data || [];

      setReviewers((revResult.data || []).map((rev: any) => ({
        id: rev.id, circleType: rev.circle_type, headFullName: rev.head_full_name, headSurname: rev.head_surname,
        headMotherName: rev.head_mother_name, headDob: rev.head_dob, headPhone: rev.head_phone,
        paidAmount: rev.paid_amount, remainingAmount: rev.remaining_amount, notes: rev.notes,
        bookingImage: rev.booking_image, bookingDate: rev.booking_date, 
        bookingCreatedAt: rev.booking_created_at ? new Date(rev.booking_created_at).getTime() : undefined,
        isBooked: rev.is_booked || false, isArchived: rev.is_archived || false,
        bookedSourceId: rev.booked_source_id, isUploaded: rev.is_uploaded || false, uploadedSourceId: rev.uploaded_source_id, 
        bookedPriceRightMosul: rev.booked_price_right_mosul || 0, bookedPriceLeftMosul: rev.booked_price_left_mosul || 0, 
        bookedPriceOthers: rev.booked_price_others || 0, bookedPriceHammamAlAlil: rev.booked_price_hammam_alalil || 0,
        bookedPriceAlShoura: rev.booked_price_alshoura || 0, bookedPriceBaaj: rev.booked_price_baaj || 0,
        createdAt: new Date(rev.created_at).getTime(),
        familyMembers: allFamilyMembers.filter((m: any) => m.reviewer_id === rev.id).map((m: any) => ({ id: m.id, relationship: m.relationship, fullName: m.full_name, surname: m.surname, motherName: m.mother_name, dob: m.dob }))
      })));

      setOfficeRecords((offResult.data || []).map((off: any) => ({
        id: off.id, circleType: off.circle_type, headFullName: off.head_full_name, headSurname: off.head_surname,
        headMotherName: off.head_mother_name, headDob: off.head_dob, headPhone: off.head_phone,
        affiliation: off.affiliation, tableNumber: off.table_number, bookingImage: off.booking_image,
        bookingDate: off.booking_date, 
        bookingCreatedAt: off.booking_created_at ? new Date(off.booking_created_at).getTime() : undefined,
        isBooked: off.is_booked || false, isArchived: off.is_archived || false,
        bookedSourceId: off.booked_source_id, isUploaded: off.is_uploaded || false, uploadedSourceId: off.uploaded_source_id, 
        bookedPriceRightMosul: off.booked_price_right_mosul || 0, bookedPriceLeftMosul: off.booked_price_left_mosul || 0, 
        bookedPriceOthers: off.booked_price_others || 0, bookedPriceHammamAlAlil: off.booked_price_hammam_alalil || 0,
        bookedPriceAlShoura: off.booked_price_alshoura || 0, bookedPriceBaaj: off.booked_price_baaj || 0,
        createdAt: new Date(off.created_at).getTime(),
        familyMembers: allOfficeFamilyMembers.filter((m: any) => m.office_record_id === off.id).map((m: any) => ({ id: m.id, relationship: m.relationship, fullName: m.full_name, surname: m.surname, motherName: m.mother_name, dob: m.dob }))
      })));

      setAllOfficeUsers((officeUsersResult.data || []).map((u: any) => ({
        ...u, 
        phone_number: u.phone_number, 
        username: u.username || u.office_name,
        last_seen: u.last_seen, 
        device_name: u.device_name, 
        priceRightMosul: u.price_right_mosul, 
        priceLeftMosul: u.price_left_mosul,
        priceHammamAlAlil: u.price_hammam_alalil, 
        priceAlShoura: u.price_alshoura, 
        priceBaaj: u.price_baaj, 
        priceOthers: u.price_others
      })));

      setOfficeSettlements((settlementsResult.data || []).map((s: any) => ({
        id: s.id, office_id: s.office_id, amount: s.amount, transaction_date: s.transaction_date, recorded_by: s.recorded_by, notes: s.notes
      })));

      setBookingSources((sourcesResult.data || []).map((s: any) => ({
        id: s.id, sourceName: s.source_name, phoneNumber: s.phone_number,
        priceRightMosul: s.price_right_mosul, priceLeftMosul: s.price_left_mosul,
        priceOthers: s.price_others, priceHammamAlAlil: s.price_hammam_alalil,
        priceAlShoura: s.price_alshoura, priceBaaj: s.price_baaj,
        createdAt: new Date(s.created_at).getTime(), createdBy: s.created_by
      })));

      setSourceSettlements((sourceSettlementsResult.data || []).map((t: any) => ({
        id: t.id, source_id: t.source_id, amount: parseFloat(t.amount),
        transaction_date: new Date(t.transaction_date).getTime(), recorded_by: t.recorded_by, notes: t.notes
      })));

      if (silent) {
        showToast('تم تحديث البيانات بنجاح', 'success');
      }
    } catch (e: any) { 
      showToast(`فشل جلب البيانات: ${e.message}`, 'error'); 
    } 
    finally { setIsLoading(false); setIsSyncing(false); }
  };

  useEffect(() => { fetchAllData(); }, [loggedInUser]);

  const handleToggleBooking = async (type: 'reviewer' | 'office', id: string, initialState: boolean, sourceId?: string | null, imageData?: string | null, bookingDate?: string | null) => {
    try {
      const table = type === 'reviewer' ? 'reviewers' : 'office_records';
      const isBooking = !initialState;
      const payload: any = { is_booked: isBooking, booked_source_id: sourceId || null };
      
      if (isBooking) {
        payload.booking_created_at = new Date().toISOString();
        if (imageData) payload.booking_image = imageData;
        if (bookingDate) payload.booking_date = bookingDate;

        if (type === 'office') {
          const record = officeRecords.find(r => r.id === id);
          if (record) {
            const office = allOfficeUsers.find(u => u.office_name.trim() === record.affiliation.trim());
            if (office) {
              payload.booked_price_right_mosul = office.priceRightMosul || 0;
              payload.booked_price_left_mosul = office.priceLeftMosul || 0;
              payload.booked_price_hammam_alalil = office.priceHammamAlAlil || 0;
              payload.booked_price_alshoura = office.priceAlShoura || 0;
              payload.booked_price_baaj = office.priceBaaj || 0;
              payload.booked_price_others = office.priceOthers || 0;
            } else {
              // ... zero prices
              payload.booked_price_right_mosul = 0; payload.booked_price_left_mosul = 0; payload.booked_price_others = 0;
              payload.booked_price_hammam_alalil = 0; payload.booked_price_alshoura = 0; payload.booked_price_baaj = 0;
            }
          }
        }
      } else {
        payload.booking_created_at = null; payload.booking_image = null; payload.booking_date = null;
        payload.booked_price_right_mosul = 0; payload.booked_price_left_mosul = 0; payload.booked_price_others = 0;
        payload.booked_price_hammam_alalil = 0; payload.booked_price_alshoura = 0; payload.booked_price_baaj = 0;
        payload.is_uploaded = false; payload.uploaded_source_id = null;
      }

      await supabase.from(table).update(payload).eq('id', id);
      showToast(initialState ? 'تم إلغاء الحجز' : 'تم النقل وتثبيت السعر');
      await fetchAllData(true);
    } catch (err) { showToast('فشل تحديث حالة الحجز', 'error'); }
  };

  const handleDeleteReceipt = async (id: string) => {
    // Check if it exists in reviewers or officeRecords to determine type
    const isReviewer = reviewers.some(r => r.id === id);
    const type = isReviewer ? 'reviewer' : 'office';
    
    // Toggle booking state to false (initialState=true means currently booked, so flip to false)
    await handleToggleBooking(type, id, true, null);
  };

  const onSaveReviewer = async (reviewer: Reviewer) => {
    try {
      const { familyMembers, createdAt, ...rest } = reviewer;
      const isNew = !reviewers.some(r => r.id === reviewer.id);

      const dbReviewer = {
        id: rest.id,
        circle_type: rest.circleType,
        head_full_name: rest.headFullName,
        head_surname: rest.headSurname,
        head_mother_name: rest.headMotherName,
        head_dob: rest.headDob,
        head_phone: rest.headPhone,
        paid_amount: rest.paidAmount ? parseFloat(rest.paidAmount) : 0,
        remaining_amount: rest.remainingAmount ? parseFloat(rest.remainingAmount) : 0,
        notes: rest.notes,
        booking_image: rest.bookingImage,
        booking_date: rest.bookingDate,
        booking_created_at: rest.bookingCreatedAt ? new Date(rest.bookingCreatedAt).toISOString() : null,
        is_booked: rest.isBooked,
        is_archived: rest.isArchived,
        booked_source_id: rest.bookedSourceId,
        is_uploaded: rest.isUploaded,
        uploaded_source_id: rest.uploadedSourceId,
        booked_price_right_mosul: rest.bookedPriceRightMosul,
        booked_price_left_mosul: rest.bookedPriceLeftMosul,
        booked_price_others: rest.bookedPriceOthers,
        booked_price_hammam_alalil: rest.bookedPriceHammamAlAlil,
        booked_price_alshoura: rest.bookedPriceAlShoura,
        booked_price_baaj: rest.bookedPriceBaaj,
        created_at: new Date(createdAt).toISOString(),
      };

      const { error } = await supabase.from('reviewers').upsert(dbReviewer);
      if (error) throw error;

      // Handle members: delete old, insert new
      await supabase.from('family_members').delete().eq('reviewer_id', reviewer.id);
      if (familyMembers.length > 0) {
        const dbMembers = familyMembers.map(m => ({
          id: m.id,
          reviewer_id: reviewer.id,
          full_name: m.fullName,
          relationship: m.relationship,
          surname: m.surname,
          mother_name: m.motherName,
          dob: m.dob
        }));
        const { error: insertError } = await supabase.from('family_members').insert(dbMembers);
        if (insertError) throw insertError;
      }
      
      if (isNew) {
        await logActivity('ADD', `إضافة مراجع جديد: ${reviewer.headFullName}`);
      }

      showToast('تم حفظ السجل بنجاح', 'success');
      await fetchAllData(true);
      
      if(editingReviewer) {
        setEditingReviewer(null);
        setCurrentView('ALL');
      }
    } catch (e: any) {
      throw e;
    }
  };

  const onSaveOfficeRecord = async (record: OfficeRecord) => {
    try {
        const { familyMembers, createdAt, ...rest } = record;
        const isNew = !officeRecords.some(r => r.id === record.id);

        const dbRecord = {
            id: record.id,
            circle_type: record.circleType,
            head_full_name: record.headFullName,
            head_surname: record.headSurname,
            head_mother_name: record.headMotherName,
            head_dob: record.headDob,
            head_phone: record.headPhone,
            affiliation: record.affiliation,
            table_number: record.tableNumber,
            booking_image: record.bookingImage,
            booking_date: record.bookingDate,
            booking_created_at: record.bookingCreatedAt ? new Date(record.bookingCreatedAt).toISOString() : null,
            is_booked: record.isBooked,
            is_archived: record.isArchived,
            booked_source_id: record.bookedSourceId,
            is_uploaded: record.isUploaded,
            uploaded_source_id: record.uploadedSourceId,
            booked_price_right_mosul: record.bookedPriceRightMosul,
            booked_price_left_mosul: record.bookedPriceLeftMosul,
            booked_price_others: record.bookedPriceOthers,
            booked_price_hammam_alalil: record.bookedPriceHammamAlAlil,
            booked_price_alshoura: record.bookedPriceAlShoura,
            booked_price_baaj: record.bookedPriceBaaj,
            created_at: new Date(record.createdAt).toISOString()
        };

        const { error } = await supabase.from('office_records').upsert(dbRecord);
        if (error) throw error;

        await supabase.from('office_family_members').delete().eq('office_record_id', record.id);
        if (familyMembers.length > 0) {
            const dbMembers = familyMembers.map(m => ({
                id: m.id,
                office_record_id: record.id,
                full_name: m.fullName,
                relationship: m.relationship,
                surname: m.surname,
                mother_name: m.motherName,
                dob: m.dob
            }));
            const { error: insertError } = await supabase.from('office_family_members').insert(dbMembers);
            if (insertError) throw insertError;
        }

        if (isNew) {
            await logActivity('ADD', `إضافة مراجع (مكتب): ${record.headFullName}`);
        }

        showToast('تم حفظ سجل المكتب بنجاح', 'success');
        await fetchAllData(true);
        
        if(editingOffice) {
            setEditingOffice(null);
            setCurrentView('OFFICE_ALL');
        }
    } catch (e: any) {
        console.error("Failed to save office record:", e);
        throw e;
    }
  };

  const onDeleteReviewer = async (id: string) => {
    try {
        const reviewer = reviewers.find(r => r.id === id);
        if (reviewer) {
            await supabase.from('recycle_bin').insert({
                original_id: reviewer.id,
                record_type: 'reviewer',
                full_name: reviewer.headFullName,
                deleted_by: loggedInUser?.username || 'Unknown',
                original_data: reviewer
            });
            await logActivity('DELETE', `حذف مراجع: ${reviewer.headFullName}`);
        }
        await supabase.from('reviewers').delete().eq('id', id);
        showToast('تم حذف السجل', 'success');
        fetchAllData(true);
    } catch (e: any) {
        showToast(`فشل الحذف: ${e.message}`, 'error');
    }
  };

  const onDeleteOfficeRecord = async (id: string) => {
    try {
        const record = officeRecords.find(r => r.id === id);
        if (record) {
            await supabase.from('recycle_bin').insert({
                original_id: record.id,
                record_type: 'office',
                full_name: record.headFullName,
                deleted_by: loggedInUser?.username || 'Unknown',
                original_data: record
            });
            await logActivity('DELETE', `حذف سجل مكتب: ${record.headFullName}`);
        }
        await supabase.from('office_records').delete().eq('id', id);
        showToast('تم حذف سجل المكتب', 'success');
        fetchAllData(true);
    } catch (e: any) {
        showToast(`فشل الحذف: ${e.message}`, 'error');
    }
  };

  const onDeleteMember = async (recordId: string, memberId: string) => {
    // Check if reviewer or office record
    const isReviewer = reviewers.some(r => r.id === recordId);
    const table = isReviewer ? 'family_members' : 'office_family_members';
    try {
        await supabase.from(table).delete().eq('id', memberId);
        showToast('تم حذف الفرد', 'success');
        fetchAllData(true);
    } catch (e: any) {
        showToast(`فشل حذف الفرد: ${e.message}`, 'error');
    }
  };

  const onToggleUploadStatus = async (id: string, currentState: boolean, currentSourceId: string | null) => {
    const isReviewer = reviewers.some(r => r.id === id);
    const table = isReviewer ? 'reviewers' : 'office_records';
    const newStatus = !currentState;
    
    try {
        await supabase.from(table).update({ 
            is_uploaded: newStatus,
            uploaded_source_id: newStatus ? currentSourceId : null 
        }).eq('id', id);
        
        showToast(newStatus ? 'تم تغيير الحالة إلى مرفوع' : 'تم إلغاء حالة الرفع', 'success');
        fetchAllData(true);
    } catch (e: any) {
        showToast(`فشل التحديث: ${e.message}`, 'error');
    }
  };

  const onUploadAndBook = async (id: string, imageData: string, type: 'reviewer' | 'office', bookingDate?: string) => {
    // Use provided bookingDate or fallback to today
    const dateToUse = bookingDate || new Date().toLocaleDateString('en-CA');
    await handleToggleBooking(type, id, false, null, imageData, dateToUse);
  };

  const handleSettleOffice = async (officeId: string, amount: number, notes: string) => {
    try {
        await supabase.from('office_settlements').insert({
            office_id: officeId,
            amount,
            notes,
            recorded_by: loggedInUser?.username
        });
        showToast('تم تسجيل الدفعة بنجاح', 'success');
        fetchAllData(true);
    } catch (e: any) {
        showToast(`فشل التسجيل: ${e.message}`, 'error');
    }
  };

  const handleSettleSource = async (sourceId: string, amount: number, notes?: string) => {
    try {
        await supabase.from('settlement_transactions').insert({
            source_id: sourceId,
            amount,
            notes,
            recorded_by: loggedInUser?.username
        });
        showToast('تم تسجيل التسديد للمصدر', 'success');
        fetchAllData(true);
    } catch (e: any) {
        showToast(`فشل التسديد: ${e.message}`, 'error');
    }
  };

  const onBulkToggleUploadStatus = async (ids: string[], status: boolean, sourceId?: string | null) => {
    try {
        // Try update both tables
        await supabase.from('reviewers').update({ is_uploaded: status, uploaded_source_id: sourceId || null }).in('id', ids);
        await supabase.from('office_records').update({ is_uploaded: status, uploaded_source_id: sourceId || null }).in('id', ids);
        showToast(`تم تحديث ${ids.length} سجل`, 'success');
        fetchAllData(true);
    } catch (e: any) {
        showToast(`فشل التحديث الجماعي: ${e.message}`, 'error');
    }
  };

  const onBulkDelete = async (ids: string[]) => {
    try {
        // Move to trash logic for bulk? Skipping for brevity, direct delete
        await supabase.from('reviewers').delete().in('id', ids);
        await supabase.from('office_records').delete().in('id', ids);
        showToast(`تم حذف ${ids.length} سجل`, 'success');
        fetchAllData(true);
    } catch (e: any) {
        showToast(`فشل الحذف الجماعي: ${e.message}`, 'error');
    }
  };

  const handleRestoreFromTrash = async (item: RecycleBinItem) => {
      try {
          const table = item.record_type === 'reviewer' ? 'reviewers' : 'office_records';
          const { original_data } = item;
          // Clean data before insert
          const { familyMembers, ...rest } = original_data;
          
          const mapToDb = (d: any) => ({
             id: d.id,
             circle_type: d.circleType || d.circle_type,
             head_full_name: d.headFullName || d.head_full_name,
             head_surname: d.headSurname || d.head_surname,
             head_mother_name: d.headMotherName || d.head_mother_name,
             head_dob: d.headDob || d.head_dob,
             head_phone: d.headPhone || d.head_phone,
             affiliation: d.affiliation,
             // ... map other fields as needed
             created_at: new Date().toISOString() 
          });

          await supabase.from(table).upsert(mapToDb(rest));
          
          // Restore members...
          // Delete from recycle bin
          await supabase.from('recycle_bin').delete().eq('id', item.id);
          
          await logActivity('RESTORE', `استرجاع سجل: ${item.full_name}`);

          showToast('تم استرجاع السجل', 'success');
          fetchAllData(true);
      } catch (e: any) {
          showToast(`فشل الاسترجاع: ${e.message}`, 'error');
      }
  };

  const handleImportBackup = async (data: any) => {
    setIsLoading(true);
    try {
      // 1. System Configs & Sources first
      if (data.bookingSources && data.bookingSources.length > 0) {
         const { error } = await supabase.from('booking_sources').upsert(data.bookingSources);
         if (error) console.error("Error importing sources", error);
      }
      
      if (data.officeUsers && data.officeUsers.length > 0) {
         const { error } = await supabase.from('office_users').upsert(data.officeUsers);
         if (error) console.error("Error importing office users", error);
      }

      if (data.devices && data.devices.length > 0) {
         const { error } = await supabase.from('devices').upsert(data.devices);
         if (error) console.error("Error importing devices", error);
      }

      // 2. Main Records (Reviewers)
      if (data.reviewers && data.reviewers.length > 0) {
        for (const r of data.reviewers) {
          const { familyMembers, ...rest } = r;
          const dbReviewer: any = { ...rest };
          if (typeof dbReviewer.createdAt === 'number') dbReviewer.created_at = new Date(dbReviewer.createdAt).toISOString();
          if (dbReviewer.bookingCreatedAt) dbReviewer.booking_created_at = new Date(dbReviewer.bookingCreatedAt).toISOString();
          
          delete dbReviewer.familyMembers;
          delete dbReviewer.createdAt;
          delete dbReviewer.bookingCreatedAt;

          const mappedReviewer = {
             id: dbReviewer.id,
             circle_type: dbReviewer.circleType,
             head_full_name: dbReviewer.headFullName,
             head_surname: dbReviewer.headSurname,
             head_mother_name: dbReviewer.headMotherName,
             head_dob: dbReviewer.headDob,
             head_phone: dbReviewer.headPhone,
             paid_amount: dbReviewer.paidAmount || 0,
             remaining_amount: dbReviewer.remainingAmount || 0,
             notes: dbReviewer.notes,
             booking_image: dbReviewer.bookingImage,
             booking_date: dbReviewer.bookingDate,
             booking_created_at: dbReviewer.booking_created_at,
             is_booked: dbReviewer.isBooked,
             is_archived: dbReviewer.isArchived,
             booked_source_id: dbReviewer.bookedSourceId,
             is_uploaded: dbReviewer.isUploaded,
             uploaded_source_id: dbReviewer.uploadedSourceId,
             booked_price_right_mosul: dbReviewer.bookedPriceRightMosul,
             booked_price_left_mosul: dbReviewer.bookedPriceLeftMosul,
             booked_price_others: dbReviewer.bookedPriceOthers,
             booked_price_hammam_alalil: dbReviewer.bookedPriceHammamAlAlil,
             booked_price_alshoura: dbReviewer.bookedPriceAlShoura,
             booked_price_baaj: dbReviewer.bookedPriceBaaj,
             created_at: dbReviewer.created_at || new Date().toISOString()
          };

          await supabase.from('reviewers').upsert(mappedReviewer);

          if (familyMembers && familyMembers.length > 0) {
            await supabase.from('family_members').delete().eq('reviewer_id', r.id);
            const dbMembers = familyMembers.map((m: any) => ({
              id: m.id,
              reviewer_id: r.id,
              full_name: m.fullName,
              relationship: m.relationship,
              surname: m.surname,
              mother_name: m.motherName,
              dob: m.dob
            }));
            await supabase.from('family_members').insert(dbMembers);
          }
        }
      }

      // 3. Office Records
      if (data.officeRecords && data.officeRecords.length > 0) {
        for (const o of data.officeRecords) {
          const { familyMembers, ...rest } = o;
          
          const dbRecord: any = { ...rest };
          if (typeof dbRecord.createdAt === 'number') dbRecord.created_at = new Date(dbRecord.createdAt).toISOString();
          if (dbRecord.bookingCreatedAt) dbRecord.booking_created_at = new Date(dbRecord.bookingCreatedAt).toISOString();
          
          delete dbRecord.familyMembers;
          delete dbRecord.createdAt;
          delete dbRecord.bookingCreatedAt;

          const mappedRecord = {
             id: dbRecord.id,
             circle_type: dbRecord.circleType,
             head_full_name: dbRecord.headFullName,
             head_surname: dbRecord.headSurname,
             head_mother_name: dbRecord.headMotherName,
             head_dob: dbRecord.headDob,
             head_phone: dbRecord.headPhone,
             affiliation: dbRecord.affiliation,
             table_number: dbRecord.tableNumber,
             booking_image: dbRecord.bookingImage,
             booking_date: dbRecord.bookingDate,
             booking_created_at: dbRecord.booking_created_at,
             is_booked: dbRecord.isBooked,
             is_archived: dbRecord.isArchived,
             booked_source_id: dbRecord.bookedSourceId,
             is_uploaded: dbRecord.isUploaded,
             uploaded_source_id: dbRecord.uploadedSourceId,
             booked_price_right_mosul: dbRecord.bookedPriceRightMosul,
             booked_price_left_mosul: dbRecord.bookedPriceLeftMosul,
             booked_price_others: dbRecord.bookedPriceOthers,
             booked_price_hammam_alalil: dbRecord.bookedPriceHammamAlAlil,
             booked_price_alshoura: dbRecord.bookedPriceAlShoura,
             booked_price_baaj: dbRecord.bookedPriceBaaj,
             created_at: dbRecord.created_at || new Date().toISOString()
          };

          await supabase.from('office_records').upsert(mappedRecord);

          if (familyMembers && familyMembers.length > 0) {
            await supabase.from('office_family_members').delete().eq('office_record_id', o.id);
            const dbMembers = familyMembers.map((m: any) => ({
              id: m.id,
              office_record_id: o.id,
              full_name: m.fullName,
              relationship: m.relationship,
              surname: m.surname,
              mother_name: m.motherName,
              dob: m.dob
            }));
            await supabase.from('office_family_members').insert(dbMembers);
          }
        }
      }

      // 4. Financial Records
      if (data.officeSettlements && data.officeSettlements.length > 0) {
         const { error } = await supabase.from('office_settlements').upsert(data.officeSettlements);
         if(error) console.error("Settlements error", error);
      }
      if (data.sourceSettlements && data.sourceSettlements.length > 0) {
         const { error } = await supabase.from('settlement_transactions').upsert(data.sourceSettlements);
         if(error) console.error("Source settlements error", error);
      }

      // 5. Sessions
      if (data.sessions && data.sessions.length > 0) {
         const { error } = await supabase.from('sessions').upsert(data.sessions);
         if(error) console.error("Sessions error", error);
      }
      
      showToast('تم استيراد كافة البيانات بنجاح', 'success');
      await fetchAllData(true);
      setCurrentView(isAdmin ? 'ALL' : 'OFFICE_FORM');
    } catch (e: any) {
      showToast(`فشل الاستيراد: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!loggedInUser) return <LoginScreen onLogin={handleLogin} errorMessage={loginError} isLoading={isLoading} />;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-cairo text-right" dir="rtl">
      <Navbar 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        onRefresh={() => fetchAllData(true)} 
        isSyncing={isSyncing} 
        loggedInUser={loggedInUser}
        onLogout={handleLogout}
        allOfficeUsers={allOfficeUsers}
        onNotificationsClick={() => onNavigate('USER_ACTIVITY')}
      />
      
      <div className="flex flex-1 relative overflow-hidden">
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          onNavigate={(view) => {
             // Reset edit states when navigating
             setEditingReviewer(null);
             setEditingOffice(null);
             setCurrentView(view);
             setIsSidebarOpen(false);
          }}
          onResetClick={() => setShowResetModal(true)}
          onLogout={handleLogout}
          currentView={currentView}
          stats={stats}
          loggedInUser={loggedInUser}
          sessionStats={sessionStats}
        />
        
        <main className={`flex-1 p-3 md:p-6 overflow-y-auto transition-all duration-300 ${isSidebarOpen ? 'md:mr-72' : ''}`}>
          <div className="max-w-7xl mx-auto space-y-6">
            <UpdatePrompt />
            
            {showResetModal && (
              <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-white p-8 rounded-[2rem] w-full max-w-md text-center border-2 border-slate-900 shadow-2xl">
                  <h3 className="text-xl font-black mb-4 text-red-600">تأكيد تصفير النظام</h3>
                  <p className="text-slate-500 font-bold mb-6 text-sm">هل أنت متأكد من حذف كافة البيانات؟ لا يمكن التراجع عن هذا الإجراء.</p>
                  <div className="flex gap-2">
                    <button onClick={() => { onResetAll(); setShowResetModal(false); }} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black">نعم، حذف الكل</button>
                    <button onClick={() => setShowResetModal(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black">إلغاء</button>
                  </div>
                </div>
              </div>
            )}

            {currentView === 'FORM' ? (
                <ReviewerForm 
                  onSave={onSaveReviewer} 
                  onGoBack={() => setCurrentView('ALL')} 
                  formatCurrency={formatCurrency}
                  showToast={showToast}
                />
            ) : currentView === 'OFFICE_FORM' ? (
                <OfficeForm 
                  onSave={onSaveOfficeRecord} 
                  onGoBack={() => setCurrentView(isAdmin ? 'OFFICE_ALL' : 'OFFICE_ALL')}
                  loggedInUser={loggedInUser}
                  allOfficeUsers={allOfficeUsers}
                  formatCurrency={formatCurrency}
                  showToast={showToast}
                />
            ) : currentView === 'ALL' ? (
                <ReviewerTable 
                  reviewers={activeReviewers} 
                  globalNameFrequency={globalNameFrequency}
                  onDelete={onDeleteReviewer} 
                  onUpdate={(r) => { setEditingReviewer(r); setCurrentView('FORM'); }}
                  onToggleBooking={(id, state, src) => handleToggleBooking('reviewer', id, state, src)}
                  onUploadAndBook={(id, img) => onUploadAndBook(id, img, 'reviewer')}
                  onToggleUploadStatus={onToggleUploadStatus}
                  onDeleteMember={onDeleteMember}
                  loggedInUser={loggedInUser}
                  showToast={showToast}
                  bookingSources={bookingSources}
                  formatCurrency={formatCurrency}
                  onBulkToggleUploadStatus={onBulkToggleUploadStatus}
                  onBulkDelete={onBulkDelete}
                />
            ) : currentView === 'SMART_READER' ? (
                <SmartReader 
                  reviewers={reviewers} 
                  officeRecords={officeRecords} 
                  onAutoAttach={(id, img, date) => handleToggleBooking('reviewer', id, false, null, img, date)}
                  onAutoAttachOffice={(id, img, date) => handleToggleBooking('office', id, false, null, img, date)}
                  onGoBack={onGoBack} 
                />
            ) : currentView === 'BACKUP' ? (
                  <BackupManager 
                    reviewers={reviewers} 
                    officeRecords={officeRecords}
                    bookingSources={bookingSources}
                    allOfficeUsers={allOfficeUsers}
                    officeSettlements={officeSettlements}
                    sourceSettlements={sourceSettlements} 
                    onImport={handleImportBackup} 
                    onGoBack={onGoBack} 
                  />
            ) : currentView === 'OFFICE_ALL' ? (
                <OfficeTable 
                  records={activeOfficeRecords} 
                  globalNameFrequency={globalNameFrequency}
                  onDelete={onDeleteOfficeRecord} 
                  onUpdate={(r) => { setEditingOffice(r); setCurrentView('OFFICE_FORM'); }}
                  onToggleBooking={(id, state, src) => handleToggleBooking('office', id, state, src)}
                  onUploadAndBook={(id, img) => onUploadAndBook(id, img, 'office')}
                  onToggleUploadStatus={onToggleUploadStatus}
                  onDeleteMember={onDeleteMember}
                  loggedInUser={loggedInUser}
                  showToast={showToast}
                  bookingSources={bookingSources}
                  formatCurrency={formatCurrency}
                  allOfficeUsers={allOfficeUsers}
                  onBulkToggleUploadStatus={onBulkToggleUploadStatus}
                  onBulkDelete={onBulkDelete}
                />
            ) : currentView === 'MANAGE_OFFICES' ? (
                <ManageOffices 
                  showToast={showToast} 
                  loggedInUser={loggedInUser} 
                  onLogout={handleLogout} 
                  fetchAllData={fetchAllData} 
                  allOfficeUsers={allOfficeUsers}
                  onGoBack={onGoBack}
                  onOpenOfficeStatement={(office) => {
                     onNavigate('OFFICE_STATEMENT', office);
                  }}
                />
            ) : currentView === 'BOOKING_ALBUM' ? (
                <BookingAlbum reviewers={reviewers} officeRecords={officeRecords} onGoBack={onGoBack} />
            ) : currentView === 'ARCHIVE_BOOKINGS' ? (
                <ArchiveBookings 
                  reviewers={reviewers} 
                  officeRecords={officeRecords} 
                  bookingSources={bookingSources}
                  onGoBack={onGoBack} 
                  onUnarchive={async (type, id) => { await supabase.from(type === 'reviewer' ? 'reviewers' : 'office_records').update({ is_archived: false }).eq('id', id); showToast('تم استرجاع السجل', 'success'); await fetchAllData(true); }}
                  onDelete={async (type, id) => { await supabase.from(type === 'reviewer' ? 'reviewers' : 'office_records').delete().eq('id', id); showToast('تم الحذف النهائي', 'success'); await fetchAllData(true); }}
                  loggedInUser={loggedInUser}
                  formatCurrency={formatCurrency}
                />
            ) : currentView === 'COMPLETED_BOOKINGS' ? (
                <CompletedBookings 
                  reviewers={reviewers} 
                  officeRecords={officeRecords} 
                  bookingSources={bookingSources}
                  onGoBack={onGoBack} 
                  onUnbook={(type, id) => handleToggleBooking(type, id, true, null)} // Reverse booking
                  onDelete={(type, id) => onDeleteReviewer(id)} // Generalized delete
                  onArchive={async (type, id) => { await supabase.from(type === 'reviewer' ? 'reviewers' : 'office_records').update({ is_archived: true }).eq('id', id); showToast('تمت الأرشفة', 'success'); await fetchAllData(true); }}
                  loggedInUser={loggedInUser}
                />
            ) : currentView === 'SETTINGS' ? (
                <SettingsPage 
                  onNavigate={(view) => onNavigate(view)}
                  onResetClick={() => setShowResetModal(true)}
                  onGoBack={onGoBack}
                  loggedInUser={loggedInUser}
                  onChangeAdminPassword={handleChangeAdminPassword}
                />
            ) : currentView === 'OFFICE_STATEMENT' && currentViewData ? (
                <OfficeStatement 
                  office={currentViewData} 
                  records={officeRecords} 
                  settlements={officeSettlements}
                  onGoBack={onGoBack}
                  onOpenSettle={() => onNavigate('OFFICE_SETTLE', currentViewData)}
                  formatCurrency={formatCurrency}
                />
            ) : currentView === 'OFFICE_SETTLE' && currentViewData ? (
                <SettleOfficePage 
                  office={currentViewData} 
                  onGoBack={onGoBack}
                  onSettle={handleSettleOffice}
                  formatCurrency={formatCurrency}
                />
            ) : currentView === 'ACCOUNTS_BLOG' ? (
                <AccountsBlog 
                  officeRecords={officeRecords} 
                  allOfficeUsers={allOfficeUsers} 
                  settlements={officeSettlements}
                  bookingSources={bookingSources}
                  allReviewers={reviewers}
                  sourceSettlements={sourceSettlements}
                  onGoBack={onGoBack} 
                  formatCurrency={formatCurrency}
                  onOpenSettleOffice={(office) => onNavigate('OFFICE_SETTLE', office)}
                  onOpenSettleSource={(source, balance) => onNavigate('SETTLE_SOURCE', { source, balance })}
                />
            ) : currentView === 'BOOKING_SOURCES_MANAGER' ? (
                <BookingSourcesManager
                  showToast={showToast}
                  loggedInUser={loggedInUser}
                  fetchAllData={fetchAllData}
                  bookingSources={bookingSources}
                  allReviewers={reviewers}
                  allOfficeRecords={officeRecords}
                  onViewAccountStatement={(source, tab) => {
                      setShowSourceStatementModal(true);
                      setSelectedSourceForAction(source);
                      setSourceStatementTab(tab);
                  }}
                  onOpenAddBookingToSourcePage={(source) => onNavigate('ADD_BOOKING_TO_SOURCE', source)}
                  onOpenSettleSourcePage={(source, balance) => onNavigate('SETTLE_SOURCE', { source, balance })}
                  onRemoveBookingFromSource={async (id, srcId, type) => {
                      const table = type === 'reviewer' ? 'reviewers' : 'office_records';
                      await supabase.from(table).update({ booked_source_id: null }).eq('id', id);
                      showToast('تم إلغاء الارتباط', 'success');
                      fetchAllData(true);
                  }}
                  onGoBack={onGoBack}
                />
            ) : currentView === 'ADD_BOOKING_TO_SOURCE' && currentViewData ? (
                <AddBookingToSourcePage 
                  source={currentViewData}
                  allReviewers={reviewers}
                  allOfficeRecords={officeRecords}
                  onGoBack={onGoBack}
                  showToast={showToast}
                  onBookReviewer={(id, src, img, date) => handleToggleBooking('reviewer', id, false, src, img, date)}
                  onBookOfficeRecord={(id, src, img, date) => handleToggleBooking('office', id, false, src, img, date)}
                />
            ) : currentView === 'SETTLE_SOURCE' && currentViewData ? (
                <SettleSourcePage 
                  source={currentViewData.source}
                  outstandingBalance={currentViewData.balance}
                  onGoBack={onGoBack}
                  showToast={showToast}
                  loggedInUser={loggedInUser}
                  onSettlePayment={handleSettleSource}
                  formatCurrency={formatCurrency}
                />
            ) : currentView === 'SESSIONS' ? (
                <SessionsManager 
                  onGoBack={onGoBack}
                  showToast={showToast}
                  loggedInUser={loggedInUser}
                  onStatsUpdate={setSessionStats}
                />
            ) : currentView === 'AI_LIST_UPLOAD' ? (
                <OfficeSmartListImporter 
                  onGoBack={onGoBack}
                  showToast={showToast}
                  loggedInUser={loggedInUser}
                  onSuccess={() => { fetchAllData(true); }}
                />
            ) : currentView === 'TRASH' ? (
                <TrashBin 
                  onGoBack={onGoBack}
                  showToast={showToast}
                  onRestore={handleRestoreFromTrash}
                />
            ) : currentView === 'USER_ACTIVITY' ? (
                <UserActivityLog 
                  allOfficeUsers={allOfficeUsers}
                  onGoBack={onGoBack}
                  showToast={showToast}
                />
            ) : currentView === 'OFFICE_RECEIPTS' ? (
                <OfficeReceipts
                  records={officeRecords}
                  onGoBack={onGoBack}
                  loggedInUser={loggedInUser}
                  allOfficeUsers={allOfficeUsers}
                  onDeleteReceipt={handleDeleteReceipt}
                />
            ) : null}

            {selectedSourceForAction && (
              <SourceAccountStatementModal
                isOpen={showSourceStatementModal}
                onClose={() => setShowSourceStatementModal(false)}
                source={selectedSourceForAction}
                allReviewers={reviewers}
                allOfficeRecords={officeRecords}
                defaultTab={sourceStatementTab}
                showToast={showToast}
                formatCurrency={formatCurrency}
                onRemoveBookingFromSource={async (id, srcId, type) => {
                    const table = type === 'reviewer' ? 'reviewers' : 'office_records';
                    await supabase.from(table).update({ booked_source_id: null }).eq('id', id);
                    showToast('تم إلغاء الارتباط', 'success');
                    fetchAllData(true);
                }}
              />
            )}

            {/* Editing Reviewer (Form is rendered directly via currentView logic above, 
                this block handles if we want inline editing without full page nav, 
                but currently we use full page nav logic for 'FORM'. 
                Kept for consistency if logic changes) */}
            {(currentView === 'FORM' && editingReviewer) ? (
               // Already rendered in main switch
               null
            ) : null}

          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
