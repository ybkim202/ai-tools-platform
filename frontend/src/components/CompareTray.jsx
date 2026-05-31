import React from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../stores/toolStore';

/**
 * CompareTray (F4) — 비교 선택 트레이.
 * store(useUIStore)를 자립 구독한다(props 없음). 선택 도구가 0개면 렌더하지 않는다.
 * Home·Recommendations 두 곳에 마운트해 "담기 → 비교하기" 동선을 일관되게 노출.
 * 시각/위치는 기존 .compare-tray 규칙(styles/Home.css)을 그대로 재사용.
 */
const CompareTray = () => {
  const selectedToolsForCompare = useUIStore(
    (state) => state.selectedToolsForCompare
  );
  const clearCompareList = useUIStore((state) => state.clearCompareList);
  const compareCount = selectedToolsForCompare.length;

  if (compareCount === 0) {
    return null;
  }

  return (
    <div className="compare-tray">
      <div className="compare-tray-left">
        <span className="counter-pill" aria-live="polite">
          비교함 {compareCount} / 5
        </span>
      </div>
      <div className="compare-tray-actions">
        <Link to="/compare" className="btn btn-primary">
          비교하기 →
        </Link>
        <button type="button" className="ghost-button" onClick={clearCompareList}>
          비우기
        </button>
      </div>
    </div>
  );
};

export default CompareTray;
