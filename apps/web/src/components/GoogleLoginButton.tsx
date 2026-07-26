import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../authStore';
import { loginWithGoogle } from '../api';

/**
 * Google 登入按鈕。
 *
 * 用 Google Identity Services 的官方按鈕：ID token 由 Google 直接給我們，
 * 前端立刻換成後端自己的 session cookie，token 本身不留在任何地方。
 * 沒設 GOOGLE_CLIENT_ID 時顯示停用狀態，而不是一顆按了沒反應的按鈕。
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GSI 載入失敗')));
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI 載入失敗'));
    document.head.appendChild(script);
  });
}

export function GoogleLoginButton({ onDone }: { onDone?: () => void }) {
  const clientId = useAuth((s) => s.googleClientId);
  const setMe = useAuth((s) => s.setMe);
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!clientId || !holder.current) return;
    let cancelled = false;

    void loadGsi()
      .then(() => {
        if (cancelled || !holder.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            void loginWithGoogle(response.credential).then((me) => {
              if (me) {
                setMe(me);
                onDone?.();
              } else {
                setFailed(true);
              }
            });
          },
        });
        window.google.accounts.id.renderButton(holder.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'zh_TW',
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
  }, [clientId, setMe, onDone]);

  if (!clientId) {
    return (
      <div className="rounded-full border border-incense/15 px-4 py-2 text-xs text-incense/35">
        這台還沒設定 Google 登入
      </div>
    );
  }

  return (
    <div>
      <div ref={holder} />
      {failed && <p className="mt-2 text-xs text-[#d98a8a]">登入沒成功，再試一次。</p>}
    </div>
  );
}
