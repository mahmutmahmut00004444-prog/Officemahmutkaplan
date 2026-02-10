
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
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { formatCurrency } from './lib/formatCurrency';
import { GoogleGenAI } from '@google/genai';

const ADMIN_USERNAME = "محمود قبلان";
const ADMIN_PASSWORD = "2004010422Mk";

const App: React.FC = () => {
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(() => {
    try {
      const storedUser = localStorage.getItem('loggedInUser');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) { return null; }
  });

  const isAdmin = loggedInUser?.role === 'ADMIN';
  
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // تعيين الصفحة الافتراضية بناءً على نوع المستخدم عند التحميل
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

  // فرض التوجيه الصحيح بناءً على الدور
  useEffect(() => {
    if (loggedInUser?.role === 'OFFICE') {
      // إذا كان المستخدم مكتب، ويحاول الوصول لصفحات الأدمن العامة، أعد توجيهه
      if (currentView === 'ALL' || currentView === 'FORM' || currentView === 'MANAGE_OFFICES') {
        setCurrentView('OFFICE_ALL');
      }
    }
  }, [currentView, loggedInUser]);

  // Check logout and update heartbeat for Office users
  useEffect(() => {
    if (loggedInUser && loggedInUser.role === 'OFFICE' && isSupabaseConfigured) {
      // 1. Heartbeat function to update last_seen
      const updateHeartbeat = async () => {
        if (!loggedInUser.officeId) return;
        try {
          await supabase.from('office_users').update({ last_seen: new Date().toISOString() }).eq('id', loggedInUser.officeId);
        } catch (e) { console.error("Heartbeat error", e); }
      };

      // 2. Check logout status function
      const checkLogoutStatus = async () => {
        const { data } = await supabase.from('office_users').select('force_logout').eq('office_name', loggedInUser.username).single();
        if (data?.force_logout) {
          await supabase.from('office_users').update({ force_logout: false }).eq('office_name', loggedInUser.username);
          handleLogout();
          alert('انتهت جلستك. تم تسجيل خروجك من قبل المسؤول.');
        }
      };

      // Initial call
      updateHeartbeat();

      // Interval for heartbeat (every 1 minute) and logout check
      const interval = setInterval(() => {
        updateHeartbeat();
        checkLogoutStatus();
      }, 60000); // 60 seconds

      return () => clearInterval(interval);
    }
  }, [loggedInUser]);

  // Strict Filtering for activeReviewers based on Role
  const activeReviewers = useMemo(() => {
    // SECURITY: Office users should NEVER see Admin reviewers
    if (loggedInUser?.role !== 'ADMIN') return [];
    return reviewers.filter(r => !r.isArchived);
  }, [reviewers, loggedInUser]);

  // Strict Filtering for activeOfficeRecords based on Role
  const activeOfficeRecords = useMemo(() => {
    let records = officeRecords.filter(o => !o.isArchived);
    // SECURITY: Office users should ONLY see their own records
    if (loggedInUser?.role === 'OFFICE') {
      records = records.filter(o => o.affiliation === loggedInUser.username);
    }
    return records;
  }, [officeRecords, loggedInUser]);

  // حساب تكرار الأسماء عالمياً (عبر المراجعين والمكاتب)
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
      // STRICT: Only use filtered records
      relevantOfficeRecords = activeOfficeRecords;
      relevantReviewers = []; // Office users see 0 reviewers
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

  const handleLogin = async (usernameInput: string, passwordInput: string) => {
    setLoginError(null); setIsLoading(true);
    if (usernameInput === ADMIN_USERNAME && passwordInput === ADMIN_PASSWORD) {
      const user: LoggedInUser = { username: ADMIN_USERNAME, role: 'ADMIN' };
      setLoggedInUser(user); localStorage.setItem('loggedInUser', JSON.stringify(user));
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
          
          // Update last seen on login
          await supabase.from('office_users').update({ last_seen: new Date().toISOString() }).eq('id', data.id);

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

  const handleLogout = () => { setLoggedInUser(null); localStorage.removeItem('loggedInUser'); setCurrentView('ALL'); setViewHistory([]); setSessionStats(undefined); };

  const fetchAllData = async (silent = false) => {
    if (!loggedInUser || !isSupabaseConfigured) return;
    if (!silent) setIsLoading(true); else setIsSyncing(true);
    try {
      const results = await Promise.allSettled([
        supabase.from('reviewers').select('*, family_members(*)').order('created_at', { ascending: true }),
        supabase.from('office_users').select('*').order('office_name', { ascending: true }),
        supabase.from('office_records').select('*, office_family_members(*)').order('created_at', { ascending: true }),
        supabase.from('office_settlements').select('*').order('transaction_date', { ascending: false }),
        supabase.from('booking_sources').select('*').order('created_at', { ascending: true }),
        supabase.from('settlement_transactions').select('*').order('transaction_date', { ascending: false })
      ]);

      const [revResult, officeUsersResult, offResult, settlementsResult, sourcesResult, sourceSettlementsResult] = results.map(r => r.status === 'fulfilled' ? r.value : { data: [], error: r.reason });

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
        familyMembers: (rev.family_members || []).map((m: any) => ({ id: m.id, relationship: m.relationship, fullName: m.full_name, surname: m.surname, motherName: m.mother_name, dob: m.dob }))
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
        familyMembers: (off.office_family_members || []).map((m: any) => ({ id: m.id, relationship: m.relationship, fullName: m.full_name, surname: m.surname, motherName: m.mother_name, dob: m.dob }))
      })));

      setAllOfficeUsers((officeUsersResult.data || []).map((u: any) => ({
        ...u, 
        phone_number: u.phone_number, 
        username: u.username || u.office_name,
        last_seen: u.last_seen, // Added last_seen
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
              payload.booked_price_right_mosul = 0;
              payload.booked_price_left_mosul = 0;
              payload.booked_price_hammam_alalil = 0;
              payload.booked_price_alshoura = 0;
              payload.booked_price_baaj = 0;
              payload.booked_price_others = 0;
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

  const handleBulkToggleUploadStatus = async (type: 'reviewer' | 'office', ids: string[], status: boolean, sourceId?: string | null) => {
    if (ids.length === 0) return;
    setIsSyncing(true);
    try {
      const table = type === 'reviewer' ? 'reviewers' : 'office_records';
      const updatePayload: any = { is_uploaded: status };
      
      if (status) {
          updatePayload.uploaded_source_id = sourceId || null;
      } else {
          updatePayload.uploaded_source_id = null;
      }

      const { error } = await supabase.from(table).update(updatePayload).in('id', ids);
      if (error) throw error;
      showToast(status ? `تم رفع ${ids.length} سجل بنجاح` : `تم إلغاء رفع ${ids.length} سجل`, 'success');
      await fetchAllData(true);
    } catch (error: any) {
      showToast(`فشل العملية الجماعية: ${error.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Move to Trash (Soft Delete) ---
  const handleMoveToTrash = async (type: 'reviewer' | 'office', id: string) => {
    setIsSyncing(true);
    try {
      // 1. Fetch the full record with up-to-date family members
      const list = type === 'reviewer' ? reviewers : officeRecords;
      const record = list.find(r => r.id === id);
      if (!record) throw new Error('السجل غير موجود');

      // 2. Insert into recycle_bin (Save the record as is, with family members)
      const { error: trashError } = await supabase.from('recycle_bin').insert({
        original_id: record.id,
        record_type: type,
        full_name: record.headFullName,
        deleted_by: loggedInUser?.username || 'System',
        deleted_at: new Date().toISOString(),
        original_data: record // This saves the frontend state object (camelCase properties)
      });

      if (trashError) {
          console.error("Trash bin insert error", trashError);
      }

      // 3. Delete from original table (Cascade deletes members)
      const table = type === 'reviewer' ? 'reviewers' : 'office_records';
      const { error: deleteError } = await supabase.from(table).delete().eq('id', id);
      if (deleteError) throw deleteError;

      showToast('تم نقل السجل إلى سلة المحذوفات', 'success');
      await fetchAllData(true);
    } catch (error: any) {
      showToast(`فشل الحذف: ${error.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Restore from Trash ---
  const handleRestoreFromTrash = async (item: RecycleBinItem) => {
    setIsSyncing(true);
    try {
      const record = item.original_data;
      const table = item.record_type === 'reviewer' ? 'reviewers' : 'office_records';
      const familyTable = item.record_type === 'reviewer' ? 'family_members' : 'office_family_members';
      const mainIdKey = 'id';
      const familyForeignKey = item.record_type === 'reviewer' ? 'reviewer_id' : 'office_record_id';

      // 1. Prepare Main Record Data (Map camelCase to snake_case for DB)
      // Note: We MUST include 'created_at' to preserve sequence/order
      const dbRecord: any = {
        id: record.id,
        circle_type: record.circleType,
        head_full_name: record.headFullName,
        head_surname: record.headSurname,
        head_mother_name: record.headMotherName,
        head_dob: record.headDob,
        head_phone: record.headPhone,
        
        // Restore Status
        booking_image: record.bookingImage,
        booking_date: record.bookingDate,
        is_booked: record.isBooked,
        is_archived: record.isArchived,
        booked_source_id: record.bookedSourceId,
        is_uploaded: record.isUploaded,
        uploaded_source_id: record.uploadedSourceId,
        created_at: new Date(record.createdAt).toISOString(), // Preserve original creation time
        
        // Prices
        booked_price_right_mosul: record.bookedPriceRightMosul,
        booked_price_left_mosul: record.bookedPriceLeftMosul,
        booked_price_others: record.bookedPriceOthers,
        booked_price_hammam_alalil: record.bookedPriceHammamAlAlil,
        booked_price_alshoura: record.bookedPriceAlShoura,
        booked_price_baaj: record.bookedPriceBaaj,
      };

      if (record.bookingCreatedAt) {
        dbRecord.booking_created_at = new Date(record.bookingCreatedAt).toISOString();
      }

      // Reviewer Specific Fields
      if (item.record_type === 'reviewer') {
        dbRecord.paid_amount = record.paidAmount;
        dbRecord.remaining_amount = record.remainingAmount;
        dbRecord.notes = record.notes;
      }
      
      // Office Specific Fields
      if (item.record_type === 'office') {
        dbRecord.affiliation = record.affiliation;
        dbRecord.table_number = record.tableNumber;
      }

      // 2. Insert Main Record
      const { error: mainError } = await supabase.from(table).insert(dbRecord);
      if (mainError) throw mainError;

      // 3. Restore Family Members
      if (record.familyMembers && record.familyMembers.length > 0) {
        const dbMembers = record.familyMembers.map((m: any) => ({
          id: m.id,
          [familyForeignKey]: record.id,
          full_name: m.fullName,
          relationship: m.relationship,
          surname: m.surname,
          mother_name: m.motherName,
          dob: m.dob
        }));
        const { error: memberError } = await supabase.from(familyTable).insert(dbMembers);
        if (memberError) console.error("Error restoring members", memberError);
      }

      // 4. Delete from Recycle Bin
      await supabase.from('recycle_bin').delete().eq('id', item.id);

      showToast('تم استرجاع السجل ومكانه الأصلي بنجاح', 'success');
      await fetchAllData(true);
    } catch (error: any) {
      showToast(`فشل الاسترجاع: ${error.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Bulk Delete Logic ---
  const handleBulkDelete = async (type: 'reviewer' | 'office', ids: string[]) => {
    if (ids.length === 0) return;
    setIsSyncing(true);
    try {
      const list = type === 'reviewer' ? reviewers : officeRecords;
      const recordsToDelete = list.filter(r => ids.includes(r.id));
      
      const trashItems = recordsToDelete.map(r => ({
        original_id: r.id,
        record_type: type,
        full_name: r.headFullName,
        deleted_by: loggedInUser?.username || 'System',
        deleted_at: new Date().toISOString(),
        original_data: r
      }));

      // Insert bulk to trash
      const { error: trashError } = await supabase.from('recycle_bin').insert(trashItems);
      if (trashError) console.error("Bulk trash insert error", trashError);

      // Delete from source
      const table = type === 'reviewer' ? 'reviewers' : 'office_records';
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (error) throw error;

      showToast(`تم نقل ${ids.length} سجل إلى المحذوفات`, 'success');
      await fetchAllData(true);
    } catch (error: any) {
      showToast(`فشل الحذف الجماعي: ${error.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadAndBook = async (id: string, imageData: string, type: 'reviewer' | 'office') => {
    showToast('جاري تحليل صورة الحجز ذكياً...', 'success');
    setIsSyncing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const cleanBase64 = imageData.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { responseMimeType: "application/json" },
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
            { text: "استخرج تاريخ الحجز (booking_date) بصيغة YYYY-MM-DD فقط من صورة حجز البطاقة الوطنية. أجب بصيغة JSON." }
          ]
        }
      });
      
      const res = JSON.parse(response.text || '{}');
      const bookingDate = res.booking_date || new Date().toISOString().split('T')[0];
      const table = type === 'reviewer' ? 'reviewers' : 'office_records';
      
      const updatePayload: any = { is_booked: true, booking_image: imageData, booking_date: bookingDate, booking_created_at: new Date().toISOString() };
      
      if (type === 'office') {
        const record = officeRecords.find(r => r.id === id);
        if (record) {
          const office = allOfficeUsers.find(u => u.office_name.trim() === record.affiliation.trim());
          if (office) {
            updatePayload.booked_price_right_mosul = office.priceRightMosul || 0;
            updatePayload.booked_price_left_mosul = office.priceLeftMosul || 0;
            updatePayload.booked_price_hammam_alalil = office.priceHammamAlAlil || 0;
            updatePayload.booked_price_alshoura = office.priceAlShoura || 0;
            updatePayload.booked_price_baaj = office.priceBaaj || 0;
            updatePayload.booked_price_others = office.priceOthers || 0;
          }
        }
      }

      await supabase.from(table).update(updatePayload).eq('id', id);
      showToast(`تم النقل للمحجوزة بنجاح مع تثبيت الأسعار`, 'success');
      await fetchAllData(true);
    } catch (e: any) {
      showToast('فشل تحليل الصورة بشكل كامل', 'error');
      await handleToggleBooking(type, id, false, null, imageData, new Date().toISOString().split('T')[0]);
    } finally { setIsSyncing(false); }
  };

  const handleSettleOffice = async (officeId: string, amount: number, notes: string) => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('office_settlements').insert({
        office_id: officeId, amount, notes, recorded_by: ADMIN_USERNAME, transaction_date: new Date().toISOString()
      });
      if (error) throw error;

      const office = allOfficeUsers.find(u => u.id === officeId);
      if (office) {
        const officeBookings = officeRecords.filter(r => r.affiliation === office.office_name && (r.isBooked || !!r.bookingImage) && !r.isArchived);
        const totalRevenue = officeBookings.reduce((sum, r) => {
          let price = 0;
          if (r.circleType === CircleType.RIGHT_MOSUL) price = r.bookedPriceRightMosul || office.priceRightMosul || 0;
          else if (r.circleType === CircleType.LEFT_MOSUL) price = r.bookedPriceLeftMosul || office.priceLeftMosul || 0;
          else if (r.circleType === CircleType.HAMMAM_ALALIL) price = r.bookedPriceHammamAlAlil || office.priceHammamAlAlil || 0;
          else if (r.circleType === CircleType.ALSHOURA) price = r.bookedPriceAlShoura || office.priceAlShoura || 0;
          else if (r.circleType === CircleType.BAAJ) price = r.bookedPriceBaaj || office.priceBaaj || 0;
          else price = r.bookedPriceOthers || office.priceOthers || 0;
          return sum + Number(price);
        }, 0);

        const prevPaid = officeSettlements.filter(s => s.office_id === office.id).reduce((sum, s) => sum + s.amount, 0);
        const totalPaid = prevPaid + amount;

        if (totalPaid >= totalRevenue && officeBookings.length > 0) {
           const { error: archiveError } = await supabase
             .from('office_records')
             .update({ is_archived: true })
             .eq('affiliation', office.office_name)
             .or('is_booked.eq.true,booking_image.neq.null')
             .eq('is_archived', false);
           
           if (!archiveError) {
             showToast('تم تصفير الحساب وأرشفة السجلات تلقائياً ✅', 'success');
           }
        } else {
           showToast('تم تسجيل التسديد للمكتب بنجاح', 'success');
        }
      } else {
        showToast('تم تسجيل التسديد للمكتب بنجاح', 'success');
      }

      await fetchAllData(true);
      setCurrentView('MANAGE_OFFICES'); 
    } catch (err) { 
      showToast('فشل تسجيل التسديد', 'error'); 
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportBackup = async (data: { reviewers?: Reviewer[], officeRecords?: OfficeRecord[] }) => {
    setIsLoading(true);
    try {
      if (data.reviewers && data.reviewers.length > 0) {
        for (const r of data.reviewers) {
          const { familyMembers, ...rest } = r;
          const dbReviewer: any = {
            id: rest.id,
            head_full_name: rest.headFullName,
            head_surname: rest.headSurname,
            head_mother_name: rest.headMotherName,
            head_dob: rest.headDob,
            head_phone: rest.headPhone,
            circle_type: rest.circleType,
            paid_amount: rest.paidAmount,
            remaining_amount: rest.remainingAmount,
            notes: rest.notes,
            booking_image: rest.bookingImage,
            booking_date: rest.bookingDate,
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
            created_at: new Date(rest.createdAt).toISOString()
          };
          if (rest.bookingCreatedAt) dbReviewer.booking_created_at = new Date(rest.bookingCreatedAt).toISOString();

          await supabase.from('reviewers').upsert(dbReviewer);

          if (familyMembers && familyMembers.length > 0) {
            await supabase.from('family_members').delete().eq('reviewer_id', r.id);
            const dbMembers = familyMembers.map(m => ({
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

      if (data.officeRecords && data.officeRecords.length > 0) {
        for (const o of data.officeRecords) {
          const { familyMembers, ...rest } = o;
          const dbRecord: any = {
            id: rest.id,
            head_full_name: rest.headFullName,
            head_surname: rest.headSurname,
            head_mother_name: rest.headMotherName,
            head_dob: rest.headDob,
            head_phone: rest.headPhone,
            circle_type: rest.circleType,
            affiliation: rest.affiliation,
            table_number: rest.tableNumber,
            booking_image: rest.bookingImage,
            booking_date: rest.bookingDate,
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
            created_at: new Date(rest.createdAt).toISOString()
          };
          if (rest.bookingCreatedAt) dbRecord.booking_created_at = new Date(rest.bookingCreatedAt).toISOString();

          await supabase.from('office_records').upsert(dbRecord);

          if (familyMembers && familyMembers.length > 0) {
            await supabase.from('office_family_members').delete().eq('office_record_id', o.id);
            const dbMembers = familyMembers.map(m => ({
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
      
      showToast('تم استيراد البيانات بنجاح', 'success');
      await fetchAllData(true);
      setCurrentView(isAdmin ? 'ALL' : 'OFFICE_FORM');
    } catch (e: any) {
      showToast(`فشل الاستيراد: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveBookingFromSource = async (recordId: string, sourceId: string | null, recordType: 'reviewer' | 'office') => {
    setIsSyncing(true);
    try {
      const table = recordType === 'reviewer' ? 'reviewers' : 'office_records';
      const { error } = await supabase.from(table).update({ booked_source_id: sourceId }).eq('id', recordId);
      if (error) throw error;
      
      if (recordType === 'reviewer') {
        setReviewers(prev => prev.map(r => r.id === recordId ? { ...r, bookedSourceId: sourceId } : r));
      } else {
        setOfficeRecords(prev => prev.map(r => r.id === recordId ? { ...r, bookedSourceId: sourceId } : r));
      }
      showToast('تم تحديث الارتباط بنجاح', 'success');
    } catch (e: any) {
      showToast(`فشل التحديث: ${e.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBookReviewerToSource = async (reviewerId: string, sourceId: string, imageData: string | null, date: string | null) => {
    const updatePayload: any = {
      is_booked: true,
      booked_source_id: sourceId,
      booking_created_at: new Date().toISOString()
    };
    if (imageData) updatePayload.booking_image = imageData;
    if (date) updatePayload.booking_date = date;

    const { error } = await supabase.from('reviewers').update(updatePayload).eq('id', reviewerId);
    if (error) throw error;
    
    setReviewers(prev => prev.map(r => r.id === reviewerId ? { ...r, ...updatePayload, isBooked: true, bookedSourceId: sourceId, bookingImage: imageData || r.bookingImage, bookingDate: date || r.bookingDate } : r));
  };

  const handleBookOfficeRecordToSource = async (officeRecordId: string, sourceId: string, imageData: string | null, date: string | null) => {
    const updatePayload: any = {
      is_booked: true,
      booked_source_id: sourceId,
      booking_created_at: new Date().toISOString()
    };
    if (imageData) updatePayload.booking_image = imageData;
    if (date) updatePayload.booking_date = date;

    const { error } = await supabase.from('office_records').update(updatePayload).eq('id', officeRecordId);
    if (error) throw error;

    setOfficeRecords(prev => prev.map(r => r.id === officeRecordId ? { ...r, ...updatePayload, isBooked: true, bookedSourceId: sourceId, bookingImage: imageData || r.bookingImage, bookingDate: date || r.bookingDate } : r));
  };

  const handleSettleSourcePayment = async (sourceId: string, amount: number, notes?: string) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.from('settlement_transactions').insert({
          source_id: sourceId,
          amount,
          notes,
          recorded_by: loggedInUser?.username,
          transaction_date: new Date().toISOString()
      }).select().single();
      
      if (error) throw error;
      
      if (data) {
          setSourceSettlements(prev => [{
              id: data.id,
              source_id: data.source_id,
              amount: parseFloat(data.amount),
              transaction_date: new Date(data.transaction_date).getTime(),
              recorded_by: data.recorded_by,
              notes: data.notes
          }, ...prev]);
      }

      const source = bookingSources.find(s => s.id === sourceId);
      if (source) {
        const linkedReviewers = activeReviewers.filter(r => r.bookedSourceId === source.id);
        const linkedOffices = activeOfficeRecords.filter(o => o.bookedSourceId === source.id);
        const allLinked = [...linkedReviewers, ...linkedOffices];

        const totalRevenue = allLinked.reduce((sum, item) => {
          let price = 0;
          if (item.circleType === CircleType.RIGHT_MOSUL) price = item.bookedPriceRightMosul || source.priceRightMosul || 0;
          else if (item.circleType === CircleType.LEFT_MOSUL) price = item.bookedPriceLeftMosul || source.priceLeftMosul || 0;
          else if (item.circleType === CircleType.HAMMAM_ALALIL) price = item.bookedPriceHammamAlAlil || source.priceHammamAlAlil || 0;
          else if (item.circleType === CircleType.ALSHOURA) price = item.bookedPriceAlShoura || source.priceAlShoura || 0;
          else if (item.circleType === CircleType.BAAJ) price = item.bookedPriceBaaj || source.priceBaaj || 0;
          else price = item.bookedPriceOthers || source.priceOthers || 0;
          return sum + Number(price);
        }, 0);

        const prevPaid = sourceSettlements.filter(s => s.source_id === source.id).reduce((sum, s) => sum + s.amount, 0);
        const totalPaid = prevPaid + amount;

        if (totalPaid >= totalRevenue && allLinked.length > 0) {
           await supabase.from('reviewers').update({ is_archived: true }).eq('booked_source_id', source.id).eq('is_archived', false);
           await supabase.from('office_records').update({ is_archived: true }).eq('booked_source_id', source.id).eq('is_archived', false);
           showToast('تم تصفير الحساب وأرشفة الحجوزات المرتبطة تلقائياً ✅', 'success');
        } else {
           showToast('تم تسجيل الدفعة بنجاح', 'success');
        }
      } else {
        showToast('تم تسجيل الدفعة بنجاح', 'success');
      }
      
      await fetchAllData(true);
    } catch (e: any) {
      showToast(`فشل التسديد: ${e.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleNavigate = useCallback((view: ViewType, data: any = null) => {
    if (currentView !== view) setViewHistory(prev => [...prev, { view: currentView, data: currentViewData }]);
    setCurrentView(view); setCurrentViewData(data); setIsSidebarOpen(false);
  }, [currentView, currentViewData]);

  const onGoBack = useCallback(() => {
    setEditingReviewer(null); setEditingOffice(null);
    if (viewHistory.length > 0) {
      const last = viewHistory.pop();
      setCurrentView(last!.view); setCurrentViewData(last!.data);
    } else setCurrentView(isAdmin ? 'FORM' : 'OFFICE_ALL'); 
  }, [viewHistory, isAdmin]);

  if (!loggedInUser) return <LoginScreen onLogin={handleLogin} errorMessage={loginError} isLoading={isLoading} />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-cairo" dir="rtl">
      <Navbar 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        onRefresh={() => fetchAllData(true)} 
        isSyncing={isSyncing} 
        loggedInUser={loggedInUser} 
        onLogout={handleLogout} 
        allOfficeUsers={allOfficeUsers} 
      />
      
      {showSourceStatementModal && selectedSourceForAction && (
        <SourceAccountStatementModal 
          isOpen={showSourceStatementModal}
          onClose={() => setShowSourceStatementModal(false)}
          source={selectedSourceForAction}
          allReviewers={reviewers}
          allOfficeRecords={officeRecords}
          defaultTab={sourceStatementTab}
          onRemoveBookingFromSource={handleRemoveBookingFromSource}
          showToast={showToast}
          formatCurrency={formatCurrency}
        />
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[3rem] w-full max-sm text-center border-2 border-slate-900 shadow-2xl animate-scale-up">
            <h3 className="text-2xl font-black mb-4 text-red-600">تصفير النظام</h3>
            <p className="text-slate-500 mb-6 font-bold text-sm leading-relaxed">سيتم حذف كافة السجلات نهائياً. أدخل "تأكيد" للمتابعة.</p>
            <input type="text" value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)} placeholder="تأكيد" className="w-full p-4 mb-6 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-center" />
            <div className="flex flex-col gap-2">
              <button disabled={resetConfirmText !== 'تأكيد'} onClick={async () => { setIsLoading(true); try { await supabase.from('reviewers').delete().neq('id', '0'); await supabase.from('office_records').delete().neq('id', '0'); showToast('تم التصفير'); await fetchAllData(true); setShowResetModal(false); } catch(e){} finally{setIsLoading(false);} }} className="w-full bg-red-600 text-white py-4 rounded-xl font-black">تصفير الآن</button>
              <button onClick={() => setShowResetModal(false)} className="w-full text-slate-400 font-bold py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-1 relative overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} stats={stats} currentView={currentView} onNavigate={handleNavigate} onResetClick={() => setShowResetModal(true)} onLogout={handleLogout} loggedInUser={loggedInUser} sessionStats={sessionStats} />
        <main className="flex-1 p-3 md:p-6 w-full overflow-y-auto">
          <div className="max-w-7xl mx-auto pb-20">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4"><div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full shadow-lg"></div></div>
            ) : (
              <>
                {currentView === 'FORM' ? (
                  <ReviewerForm onSave={async (r) => { 
                    try {
                        const payload = { 
                            id: r.id, 
                            head_full_name: r.headFullName, 
                            head_surname: r.headSurname, 
                            head_mother_name: r.headMotherName, 
                            head_dob: r.headDob, 
                            head_phone: r.headPhone, 
                            circle_type: r.circleType, 
                            paid_amount: r.paidAmount ? Number(r.paidAmount) : 0, 
                            remaining_amount: r.remainingAmount ? Number(r.remainingAmount) : 0, 
                            notes: r.notes,
                            created_at: new Date(r.createdAt).toISOString()
                        };
                        const { error: mainError } = await supabase.from('reviewers').upsert(payload);
                        if (mainError) throw new Error(`خطأ في قاعدة البيانات: ${mainError.message}`);

                        const { error: delError } = await supabase.from('family_members').delete().eq('reviewer_id', r.id);
                        if (delError) console.error("Family delete error", delError);

                        if (r.familyMembers.length) {
                            const membersPayload = r.familyMembers.map(m => ({ 
                                reviewer_id: r.id, 
                                full_name: m.fullName, 
                                relationship: m.relationship, 
                                surname: m.surname, 
                                mother_name: m.motherName, 
                                dob: m.dob 
                            }));
                            const { error: memError } = await supabase.from('family_members').insert(membersPayload);
                            if (memError) throw new Error(`خطأ في حفظ العائلة: ${memError.message}`);
                        }
                        
                        showToast('تم الحفظ بنجاح'); 
                        await fetchAllData(true); 
                        if(editingReviewer){setEditingReviewer(null); setCurrentView('ALL');} 
                    } catch (err: any) {
                        throw err; 
                    }
                  }} onGoBack={onGoBack} formatCurrency={formatCurrency} initialData={editingReviewer || undefined} isEditMode={!!editingReviewer} showToast={showToast} />
                ) : currentView === 'OFFICE_FORM' ? (
                  <OfficeForm onSave={async (r) => { 
                    try {
                        const payload = { 
                            id: r.id, 
                            head_full_name: r.headFullName, 
                            head_surname: r.headSurname, 
                            head_mother_name: r.headMotherName, 
                            head_dob: r.headDob, 
                            head_phone: r.headPhone, 
                            circle_type: r.circleType, 
                            affiliation: r.affiliation, 
                            table_number: r.tableNumber,
                            created_at: new Date(r.createdAt).toISOString()
                        };
                        const { error: mainError } = await supabase.from('office_records').upsert(payload);
                        if (mainError) throw new Error(`خطأ في قاعدة البيانات: ${mainError.message}`);

                        const { error: delError } = await supabase.from('office_family_members').delete().eq('office_record_id', r.id);
                        if (delError) console.error("Family delete error", delError);

                        if (r.familyMembers.length) {
                            const membersPayload = r.familyMembers.map(m => ({ 
                                office_record_id: r.id, 
                                full_name: m.fullName, 
                                relationship: m.relationship, 
                                surname: m.surname, 
                                mother_name: m.motherName, 
                                dob: m.dob 
                            }));
                            const { error: memError } = await supabase.from('office_family_members').insert(membersPayload);
                            if (memError) throw new Error(`خطأ في حفظ العائلة: ${memError.message}`);
                        }

                        showToast('تم الحفظ بنجاح'); 
                        await fetchAllData(true); 
                        if(editingOffice){setEditingOffice(null); setCurrentView('OFFICE_ALL');} 
                    } catch (err: any) {
                        throw err;
                    }
                  }} onGoBack={onGoBack} loggedInUser={loggedInUser} allOfficeUsers={allOfficeUsers} formatCurrency={formatCurrency} initialData={editingOffice || undefined} isEditMode={!!editingOffice} showToast={showToast} />
                ) : currentView === 'ALL' ? (
                  <ReviewerTable 
                    reviewers={activeReviewers} 
                    globalNameFrequency={globalNameFrequency} 
                    onDelete={(id) => handleMoveToTrash('reviewer', id)} 
                    onUpdate={r => { setEditingReviewer(r); setCurrentView('FORM'); }} 
                    onToggleBooking={(id, s, sid) => handleToggleBooking('reviewer', id, s, sid)} 
                    onUploadAndBook={handleUploadAndBook} 
                    onToggleUploadStatus={async (id, s, sourceId) => { try { await supabase.from('reviewers').update({ is_uploaded: !s, uploaded_source_id: !s ? sourceId : null }).eq('id', id); showToast('تم التحديث'); await fetchAllData(true); } catch(e){}}} 
                    bookingSources={bookingSources} 
                    loggedInUser={loggedInUser} 
                    showToast={showToast} 
                    formatCurrency={formatCurrency} 
                    onDeleteMember={async (rid, mid) => { try { await supabase.from('family_members').delete().eq('id', mid); showToast('تم الحذف'); await fetchAllData(true); } catch(e){}}} 
                    onBulkToggleUploadStatus={(ids, status, sourceId) => handleBulkToggleUploadStatus('reviewer', ids, status, sourceId)} 
                    onBulkDelete={(ids) => handleBulkDelete('reviewer', ids)} 
                  />
                ) : currentView === 'OFFICE_ALL' ? (
                  <OfficeTable 
                    records={activeOfficeRecords} 
                    globalNameFrequency={globalNameFrequency} 
                    onDelete={(id) => handleMoveToTrash('office', id)} 
                    onUpdate={r => { setEditingOffice(r); setCurrentView('OFFICE_FORM'); }} 
                    onToggleBooking={(id, s, sid) => handleToggleBooking('office', id, s, sid)} 
                    onUploadAndBook={handleUploadAndBook} 
                    onToggleUploadStatus={async (id, s, sourceId) => { try { await supabase.from('office_records').update({ is_uploaded: !s, uploaded_source_id: !s ? sourceId : null }).eq('id', id); showToast('تم التحديث'); await fetchAllData(true); } catch(e){}}} 
                    bookingSources={bookingSources} 
                    loggedInUser={loggedInUser} 
                    showToast={showToast} 
                    formatCurrency={formatCurrency} 
                    onDeleteMember={async (rid, mid) => { try { await supabase.from('office_family_members').delete().eq('id', mid); showToast('تم الحذف'); await fetchAllData(true); } catch(e){}}} 
                    allOfficeUsers={allOfficeUsers} 
                    onBulkToggleUploadStatus={(ids, status, sourceId) => handleBulkToggleUploadStatus('office', ids, status, sourceId)} 
                    onBulkDelete={(ids) => handleBulkDelete('office', ids)} 
                  />
                ) : currentView === 'AI_LIST_UPLOAD' ? (
                  <OfficeSmartListImporter 
                    onGoBack={onGoBack} 
                    showToast={showToast} 
                    loggedInUser={loggedInUser!} 
                    onSuccess={() => {
                      fetchAllData(true);
                      setCurrentView('OFFICE_ALL');
                    }}
                  />
                ) : currentView === 'COMPLETED_BOOKINGS' ? (
                  <CompletedBookings 
                    reviewers={reviewers} 
                    officeRecords={officeRecords} 
                    bookingSources={bookingSources} 
                    onGoBack={onGoBack} 
                    onUnbook={async (type, id) => handleToggleBooking(type, id, true)} 
                    onDelete={(type, id) => handleMoveToTrash(type, id)}
                    onArchive={async (type, id) => { try { const table = type === 'reviewer' ? 'reviewers' : 'office_records'; await supabase.from(table).update({ is_archived: true }).eq('id', id); showToast('تم الأرشفة'); await fetchAllData(true); } catch(e){}}} 
                    loggedInUser={loggedInUser} 
                  />
                ) : currentView === 'ARCHIVE_BOOKINGS' ? (
                  <ArchiveBookings 
                    reviewers={reviewers} 
                    officeRecords={officeRecords} 
                    bookingSources={bookingSources} 
                    onGoBack={onGoBack} 
                    onUnarchive={async (type, id) => { try { const table = type === 'reviewer' ? 'reviewers' : 'office_records'; await supabase.from(table).update({ is_archived: false }).eq('id', id); showToast('تم إلغاء الأرشفة'); await fetchAllData(true); } catch(e){}}} 
                    onDelete={(type, id) => handleMoveToTrash(type, id)}
                    loggedInUser={loggedInUser} 
                    formatCurrency={formatCurrency} 
                  />
                ) : currentView === 'MANAGE_OFFICES' ? (
                  <ManageOffices onOpenOfficeStatement={(off) => { setSelectedOfficeForAction(off); handleNavigate('OFFICE_STATEMENT'); }} showToast={showToast} loggedInUser={loggedInUser} onLogout={handleLogout} fetchAllData={fetchAllData} allOfficeUsers={allOfficeUsers} onGoBack={onGoBack} />
                ) : currentView === 'OFFICE_STATEMENT' ? (
                  <OfficeStatement office={selectedOfficeForAction} records={officeRecords} settlements={officeSettlements} onGoBack={onGoBack} formatCurrency={formatCurrency} onOpenSettle={() => handleNavigate('OFFICE_SETTLE')} />
                ) : currentView === 'OFFICE_SETTLE' ? (
                  <SettleOfficePage office={selectedOfficeForAction!} onGoBack={onGoBack} onSettle={handleSettleOffice} formatCurrency={formatCurrency} />
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
                    onOpenSettleOffice={(office) => {
                      setSelectedOfficeForAction(office);
                      handleNavigate('OFFICE_SETTLE');
                    }}
                    onOpenSettleSource={(source, balance) => {
                      setSelectedSourceForAction(source);
                      setOutstandingBalanceForSettle(balance);
                      handleNavigate('SETTLE_SOURCE');
                    }}
                  />
                ) : currentView === 'BOOKING_SOURCES_MANAGER' ? (
                  <BookingSourcesManager 
                    showToast={showToast}
                    loggedInUser={loggedInUser!}
                    fetchAllData={fetchAllData}
                    onGoBack={onGoBack}
                    bookingSources={bookingSources}
                    allReviewers={reviewers} 
                    allOfficeRecords={officeRecords} 
                    onViewAccountStatement={(source, tab) => {
                      setSelectedSourceForAction(source);
                      setSourceStatementTab(tab);
                      setShowSourceStatementModal(true);
                    }}
                    onOpenAddBookingToSourcePage={(source) => {
                      setSelectedSourceForAction(source);
                      handleNavigate('ADD_BOOKING_TO_SOURCE');
                    }}
                    onOpenSettleSourcePage={(source, balance) => {
                      setSelectedSourceForAction(source);
                      setOutstandingBalanceForSettle(balance);
                      handleNavigate('SETTLE_SOURCE');
                    }}
                    onRemoveBookingFromSource={handleRemoveBookingFromSource}
                  />
                ) : currentView === 'ADD_BOOKING_TO_SOURCE' ? (
                  <AddBookingToSourcePage 
                    source={selectedSourceForAction!}
                    allReviewers={reviewers}
                    allOfficeRecords={officeRecords}
                    onGoBack={onGoBack}
                    showToast={showToast}
                    onBookReviewer={handleBookReviewerToSource}
                    onBookOfficeRecord={handleBookOfficeRecordToSource}
                  />
                ) : currentView === 'SETTLE_SOURCE' ? (
                  <SettleSourcePage 
                    source={selectedSourceForAction!}
                    outstandingBalance={outstandingBalanceForSettle}
                    onGoBack={onGoBack}
                    showToast={showToast}
                    loggedInUser={loggedInUser!}
                    formatCurrency={formatCurrency}
                    onSettlePayment={handleSettleSourcePayment}
                  />
                ) : currentView === 'SESSIONS' ? (
                  <SessionsManager 
                    onGoBack={onGoBack}
                    showToast={showToast}
                    loggedInUser={loggedInUser!}
                    onStatsUpdate={setSessionStats}
                  />
                ) : currentView === 'SETTINGS' ? (
                  <SettingsPage onNavigate={handleNavigate} onResetClick={() => setShowResetModal(true)} onGoBack={onGoBack} loggedInUser={loggedInUser} />
                ) : currentView === 'BACKUP' ? (
                  <BackupManager 
                    reviewers={reviewers} 
                    officeRecords={officeRecords} 
                    onImport={handleImportBackup} 
                    onGoBack={onGoBack} 
                  />
                ) : currentView === 'TRASH' ? (
                  <TrashBin onGoBack={onGoBack} showToast={showToast} onRestore={handleRestoreFromTrash} />
                ) : currentView === 'USER_ACTIVITY' ? (
                  <UserActivityLog allOfficeUsers={allOfficeUsers} onGoBack={onGoBack} />
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>
      {toast && <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg text-white font-bold animate-scale-up z-[3000] ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>{toast.message}</div>}
    </div>
  );
};
export default App;
