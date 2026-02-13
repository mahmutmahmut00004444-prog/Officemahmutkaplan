
import { createClient } from '@supabase/supabase-js';

/**
 * ⚠️ كود SQL الشامل (انسخ هذا الكود وضعه في SQL Editor في Supabase) ⚠️
 * 
 * هذا الكود آمن 100%:
 * - ينشئ الجداول المفقودة فقط.
 * - يضيف الأعمدة الناقصة للجداول الموجودة (مثل updated_by).
 * - لا يحذف أي بيانات موجودة.
 * 
 * -------------------------------------------------------------------------------------
 * 
 * -- 1. جدول المراجعين (Reviewers)
 * CREATE TABLE IF NOT EXISTS public.reviewers (
 *     id TEXT PRIMARY KEY,
 *     circle_type TEXT,
 *     head_full_name TEXT,
 *     head_surname TEXT,
 *     head_mother_name TEXT,
 *     head_dob TEXT,
 *     head_phone TEXT,
 *     paid_amount NUMERIC DEFAULT 0,
 *     remaining_amount NUMERIC DEFAULT 0,
 *     notes TEXT,
 *     booking_image TEXT,
 *     booking_date TEXT,
 *     booking_created_at TIMESTAMPTZ,
 *     is_booked BOOLEAN DEFAULT FALSE,
 *     is_archived BOOLEAN DEFAULT FALSE,
 *     booked_source_id TEXT,
 *     is_uploaded BOOLEAN DEFAULT FALSE,
 *     uploaded_source_id TEXT,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * -- إضافة الأعمدة الناقصة (للتحديثات)
 * ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_right_mosul NUMERIC DEFAULT 0;
 * ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_left_mosul NUMERIC DEFAULT 0;
 * ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_others NUMERIC DEFAULT 0;
 * ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_hammam_alalil NUMERIC DEFAULT 0;
 * ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_alshoura NUMERIC DEFAULT 0;
 * ALTER TABLE public.reviewers ADD COLUMN IF NOT EXISTS booked_price_baaj NUMERIC DEFAULT 0;
 * 
 * -- 2. جدول أفراد عائلة المراجعين
 * CREATE TABLE IF NOT EXISTS public.family_members (
 *     id TEXT PRIMARY KEY,
 *     reviewer_id TEXT REFERENCES public.reviewers(id) ON DELETE CASCADE,
 *     full_name TEXT,
 *     relationship TEXT,
 *     surname TEXT,
 *     mother_name TEXT,
 *     dob TEXT
 * );
 * 
 * -- 3. جدول مستخدمي المكاتب (Office Users)
 * CREATE TABLE IF NOT EXISTS public.office_users (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     office_name TEXT UNIQUE,
 *     username TEXT,
 *     password TEXT,
 *     phone_number TEXT,
 *     created_at TIMESTAMPTZ DEFAULT NOW(),
 *     created_by TEXT,
 *     force_logout BOOLEAN DEFAULT FALSE
 * );
 * -- إضافة الأعمدة الناقصة
 * ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS username TEXT;
 * ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ; 
 * ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS device_name TEXT; -- حقل جديد لاسم الجهاز
 * ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_right_mosul NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_left_mosul NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_others NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_hammam_alalil NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_alshoura NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_users ADD COLUMN IF NOT EXISTS price_baaj NUMERIC DEFAULT 0;
 * 
 * -- 4. جدول سجلات المكاتب (Office Records)
 * CREATE TABLE IF NOT EXISTS public.office_records (
 *     id TEXT PRIMARY KEY,
 *     circle_type TEXT,
 *     head_full_name TEXT,
 *     head_surname TEXT,
 *     head_mother_name TEXT,
 *     head_dob TEXT,
 *     head_phone TEXT,
 *     affiliation TEXT,
 *     table_number TEXT,
 *     booking_image TEXT,
 *     booking_date TEXT,
 *     booking_created_at TIMESTAMPTZ,
 *     is_booked BOOLEAN DEFAULT FALSE,
 *     is_archived BOOLEAN DEFAULT FALSE,
 *     booked_source_id TEXT,
 *     is_uploaded BOOLEAN DEFAULT FALSE,
 *     uploaded_source_id TEXT,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * -- إضافة الأعمدة الناقصة
 * ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_right_mosul NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_left_mosul NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_others NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_hammam_alalil NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_alshoura NUMERIC DEFAULT 0;
 * ALTER TABLE public.office_records ADD COLUMN IF NOT EXISTS booked_price_baaj NUMERIC DEFAULT 0;
 * 
 * -- 5. جدول أفراد عائلة سجلات المكاتب
 * CREATE TABLE IF NOT EXISTS public.office_family_members (
 *     id TEXT PRIMARY KEY,
 *     office_record_id TEXT REFERENCES public.office_records(id) ON DELETE CASCADE,
 *     full_name TEXT,
 *     relationship TEXT,
 *     surname TEXT,
 *     mother_name TEXT,
 *     dob TEXT
 * );
 * 
 * -- 6. جدول مصادر الحجوزات (Booking Sources)
 * CREATE TABLE IF NOT EXISTS public.booking_sources (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     source_name TEXT,
 *     phone_number TEXT,
 *     created_at TIMESTAMPTZ DEFAULT NOW(),
 *     created_by TEXT
 * );
 * -- إضافة الأعمدة الناقصة
 * ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_right_mosul NUMERIC DEFAULT 0;
 * ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_left_mosul NUMERIC DEFAULT 0;
 * ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_others NUMERIC DEFAULT 0;
 * ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_hammam_alalil NUMERIC DEFAULT 0;
 * ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_alshoura NUMERIC DEFAULT 0;
 * ALTER TABLE public.booking_sources ADD COLUMN IF NOT EXISTS price_baaj NUMERIC DEFAULT 0;
 * 
 * -- 7. جداول الحسابات والتسديدات
 * CREATE TABLE IF NOT EXISTS public.office_settlements (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     office_id uuid REFERENCES public.office_users(id),
 *     amount NUMERIC,
 *     transaction_date TIMESTAMPTZ DEFAULT NOW(),
 *     recorded_by TEXT,
 *     notes TEXT
 * );
 * 
 * CREATE TABLE IF NOT EXISTS public.settlement_transactions (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     source_id uuid REFERENCES public.booking_sources(id) ON DELETE CASCADE,
 *     amount NUMERIC,
 *     transaction_date TIMESTAMPTZ DEFAULT NOW(),
 *     recorded_by TEXT,
 *     notes TEXT
 * );
 * 
 * -- 8. جدول سجلات المعالجة (Processing Logs)
 * CREATE TABLE IF NOT EXISTS public.processing_logs (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     file_name TEXT,
 *     extracted_name TEXT,
 *     extracted_date TEXT,
 *     target_table_type TEXT,
 *     matched_name TEXT,
 *     status TEXT,
 *     image_data TEXT,
 *     date_key TEXT,
 *     timestamp TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 9. جدول الأجهزة/النسخ (Devices)
 * CREATE TABLE IF NOT EXISTS public.devices (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     device_name TEXT NOT NULL,
 *     created_at TIMESTAMPTZ DEFAULT NOW(),
 *     created_by TEXT
 * );
 *
 * -- 10. جدول الجلسات (Sessions)
 * CREATE TABLE IF NOT EXISTS public.sessions (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     phone_number TEXT NOT NULL,
 *     phone_source TEXT,
 *     device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
 *     last_booking_date TEXT,
 *     is_booked BOOLEAN DEFAULT FALSE,
 *     created_at TIMESTAMPTZ DEFAULT NOW(),
 *     created_by TEXT
 * );
 * ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_uploaded BOOLEAN DEFAULT FALSE;
 * 
 * -- 11. جدول إعدادات التطبيق (App Settings)
 * CREATE TABLE IF NOT EXISTS public.app_settings (
 *     key TEXT PRIMARY KEY,
 *     value TEXT,
 *     updated_at TIMESTAMPTZ DEFAULT NOW(),
 *     updated_by TEXT
 * );
 * ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS updated_by TEXT;
 * 
 * -- 12. جدول المحذوفات (Recycle Bin) - جديد
 * CREATE TABLE IF NOT EXISTS public.recycle_bin (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     original_id TEXT,
 *     record_type TEXT,
 *     full_name TEXT,
 *     deleted_by TEXT,
 *     deleted_at TIMESTAMPTZ DEFAULT NOW(),
 *     original_data JSONB
 * );
 * 
 * -- تحديث المخطط
 * NOTIFY pgrst, 'reload schema';
 * -------------------------------------------------------------------------------------
 */

const supabaseUrl = 'https://zynwngjfziggjxtiqwrn.supabase.co'; 
const supabaseAnonKey = 'sb_publishable_P3v2In8L5vA3pG75GAmEYg_8JaXM3TE'; 

export const isSupabaseConfigured = true;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
