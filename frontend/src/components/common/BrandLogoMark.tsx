import React from 'react';

interface BrandLogoMarkProps {
  className?: string;
}

/** Displays the symbol portion of the MedRescue System brand artwork. */
export const BrandLogoMark: React.FC<BrandLogoMarkProps> = ({ className = '' }) => (
  <span
    aria-hidden="true"
    className={`relative inline-flex shrink-0 overflow-hidden bg-white ${className}`}
  >
    <img
      src="/medrescue-system-logo.png"
      alt=""
      className="absolute left-1/2 top-0 h-auto max-w-none -translate-x-1/2"
      style={{ width: '154%' }}
      draggable={false}
    />
  </span>
);

export default BrandLogoMark;
