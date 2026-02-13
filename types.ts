
export enum CircleType {
  RIGHT_MOSUL = '1021',
  LEFT_MOSUL = '1022',
  OTHERS = '0000',
  HAMMAM_ALALIL = '1023',
  ALSHOURA = '1024',
  BAAJ = '1025'
}

export const CIRCLE_NAMES: Record<CircleType, string> = {
  [CircleType.RIGHT_MOSUL]: 'موصل الأيمن',
  [CircleType.LEFT_MOSUL]: 'موصل الأيسر',
  [CircleType.OTHERS]: 'دوائر أخرى',
  [CircleType.HAMMAM_ALALIL]: 'دائرة الحمام العليل',
  [CircleType.ALSHOURA]: 'دائرة الشورة',
  [CircleType.BAAJ]: 'دائرة البعاج'
};

export interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  surname: string;
  motherName: string;
  dob: string;
}

export interface Reviewer {
  id: string;
  circleType: CircleType;
  headFullName: string;
  headSurname: string;
  headMotherName: string;
  headDob: string;
  headPhone: string;
  paidAmount?: string; 
  remainingAmount?: string; 
  notes?: string; 
  bookingImage?: string; 
  bookingDate?: string;
  bookingCreatedAt?: number; 
  isBooked?: boolean;
  isArchived?: boolean;
  bookedSourceId?: string | null;
  isUploaded?: boolean;
  uploadedSourceId?: string | null;
  bookedPriceRightMosul?: number;
  bookedPriceLeftMosul?: number;
  bookedPriceOthers?: number;
  bookedPriceHammamAlAlil?: number;
  bookedPriceAlShoura?: number;
  bookedPriceBaaj?: number;
  familyMembers: FamilyMember[];
  createdAt: number;
}

export interface OfficeRecord {
  id: string;
  circleType: CircleType;
  headFullName: string;
  headSurname: string;
  headMotherName: string;
  headDob: string;
  headPhone: string;
  affiliation: string; 
  tableNumber?: string;
  bookingImage?: string;
  bookingDate?: string;
  bookingCreatedAt?: number; 
  isBooked?: boolean;
  isArchived?: boolean;
  bookedSourceId?: string | null;
  isUploaded?: boolean;
  uploadedSourceId?: string | null;
  bookedPriceRightMosul?: number;
  bookedPriceLeftMosul?: number;
  bookedPriceOthers?: number;
  bookedPriceHammamAlAlil?: number;
  bookedPriceAlShoura?: number;
  bookedPriceBaaj?: number;
  familyMembers: FamilyMember[];
  createdAt: number;
}

export interface BookingSource {
  id: string;
  sourceName: string;
  phoneNumber: string;
  priceRightMosul: number;
  priceLeftMosul: number;
  priceOthers: number;
  priceHammamAlAlil: number;
  priceAlShoura: number;
  priceBaaj: number;
  createdAt: number;
  createdBy: string;
}

export interface Device {
  id: string;
  deviceName: string;
  createdAt: number;
  createdBy: string;
}

export interface Session {
  id: string;
  phoneNumber: string;
  phoneSource: string;
  deviceId?: string; // ID of the linked device
  device?: Device; // The actual device object (joined)
  lastBookingDate?: string; // تاريخ آخر حجز
  isBooked?: boolean; // هل تم الحجز اليوم (محجوز غير صالح)
  isUploaded?: boolean; // هل تم الرفع
  createdAt: number;
  createdBy: string;
}

export interface OfficeSettlement {
  id: string;
  office_id: string;
  amount: number;
  transaction_date: string;
  recorded_by: string;
  notes?: string;
}

export interface SettlementTransaction {
  id: string;
  source_id: string;
  amount: number;
  transaction_date: number;
  recorded_by: string;
  notes?: string;
}

export interface RecycleBinItem {
  id: string;
  original_id: string;
  record_type: 'reviewer' | 'office';
  full_name: string;
  deleted_by: string;
  deleted_at: string;
  original_data: any;
}

export type ViewType = 'FORM' | 'ALL' | 'SMART_READER' | 'OFFICE_FORM' | 'OFFICE_ALL' | 'BACKUP' | 'MANAGE_OFFICES' | 'SETTINGS' | 'BOOKING_ALBUM' | 'ARCHIVE_BOOKINGS' | 'OFFICE_STATEMENT' | 'OFFICE_SETTLE' | 'COMPLETED_BOOKINGS' | 'ACCOUNTS_BLOG' | 'BOOKING_SOURCES_MANAGER' | 'ADD_BOOKING_TO_SOURCE' | 'SETTLE_SOURCE' | 'SESSIONS' | 'AI_LIST_UPLOAD' | 'TRASH' | 'USER_ACTIVITY';

export interface ProcessingLog {
  id: string;
  timestamp: number;
  fileName: string;
  extractedName: string;
  extractedDate?: string;
  targetTableType: 'REVIEWERS' | 'OFFICES' | 'NONE';
  matchedName: string;
  status: 'success' | 'fail';
  imageData: string;
  errorMessage?: string;
  dateKey: string;
  matchedReviewerId?: string;
  matchedOfficeId?: string;
}

export type UserRole = 'ADMIN' | 'OFFICE';

export interface LoggedInUser {
  username: string;
  role: UserRole;
  officeId?: string;
}

export interface OfficeUser {
  id: string;
  office_name: string;
  username: string; 
  password?: string;
  phone_number?: string;
  created_at: string;
  created_by: string;
  last_seen?: string; // New field for user activity
  device_name?: string; // New field for device name
  force_logout?: boolean; // New field for forced logout
  priceRightMosul?: number;
  priceLeftMosul?: number;
  priceHammamAlAlil?: number;
  priceAlShoura?: number;
  priceBaaj?: number;
  priceOthers?: number;
}

export interface ViewHistoryEntry {
  view: ViewType;
  data?: any;
}

export type SourceStatementTab = 'summary' | 'booked' | 'settlements';

export interface SessionStats {
  total: number;
  available: number;
  unavailable: number;
}
