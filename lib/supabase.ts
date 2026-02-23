
import { createClient } from '@supabase/supabase-js';

/**
 * ⚡️ كود SQL الشامل والمحسن (انسخ هذا الكود بالكامل وضعه في SQL Editor في Supabase) ⚡️
 * 
 * الميزات:
 * 1. Data Safety: لا يقوم بحذف أي بيانات (يستخدم IF NOT EXISTS).
 * 2. Performance: يضيف فهارس (Indexes) لتسريع البحث.
 * 3. Security: يفعل RLS ويضيف سياسات الوصول.
 * 
 * -------------------------------------------------------------------------------------

-- تفعيل الامتدادات الضرورية لتوليد المعرفات
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. جدول المراجعين (Reviewers)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.reviewers (
    id TEXT PRIMARY KEY,
    circle_type TEXT,
    head_full_name TEXT,
    head_surname TEXT,
    head_mother_name TEXT,
    head_dob TEXT,
    head_phone TEXT,
    paid_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    notes TEXT,
    booking_image TEXT,
    booking_date TEXT,
    booking_created_at TIMESTAMPTZ,
    is_booked BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    booked_source_id TEXT,
    is_uploaded BOOLEAN DEFAULT FALSE,
    uploaded_source_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- تحديث الأعمدة المفقودة بأمان
ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_right_mosul NUMERIC DEFAULT 0;
ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_left_mosul NUMERIC DEFAULT 0;
ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_others NUMERIC DEFAULT 0;
ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_hammam_alalil NUMERIC DEFAULT 0;
ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_alshoura NUMERIC DEFAULT 0;
ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_baaj NUMERIC DEFAULT 0;

-- فهارس السرعة
CREATE INDEX IF NOT EXISTS idx_reviewers_name ON public.reviewers(head_full_name);
CREATE INDEX IF NOT EXISTS idx_reviewers_phone ON public.reviewers(head_phone);
CREATE INDEX IF NOT EXISTS idx_reviewers_created ON public.reviewers(created_at);

-- ==========================================
-- 2. جدول أفراد عائلة المراجعين
-- ==========================================
CREATE TABLE IF NOT EXISTS public.family_members (
    id TEXT PRIMARY KEY,
    reviewer_id TEXT REFERENCES public.reviewers(id) ON DELETE CASCADE,
    full_name TEXT,
    relationship TEXT,
    surname TEXT,
    mother_name TEXT,
    dob TEXT
);
CREATE INDEX IF NOT EXISTS idx_family_reviewer_id ON public.family_members(reviewer_id);

-- ==========================================
-- 3. جدول مستخدمي المكاتب (Office Users)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.office_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    office_name TEXT UNIQUE,
    username TEXT,
    password TEXT,
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    force_logout BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ,
    device_name TEXT
);
ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_right_mosul NUMERIC DEFAULT 0;
ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_left_mosul NUMERIC DEFAULT 0;
ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_others NUMERIC DEFAULT 0;
ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_hammam_alalil NUMERIC DEFAULT 0;
ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_alshoura NUMERIC DEFAULT 0;
ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_baaj NUMERIC DEFAULT 0;

-- ==========================================
-- 4. جدول سجلات المكاتب (Office Records)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.office_records (
    id TEXT PRIMARY KEY,
    circle_type TEXT,
    head_full_name TEXT,
    head_surname TEXT,
    head_mother_name TEXT,
    head_dob TEXT,
    head_phone TEXT,
    affiliation TEXT,
    table_number TEXT,
    booking_image TEXT,
    booking_date TEXT,
    booking_created_at TIMESTAMPTZ,
    is_booked BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    booked_source_id TEXT,
    is_uploaded BOOLEAN DEFAULT FALSE,
    uploaded_source_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_right_mosul NUMERIC DEFAULT 0;
ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_left_mosul NUMERIC DEFAULT 0;
ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_others NUMERIC DEFAULT 0;
ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_hammam_alalil NUMERIC DEFAULT 0;
ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_alshoura NUMERIC DEFAULT 0;
ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_baaj NUMERIC DEFAULT 0;

-- فهارس السرعة
CREATE INDEX IF NOT EXISTS idx_office_records_name ON public.office_records(head_full_name);
CREATE INDEX IF NOT EXISTS idx_office_records_affiliation ON public.office_records(affiliation);

-- ==========================================
-- 5. جدول أفراد عائلة سجلات المكاتب
-- ==========================================
CREATE TABLE IF NOT EXISTS public.office_family_members (
    id TEXT PRIMARY KEY,
    office_record_id TEXT REFERENCES public.office_records(id) ON DELETE CASCADE,
    full_name TEXT,
    relationship TEXT,
    surname TEXT,
    mother_name TEXT,
    dob TEXT
);
CREATE INDEX IF NOT EXISTS idx_office_family_record_id ON public.office_family_members(office_record_id);

-- ==========================================
-- 6. جدول مصادر الحجوزات (Booking Sources)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.booking_sources (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source_name TEXT,
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);
ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_right_mosul NUMERIC DEFAULT 0;
ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_left_mosul NUMERIC DEFAULT 0;
ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_others NUMERIC DEFAULT 0;
ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_hammam_alalil NUMERIC DEFAULT 0;
ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_alshoura NUMERIC DEFAULT 0;
ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_baaj NUMERIC DEFAULT 0;

-- ==========================================
-- 7. جداول الحسابات والتسديدات
-- ==========================================
CREATE TABLE IF NOT EXISTS public.office_settlements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    office_id uuid REFERENCES public.office_users(id),
    amount NUMERIC,
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    recorded_by TEXT,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_settlements_office_id ON public.office_settlements(office_id);

CREATE TABLE IF NOT EXISTS public.settlement_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id uuid REFERENCES public.booking_sources(id) ON DELETE CASCADE,
    amount NUMERIC,
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    recorded_by TEXT,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_transactions_source_id ON public.settlement_transactions(source_id);

-- ==========================================
-- 8. جدول سجلات المعالجة (Processing Logs)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.processing_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name TEXT,
    extracted_name TEXT,
    extracted_date TEXT,
    target_table_type TEXT,
    matched_name TEXT,
    status TEXT,
    image_data TEXT,
    date_key TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 9. جدول الأجهزة (Devices)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.devices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    device_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- ==========================================
-- 10. جدول الجلسات (Sessions)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number TEXT NOT NULL,
    phone_source TEXT,
    device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
    last_booking_date TEXT,
    is_booked BOOLEAN DEFAULT FALSE,
    is_uploaded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_phone ON public.sessions(phone_number);

-- ==========================================
-- 11. جدول الإعدادات (Settings)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- ==========================================
-- 12. جدول المحذوفات (Recycle Bin)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.recycle_bin (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    original_id TEXT,
    record_type TEXT,
    full_name TEXT,
    deleted_by TEXT,
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    original_data JSONB
);

-- ==========================================
-- 13. جدول النشاطات (Activity Logs)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type TEXT, 
    description TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- تفعيل الأمان (RLS) وسياسات الوصول
-- ==========================================

-- تفعيل RLS لجميع الجداول
ALTER TABLE public.reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recycle_bin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة إن وجدت لضمان التحديث
DROP POLICY IF EXISTS "Allow all access" ON public.reviewers;
DROP POLICY IF EXISTS "Allow all access" ON public.family_members;
DROP POLICY IF EXISTS "Allow all access" ON public.office_users;
DROP POLICY IF EXISTS "Allow all access" ON public.office_records;
DROP POLICY IF EXISTS "Allow all access" ON public.office_family_members;
DROP POLICY IF EXISTS "Allow all access" ON public.booking_sources;
DROP POLICY IF EXISTS "Allow all access" ON public.office_settlements;
DROP POLICY IF EXISTS "Allow all access" ON public.settlement_transactions;
DROP POLICY IF EXISTS "Allow all access" ON public.processing_logs;
DROP POLICY IF EXISTS "Allow all access" ON public.devices;
DROP POLICY IF EXISTS "Allow all access" ON public.sessions;
DROP POLICY IF EXISTS "Allow all access" ON public.app_settings;
DROP POLICY IF EXISTS "Allow all access" ON public.recycle_bin;
DROP POLICY IF EXISTS "Allow all access" ON public.activity_logs;

-- إنشاء سياسات تسمح للتطبيق بالعمل (بما أن المصادقة مخصصة وليست عبر Supabase Auth)
CREATE POLICY "Allow all access" ON public.reviewers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.family_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.office_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.office_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.office_family_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.booking_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.office_settlements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.settlement_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.processing_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.recycle_bin FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- تحديث الذاكرة المؤقتة للمخطط
NOTIFY pgrst, 'reload schema';

 * -------------------------------------------------------------------------------------
 */

const supabaseUrl = 'https://zynwngjfziggjxtiqwrn.supabase.co'; 
const supabaseAnonKey = 'sb_publishable_P3v2In8L5vA3pG75GAmEYg_8JaXM3TE'; 

export const isSupabaseConfigured = true;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
