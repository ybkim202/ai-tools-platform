import React from 'react';

// Decorative icons for state views. aria-hidden — text conveys meaning.

export const SearchEmptyIcon = ({ size = 48 }) => (
  <svg
    className="state-icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const ComingSoonIcon = ({ size = 48 }) => (
  <svg
    className="state-icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ErrorIcon = ({ size = 48 }) => (
  <svg
    className="error-icon"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 8v4m0 4v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
