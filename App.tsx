
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

  // Helper to get simple device name
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
    const storedPass = localStorage.getItem('admin_password');
    if (storedPass) {
      setAdminDynamicPassword(storedPass);
    } else {
      localStorage.setItem('admin_password', DEFAULT_ADMIN_PASSWORD);
    }
  }, []);

  // Handle Admin Password Change
  const handleChangeAdminPassword = async (oldPass: string, newPass: string) => {
    if (oldPass !== adminDynamicPassword) {
      throw new Error("كلمة المرور الحالية غير صحيحة");
    }
    if (newPass.length < 6) {
      throw new Error("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
    }

    localStorage.setItem('admin_password', newPass);
    setAdminDynamicPassword(newPass);
    showToast("تم تغيير كلمة مرور المدير بنجاح", "success");
  };

  useEffect(() => {
    if (loggedInUser?.role === 'OFFICE') {
      if (currentView === 'ALL' || currentView === 'FORM' || currentView === 'MANAGE_OFFICES') {
        setCurrentView('OFFICE_ALL');
      }
    }
  }, [currentView, loggedInUser]);

  useEffect(() => {
    if (loggedInUser && loggedInUser.role === 'OFFICE') {
      // Heartbeat and logout checks removed as they depend on Supabase
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

  const handleLogin = async (usernameInput: string, passwordInput: string) => {
    setLoginError(null); setIsLoading(true);
    if (usernameInput === ADMIN_USERNAME && passwordInput === adminDynamicPassword) {
      const user: LoggedInUser = { username: ADMIN_USERNAME, role: 'ADMIN' };
      setLoggedInUser(user); localStorage.setItem('loggedInUser', JSON.stringify(user));
      showToast('تم تسجيل الدخول كمدير'); setIsLoading(false); setCurrentView('FORM'); return;
    }
    
    // Check local office users
    const officeUser = allOfficeUsers.find(u => (u.office_name === usernameInput || u.username === usernameInput) && u.password === passwordInput);
    if (officeUser) {
      const user: LoggedInUser = { username: officeUser.office_name, role: 'OFFICE', officeId: officeUser.id };
      setLoggedInUser(user); localStorage.setItem('loggedInUser', JSON.stringify(user));
      showToast(`مرحباً بك: ${officeUser.office_name}`); setIsLoading(false); setCurrentView('OFFICE_ALL'); return;
    } else {
      setLoginError("اسم المستخدم أو كلمة المرور غير صحيحة");
    }
    setIsLoading(false);
  };

  const handleLogout = () => { setLoggedInUser(null); localStorage.removeItem('loggedInUser'); setCurrentView('ALL'); setViewHistory([]); setSessionStats(undefined); };

  const fetchAllData = async (silent = false) => {
    if (!loggedInUser) return;
    if (!silent) setIsLoading(true); else setIsSyncing(true);
    try {
      const storedReviewers = localStorage.getItem('reviewers');
      const storedOfficeUsers = localStorage.getItem('office_users');
      const storedOfficeRecords = localStorage.getItem('office_records');
      const storedSettlements = localStorage.getItem('office_settlements');
      const storedSources = localStorage.getItem('booking_sources');
      const storedSourceSettlements = localStorage.getItem('settlement_transactions');

      if (storedReviewers) setReviewers(JSON.parse(storedReviewers));
      if (storedOfficeUsers) setAllOfficeUsers(JSON.parse(storedOfficeUsers));
      if (storedOfficeRecords) setOfficeRecords(JSON.parse(storedOfficeRecords));
      if (storedSettlements) setOfficeSettlements(JSON.parse(storedSettlements));
      if (storedSources) setBookingSources(JSON.parse(storedSources));
      if (storedSourceSettlements) setSourceSettlements(JSON.parse(storedSourceSettlements));

    } catch (e: any) { 
      showToast(`فشل جلب البيانات: ${e.message}`, 'error'); 
    } 
    finally { setIsLoading(false); setIsSyncing(false); }
  };

  useEffect(() => { fetchAllData(); }, [loggedInUser]);

  const handleToggleBooking = async (type: 'reviewer' | 'office', id: string, initialState: boolean, sourceId?: string | null, imageData?: string | null, bookingDate?: string | null) => {
    try {
      const isBooking = !initialState;
      
      if (type === 'reviewer') {
        setReviewers(prev => {
          const updated = prev.map(r => {
            if (r.id === id) {
              const payload: any = { ...r, isBooked: isBooking, bookedSourceId: sourceId || null };
              if (isBooking) {
                payload.bookingCreatedAt = new Date().getTime();
                if (imageData) payload.bookingImage = imageData;
                if (bookingDate) payload.bookingDate = bookingDate;
              } else {
                payload.bookingCreatedAt = undefined; payload.bookingImage = null; payload.bookingDate = null;
                payload.isUploaded = false; payload.uploadedSourceId = null;
              }
              return payload;
            }
            return r;
          });
          localStorage.setItem('reviewers', JSON.stringify(updated));
          return updated;
        });
      } else {
        setOfficeRecords(prev => {
          const updated = prev.map(r => {
            if (r.id === id) {
              const payload: any = { ...r, isBooked: isBooking, bookedSourceId: sourceId || null };
              if (isBooking) {
                payload.bookingCreatedAt = new Date().getTime();
                if (imageData) payload.bookingImage = imageData;
                if (bookingDate) payload.bookingDate = bookingDate;

                const office = allOfficeUsers.find(u => u.office_name.trim() === r.affiliation.trim());
                if (office) {
                  payload.bookedPriceRightMosul = office.priceRightMosul || 0;
                  payload.bookedPriceLeftMosul = office.priceLeftMosul || 0;
                  payload.bookedPriceHammamAlAlil = office.priceHammamAlAlil || 0;
                  payload.bookedPriceAlShoura = office.priceAlShoura || 0;
                  payload.bookedPriceBaaj = office.priceBaaj || 0;
                  payload.bookedPriceOthers = office.priceOthers || 0;
                }
              } else {
                payload.bookingCreatedAt = undefined; payload.bookingImage = null; payload.bookingDate = null;
                payload.bookedPriceRightMosul = 0; payload.bookedPriceLeftMosul = 0; payload.bookedPriceOthers = 0;
                payload.bookedPriceHammamAlAlil = 0; payload.bookedPriceAlShoura = 0; payload.bookedPriceBaaj = 0;
                payload.isUploaded = false; payload.uploadedSourceId = null;
              }
              return payload;
            }
            return r;
          });
          localStorage.setItem('office_records', JSON.stringify(updated));
          return updated;
        });
      }

      showToast(initialState ? 'تم إلغاء الحجز' : 'تم النقل وتثبيت السعر');
    } catch (err) { showToast('فشل تحديث حالة الحجز', 'error'); }
  };

  const handleDeleteReceipt = async (id: string) => {
    // Check if it exists in reviewers or officeRecords to determine type
    const isReviewer = reviewers.some(r => r.id === id);
    const type = isReviewer ? 'reviewer' : 'office';
    
    // Toggle booking state to false (initialState=true means currently booked, so flip to false)
    await handleToggleBooking(type, id, true, null);
  };

  const handleImportBackup = async (data: any) => {
    setIsLoading(true);
    try {
      if (data.reviewers) {
        setReviewers(data.reviewers);
        localStorage.setItem('reviewers', JSON.stringify(data.reviewers));
      }
      if (data.officeRecords) {
        setOfficeRecords(data.officeRecords);
        localStorage.setItem('office_records', JSON.stringify(data.officeRecords));
      }
      if (data.bookingSources) {
        setBookingSources(data.bookingSources);
        localStorage.setItem('booking_sources', JSON.stringify(data.bookingSources));
      }
      if (data.officeUsers) {
        setAllOfficeUsers(data.officeUsers);
        localStorage.setItem('office_users', JSON.stringify(data.officeUsers));
      }
      if (data.officeSettlements) {
        setOfficeSettlements(data.officeSettlements);
        localStorage.setItem('office_settlements', JSON.stringify(data.officeSettlements));
      }
      if (data.sourceSettlements) {
        setSourceSettlements(data.sourceSettlements);
        localStorage.setItem('settlement_transactions', JSON.stringify(data.sourceSettlements));
      }
      
      showToast('تم استيراد كافة البيانات بنجاح', 'success');
      setCurrentView(isAdmin ? 'ALL' : 'OFFICE_FORM');
    } catch (e: any) {
      showToast(`فشل الاستيراد: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
      setReviewers([]);
      setOfficeRecords([]);
      localStorage.removeItem('reviewers');
      localStorage.removeItem('office_records');
      showToast('تم تصفير النظام بنجاح', 'success');
    } catch (error: any) {
      showToast(`فشل التصفير: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMockData = async () => {
    setIsLoading(true);
    try {
      const mockFamilies: OfficeRecord[] = [];
      const firstNames = ["أحمد", "محمد", "علي", "حسين", "عمر", "زيد", "خالد", "ياسر", "مصطفى", "إبراهيم"];
      const lastNames = ["العبيدي", "الجبوري", "الطائي", "الشمري", "الدليمي", "الساعدي", "الخفاجي", "المالكي", "الأسدي", "التميمي"];
      const motherNames = ["فاطمة", "زينب", "مريم", "خديجة", "عائشة", "سارة", "ليلى", "نور", "هدى", "منى"];
      const relationships = ["ابن", "ابنة", "زوجة", "أخ", "أخت"];

      for (let i = 1; i <= 50; i++) {
        const headId = crypto.randomUUID();
        const headFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const headLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const headMotherName = motherNames[Math.floor(Math.random() * motherNames.length)];
        
        const familyMembersCount = Math.floor(Math.random() * 5); // 0 to 4 members
        const familyMembers = [];
        for (let j = 0; j < familyMembersCount; j++) {
          familyMembers.push({
            id: crypto.randomUUID(),
            office_record_id: headId,
            fullName: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${headFirstName} ${headLastName}`,
            motherName: motherNames[Math.floor(Math.random() * motherNames.length)],
            dob: `19${Math.floor(Math.random() * 20) + 80}-0${Math.floor(Math.random() * 9) + 1}-1${Math.floor(Math.random() * 9) + 1}`,
            relationship: relationships[Math.floor(Math.random() * relationships.length)],
            surname: headLastName
          });
        }

        mockFamilies.push({
          id: headId,
          circleType: Object.values(CircleType)[Math.floor(Math.random() * Object.values(CircleType).length)],
          headFullName: `${headFirstName} ${firstNames[Math.floor(Math.random() * firstNames.length)]} ${headLastName}`,
          headSurname: headLastName,
          headMotherName: headMotherName,
          headDob: `19${Math.floor(Math.random() * 30) + 60}-0${Math.floor(Math.random() * 9) + 1}-1${Math.floor(Math.random() * 9) + 1}`,
          headPhone: `07${Math.floor(Math.random() * 90000000) + 10000000}`,
          affiliation: allOfficeUsers.length > 0 ? allOfficeUsers[Math.floor(Math.random() * allOfficeUsers.length)].office_name : ADMIN_USERNAME,
          createdAt: new Date().toISOString(),
          familyMembers: familyMembers,
          isUploaded: Math.random() > 0.5,
          isBooked: Math.random() > 0.7
        });
      }

      const updatedRecords = [...officeRecords, ...mockFamilies];
      setOfficeRecords(updatedRecords);
      localStorage.setItem('office_records', JSON.stringify(updatedRecords));
      showToast('تم إضافة 50 عائلة افتراضية بنجاح');
    } catch (err) {
      showToast('فشل إضافة البيانات الافتراضية', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const onSaveReviewer = async (reviewer: Reviewer) => {
    try {
      setReviewers(prev => {
        const index = prev.findIndex(r => r.id === reviewer.id);
        let updated;
        if (index > -1) {
          updated = [...prev];
          updated[index] = reviewer;
        } else {
          updated = [...prev, reviewer];
        }
        localStorage.setItem('reviewers', JSON.stringify(updated));
        return updated;
      });
      
      showToast('تم حفظ السجل بنجاح', 'success');
      if(editingReviewer) setEditingReviewer(null);
      setCurrentView('ALL');
    } catch (e: any) {
      throw e;
    }
  };

  const onSaveOfficeRecord = async (record: OfficeRecord) => {
    try {
        setOfficeRecords(prev => {
          const index = prev.findIndex(r => r.id === record.id);
          let updated;
          if (index > -1) {
            updated = [...prev];
            updated[index] = record;
          } else {
            updated = [...prev, record];
          }
          localStorage.setItem('office_records', JSON.stringify(updated));
          return updated;
        });

        showToast('تم حفظ سجل المكتب بنجاح', 'success');
        if(editingOffice) setEditingOffice(null);
        if (isAdmin) setCurrentView('OFFICE_ALL');
    } catch (e: any) {
        console.error("Failed to save office record:", e);
        throw e;
    }
  };

  const onDeleteReviewer = async (id: string) => {
    try {
        const reviewer = reviewers.find(r => r.id === id);
        if (reviewer) {
            const trashItem: RecycleBinItem = {
                id: crypto.randomUUID(),
                original_id: reviewer.id,
                record_type: 'reviewer',
                full_name: reviewer.headFullName,
                deleted_by: loggedInUser?.username || 'Unknown',
                deleted_at: new Date().toISOString(),
                original_data: reviewer
            };
            const storedTrash = localStorage.getItem('recycle_bin');
            const trash = storedTrash ? JSON.parse(storedTrash) : [];
            localStorage.setItem('recycle_bin', JSON.stringify([trashItem, ...trash]));
        }
        setReviewers(prev => {
          const updated = prev.filter(r => r.id !== id);
          localStorage.setItem('reviewers', JSON.stringify(updated));
          return updated;
        });
        showToast('تم حذف السجل', 'success');
    } catch (e: any) {
        showToast(`فشل الحذف: ${e.message}`, 'error');
    }
  };

  const onDeleteOfficeRecord = async (id: string) => {
    try {
        const record = officeRecords.find(r => r.id === id);
        if (record) {
            const trashItem: RecycleBinItem = {
                id: crypto.randomUUID(),
                original_id: record.id,
                record_type: 'office',
                full_name: record.headFullName,
                deleted_by: loggedInUser?.username || 'Unknown',
                deleted_at: new Date().toISOString(),
                original_data: record
            };
            const storedTrash = localStorage.getItem('recycle_bin');
            const trash = storedTrash ? JSON.parse(storedTrash) : [];
            localStorage.setItem('recycle_bin', JSON.stringify([trashItem, ...trash]));
        }
        setOfficeRecords(prev => {
          const updated = prev.filter(r => r.id !== id);
          localStorage.setItem('office_records', JSON.stringify(updated));
          return updated;
        });
        showToast('تم حذف سجل المكتب', 'success');
    } catch (e: any) {
        showToast(`فشل الحذف: ${e.message}`, 'error');
    }
  };

  const onDeleteMember = async (recordId: string, memberId: string) => {
    const isReviewer = reviewers.some(r => r.id === recordId);
    try {
        if (isReviewer) {
          setReviewers(prev => {
            const updated = prev.map(r => {
              if (r.id === recordId) {
                return { ...r, familyMembers: r.familyMembers.filter(m => m.id !== memberId) };
              }
              return r;
            });
            localStorage.setItem('reviewers', JSON.stringify(updated));
            return updated;
          });
        } else {
          setOfficeRecords(prev => {
            const updated = prev.map(r => {
              if (r.id === recordId) {
                return { ...r, familyMembers: r.familyMembers.filter(m => m.id !== memberId) };
              }
              return r;
            });
            localStorage.setItem('office_records', JSON.stringify(updated));
            return updated;
          });
        }
        showToast('تم حذف الفرد', 'success');
    } catch (e: any) {
        showToast(`فشل حذف الفرد: ${e.message}`, 'error');
    }
  };

  const onToggleUploadStatus = async (id: string, currentState: boolean, currentSourceId: string | null) => {
    const isReviewer = reviewers.some(r => r.id === id);
    const newStatus = !currentState;
    
    try {
        if (isReviewer) {
          setReviewers(prev => {
            const updated = prev.map(r => r.id === id ? { ...r, isUploaded: newStatus, uploadedSourceId: newStatus ? currentSourceId : null } : r);
            localStorage.setItem('reviewers', JSON.stringify(updated));
            return updated;
          });
        } else {
          setOfficeRecords(prev => {
            const updated = prev.map(r => r.id === id ? { ...r, isUploaded: newStatus, uploadedSourceId: newStatus ? currentSourceId : null } : r);
            localStorage.setItem('office_records', JSON.stringify(updated));
            return updated;
          });
        }
        
        showToast(newStatus ? 'تم تغيير الحالة إلى مرفوع' : 'تم إلغاء حالة الرفع', 'success');
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
        const newSettlement = {
            id: crypto.randomUUID(),
            office_id: officeId,
            amount,
            notes,
            recorded_by: loggedInUser?.username,
            transaction_date: new Date().toISOString()
        };
        setOfficeSettlements(prev => {
          const updated = [newSettlement, ...prev];
          localStorage.setItem('office_settlements', JSON.stringify(updated));
          return updated;
        });
        showToast('تم تسجيل الدفعة بنجاح', 'success');
    } catch (e: any) {
        showToast(`فشل التسجيل: ${e.message}`, 'error');
    }
  };

  const handleSettleSource = async (sourceId: string, amount: number, notes?: string) => {
    try {
        const newSettlement = {
            id: crypto.randomUUID(),
            source_id: sourceId,
            amount,
            notes: notes || '',
            recorded_by: loggedInUser?.username || '',
            transaction_date: new Date().getTime()
        };
        setSourceSettlements(prev => {
          const updated = [newSettlement, ...prev];
          localStorage.setItem('settlement_transactions', JSON.stringify(updated));
          return updated;
        });
        showToast('تم تسجيل التسديد للمصدر', 'success');
    } catch (e: any) {
        showToast(`فشل التسديد: ${e.message}`, 'error');
    }
  };

  const onBulkToggleUploadStatus = async (ids: string[], status: boolean, sourceId?: string | null) => {
    try {
        setReviewers(prev => {
          const updated = prev.map(r => ids.includes(r.id) ? { ...r, isUploaded: status, uploadedSourceId: status ? (sourceId || null) : null } : r);
          localStorage.setItem('reviewers', JSON.stringify(updated));
          return updated;
        });
        setOfficeRecords(prev => {
          const updated = prev.map(r => ids.includes(r.id) ? { ...r, isUploaded: status, uploadedSourceId: status ? (sourceId || null) : null } : r);
          localStorage.setItem('office_records', JSON.stringify(updated));
          return updated;
        });
        showToast(`تم تحديث ${ids.length} سجل`, 'success');
    } catch (e: any) {
        showToast(`فشل التحديث الجماعي: ${e.message}`, 'error');
    }
  };

  const onBulkDelete = async (ids: string[]) => {
    try {
        setReviewers(prev => {
          const updated = prev.filter(r => !ids.includes(r.id));
          localStorage.setItem('reviewers', JSON.stringify(updated));
          return updated;
        });
        setOfficeRecords(prev => {
          const updated = prev.filter(r => !ids.includes(r.id));
          localStorage.setItem('office_records', JSON.stringify(updated));
          return updated;
        });
        showToast(`تم حذف ${ids.length} سجل`, 'success');
    } catch (e: any) {
        showToast(`فشل الحذف الجماعي: ${e.message}`, 'error');
    }
  };

  const handleRestoreFromTrash = async (item: RecycleBinItem) => {
      try {
          const { original_data, record_type } = item;
          
          if (record_type === 'reviewer') {
            setReviewers(prev => {
              const updated = [...prev, original_data];
              localStorage.setItem('reviewers', JSON.stringify(updated));
              return updated;
            });
          } else {
            setOfficeRecords(prev => {
              const updated = [...prev, original_data];
              localStorage.setItem('office_records', JSON.stringify(updated));
              return updated;
            });
          }
          
          // Delete from recycle bin
          const storedTrash = localStorage.getItem('recycle_bin');
          if (storedTrash) {
            const trash = JSON.parse(storedTrash).filter((i: any) => i.id !== item.id);
            localStorage.setItem('recycle_bin', JSON.stringify(trash));
          }
          
          showToast('تم استرجاع السجل', 'success');
          fetchAllData(true);
      } catch (e: any) {
          showToast(`فشل الاسترجاع: ${e.message}`, 'error');
      }
  };

  if (!loggedInUser) return <LoginScreen onLogin={handleLogin} errorMessage={loginError} isLoading={isLoading} />;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-cairo text-right" dir="rtl">
      <Navbar 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        onRefresh={() => fetchAllData()} 
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
                  onUnarchive={async (type, id) => { 
                    if (type === 'reviewer') {
                      setReviewers(prev => {
                        const updated = prev.map(r => r.id === id ? { ...r, isArchived: false } : r);
                        localStorage.setItem('reviewers', JSON.stringify(updated));
                        return updated;
                      });
                    } else {
                      setOfficeRecords(prev => {
                        const updated = prev.map(r => r.id === id ? { ...r, isArchived: false } : r);
                        localStorage.setItem('office_records', JSON.stringify(updated));
                        return updated;
                      });
                    }
                    showToast('تم استرجاع السجل', 'success'); 
                  }}
                  onDelete={async (type, id) => { 
                    if (type === 'reviewer') {
                      setReviewers(prev => {
                        const updated = prev.filter(r => r.id !== id);
                        localStorage.setItem('reviewers', JSON.stringify(updated));
                        return updated;
                      });
                    } else {
                      setOfficeRecords(prev => {
                        const updated = prev.filter(r => r.id !== id);
                        localStorage.setItem('office_records', JSON.stringify(updated));
                        return updated;
                      });
                    }
                    showToast('تم الحذف النهائي', 'success'); 
                  }}
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
                  onArchive={async (type, id) => { 
                    if (type === 'reviewer') {
                      setReviewers(prev => {
                        const updated = prev.map(r => r.id === id ? { ...r, isArchived: true } : r);
                        localStorage.setItem('reviewers', JSON.stringify(updated));
                        return updated;
                      });
                    } else {
                      setOfficeRecords(prev => {
                        const updated = prev.map(r => r.id === id ? { ...r, isArchived: true } : r);
                        localStorage.setItem('office_records', JSON.stringify(updated));
                        return updated;
                      });
                    }
                    showToast('تمت الأرشفة', 'success'); 
                  }}
                  loggedInUser={loggedInUser}
                />
            ) : currentView === 'SETTINGS' ? (
                <SettingsPage 
                  onNavigate={(view) => onNavigate(view)}
                  onResetClick={() => setShowResetModal(true)}
                  onGoBack={onGoBack}
                  loggedInUser={loggedInUser}
                  onChangeAdminPassword={handleChangeAdminPassword}
                  onGenerateMockData={handleGenerateMockData}
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
                  settlementTransactions={settlementTransactions}
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
                      if (type === 'reviewer') {
                        setReviewers(prev => {
                          const updated = prev.map(r => r.id === id ? { ...r, bookedSourceId: null } : r);
                          localStorage.setItem('reviewers', JSON.stringify(updated));
                          return updated;
                        });
                      } else {
                        setOfficeRecords(prev => {
                          const updated = prev.map(r => r.id === id ? { ...r, bookedSourceId: null } : r);
                          localStorage.setItem('office_records', JSON.stringify(updated));
                          return updated;
                        });
                      }
                      showToast('تم إلغاء الارتباط', 'success');
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
                  transactions={settlementTransactions.filter(t => t.source_id === currentViewData.source.id)}
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
                settlementTransactions={settlementTransactions.filter(t => t.source_id === selectedSourceForAction?.id)}
                onRemoveBookingFromSource={async (id, srcId, type) => {
                    if (type === 'reviewer') {
                      setReviewers(prev => {
                        const updated = prev.map(r => r.id === id ? { ...r, bookedSourceId: null } : r);
                        localStorage.setItem('reviewers', JSON.stringify(updated));
                        return updated;
                      });
                    } else {
                      setOfficeRecords(prev => {
                        const updated = prev.map(r => r.id === id ? { ...r, bookedSourceId: null } : r);
                        localStorage.setItem('office_records', JSON.stringify(updated));
                        return updated;
                      });
                    }
                    showToast('تم إلغاء الارتباط', 'success');
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
