import { createClient } from '@supabase/supabase-js';

// 🔗 Supabase Project Credentials
const SUPABASE_URL = 'https://xfhmqxgbrmpijmwcsgkn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmaG1xeGdicm1waWptd2NzZ2tuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0Mzk5MTQsImV4cCI6MjA3NjAxNTkxNH0.s3OW5OSp2t7XpNg6WV2ygjXTQhWzMQBjqviHj7y0qzk';

// ⚙️ Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);