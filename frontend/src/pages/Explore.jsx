import React from 'react';
import ToolBrowser from '../components/ToolBrowser';
import '../styles/Explore.css';

// 전체 도구 탐색 페이지(/explore). 검색·필터·정렬·그리드는 ToolBrowser 공유.
// 랜딩(/)은 큐레이션, 여기는 "모든 도구를 직접 뒤지는" 목적지(IA 재설계 §9).
const Explore = () => (
  <div className="explore-page">
    <div className="page-header">
      <p className="page-eyebrow">탐색</p>
      <h1 className="page-title">전체 AI 도구 탐색</h1>
      <p className="page-subtitle">
        검색·카테고리·난이도·라이선스로 원하는 AI 도구를 직접 찾아보세요.
      </p>
    </div>
    <ToolBrowser />
  </div>
);

export default Explore;
