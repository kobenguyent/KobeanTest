import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@kobean/ui';
import { App } from './App.tsx';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ThemeProvider defaultTheme="obsidian">
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
}
