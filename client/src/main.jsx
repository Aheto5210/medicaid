import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyTheme, getStoredThemeMode } from './utils/theme.js';
import './styles.css';

applyTheme(getStoredThemeMode());

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
