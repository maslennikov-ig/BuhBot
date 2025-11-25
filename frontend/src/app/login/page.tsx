'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        router.push('/dashboard');
      } else {
        // Redirect to Supabase Auth
        await supabase.auth.signInWithOAuth({
          provider: 'github', // or your configured provider
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });
      }
    };

    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--buh-background)] text-[var(--buh-foreground)]">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Вход в систему</h1>
        <div className="flex items-center justify-center gap-2 text-[var(--buh-foreground-muted)]">
          <Loader2 className="animate-spin" size={20} />
          <p>Перенаправление на страницу авторизации...</p>
        </div>
      </div>
    </div>
  );
}
