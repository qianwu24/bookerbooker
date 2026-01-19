import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    flowType: 'pkce', // Use PKCE flow instead of implicit (removes # from URL)
  },
});

export const API_BASE_URL = `${supabaseUrl}/functions/v1/make-server-37f8437f`;
