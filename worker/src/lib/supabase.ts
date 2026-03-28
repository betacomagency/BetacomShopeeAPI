import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

/** Supabase client with service_role key — bypasses RLS, use server-side only */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
