import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mcdulfpxsruqrdqlwrfi.supabase.co';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZHVsZnB4c3J1cXJkcWx3cmZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzOTI2NzAsImV4cCI6MjA4ODk2ODY3MH0.AzYZsDwY9qsWpZ-Ug7uESxfWWEjz1FkbJ6zJqBRL9Zk';
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || anon;

export const supabase = createClient(url, anon);
export const supabaseAdmin = createClient(url, service);