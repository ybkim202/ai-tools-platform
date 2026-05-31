import React from 'react';

// 외부/새 창 링크 표식 아이콘(장식). 의미는 동반 텍스트/sr-only가 전달한다.
// 색은 .external-icon(App.css)에서 non-text contrast 3:1 충족(secondary)으로 통일.
// 회귀 최소화를 위해 Footer의 검증된 SVG 마크업을 그대로 일반화한 것.
const ExternalLinkIcon = () => (
  <svg
    className="external-icon"
    aria-hidden="true"
    focusable="false"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export default ExternalLinkIcon;
