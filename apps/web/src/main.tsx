import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import '@soziolog/ui/schriften';
import App from './App';
import './index.css';

const sentryDsn = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
