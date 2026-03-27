import React from 'react';

export default function BrandLogo({ theme = 'light', className = 'brand-logo', alt = 'MEDICAID logo' }) {
  const version = '20260325';
  const src = theme === 'dark'
    ? `/assets/images/MEDICAID-WHITE.png?v=${version}`
    : `/assets/images/MEDICAID-BLACK.png?v=${version}`;
  return <img className={className} src={src} alt={alt} />;
}
