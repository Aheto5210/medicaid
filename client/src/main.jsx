import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { THEME_MODE, applyTheme } from './utils/theme.js';
import './styles.css';

applyTheme(THEME_MODE.SYSTEM);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
