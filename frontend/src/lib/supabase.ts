import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

// Development mode - bypass auth when Supabase is not configured
export const isDevMode = process.env.NODE_ENV === 'development' && !isSupabaseConfigured

// Mock session for development without Supabase
// Uses UUID that matches seeded admin user in database
export const devMockSession: Session = {
  access_token: 'dev-mock-token',
  refresh_token: 'dev-mock-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: {
    id: '11111111-1111-1111-1111-111111111111', // Matches seeded admin user
    email: 'admin@buhbot.local',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: { role: 'admin', fullName: 'Администратор' },
    created_at: new Date().toISOString(),
  } as User,
}

// In development without Supabase, log a warning
if (isDevMode) {
  console.warn(
    '[Supabase] Running in DEV MODE without Supabase Auth.\n' +
    'Authentication is bypassed. To enable auth, add NEXT_PUBLIC_SUPABASE_ANON_KEY to frontend/.env'
  )
}

// In production, require Supabase
if (!isSupabaseConfigured && process.env.NODE_ENV === 'production') {
  throw new Error('Missing Supabase environment variables')
}

// Create real client only if configured
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null
