import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@kobean/ui';
import { App } from './App.tsx';
import { MiniHud, type MiniHudItem } from './components/MiniHud.tsx';

function StandaloneHud() {
  const [items, setItems] = useState<MiniHudItem[]>([
    {
      id: 'hud-item-1',
      caseId: 'case-1',
      caseNumber: 1,
      title: 'Verify biometric OTP verification on high-risk login',
      projectKey: 'LOC',
      status: 'pending',
      steps: [
        { step_number: 1, action: 'Submit valid credentials from new IP', expected: 'Prompted for 2FA challenge' },
        { step_number: 2, action: 'Enter valid 6-digit TOTP token', expected: '200 OK session token issued' },
      ],
    },
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('kobean_hud_sync');
    channel.onmessage = (event) => {
      const data = event.data;
      if (data?.type === 'SYNC_ITEMS' && Array.isArray(data.items)) {
        setItems(data.items);
      }
    };
    channel.postMessage({ type: 'REQUEST_ITEMS' });
    return () => channel.close();
  }, []);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-transparent p-2">
      <MiniHud
        items={items}
        onRecordStatus={(itemId, status, note) => {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const channel = new BroadcastChannel('kobean_hud_sync');
            channel.postMessage({ type: 'STATUS_UPDATE', itemId, status, note });
            channel.close();
          }
        }}
      />
    </div>
  );
}

const isHudView = typeof window !== 'undefined' && window.location.search.includes('view=hud');

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ThemeProvider defaultTheme="warm_sand">
        {isHudView ? <StandaloneHud /> : <App />}
      </ThemeProvider>
    </React.StrictMode>
  );
}
