import { useEffect, useRef } from 'react';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  requestAccess?: 'write';
  usePic?: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      Login: {
        auth: (options: { bot_id: string; request_access: boolean }, callback: (data: TelegramUser | false) => void) => void;
      };
    };
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export const TelegramLoginButton = ({
  botName,
  onAuth,
  buttonSize = 'large',
  cornerRadius,
  requestAccess = 'write',
  usePic = true,
}: TelegramLoginButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous script if any (though React usually handles this by unmounting, 
    // simpler to just clear the container)
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    if (cornerRadius !== undefined) {
      script.setAttribute('data-radius', cornerRadius.toString());
    }
    script.setAttribute('data-request-access', requestAccess);
    script.setAttribute('data-userpic', usePic.toString());
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');

    // Define global callback
    window.onTelegramAuth = (user: TelegramUser) => {
      onAuth(user);
    };

    containerRef.current.appendChild(script);

    return () => {
      // Cleanup
      // We don't remove the global callback immediately to prevent race conditions if unmount happens mid-auth
      // but strictly speaking we should. 
      delete window.onTelegramAuth;
    };
  }, [botName, buttonSize, cornerRadius, requestAccess, usePic, onAuth]);

  return <div ref={containerRef} className="telegram-login-widget" />;
};
