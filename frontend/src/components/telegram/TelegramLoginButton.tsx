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
  // Store onAuth in a ref so we don't re-initialize the widget when the callback changes
  const onAuthRef = useRef(onAuth);

  // Update the ref when onAuth changes (but don't trigger widget re-render)
  useEffect(() => {
    onAuthRef.current = onAuth;
  }, [onAuth]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous script if any
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

    // Define global callback that uses the ref (always calls latest onAuth)
    window.onTelegramAuth = (user: TelegramUser) => {
      onAuthRef.current(user);
    };

    containerRef.current.appendChild(script);

    return () => {
      // Cleanup on unmount
      delete window.onTelegramAuth;
    };
  }, [botName, buttonSize, cornerRadius, requestAccess, usePic]); // Removed onAuth from deps

  return <div ref={containerRef} className="telegram-login-widget" />;
};
