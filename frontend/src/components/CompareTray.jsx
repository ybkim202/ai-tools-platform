import React from 'react';
import { useUIStore } from '../stores/toolStore';

/**
 * CompareTray (F4) — 비교 선택 트레이.
 * store(useUIStore)를 자립 구독한다(props 없음). 선택 도구가 0개면 렌더하지 않는다.
 * "비교하기"는 페이지 이동 대신 비교 모달을 그 자리에서 연다(IA 재설계 §9).
 * 시각/위치는 기존 .compare-tray 규칙(styles/Home.css)을 그대로 재사용.
 */
const CompareTray = () => {
  const selectedToolsForCompare = useUIStore(
    (state) => state.selectedToolsForCompare
  );
  const clearCompareList = useUIStore((state) => state.clearCompareList);
  const openCompare = useUIStore((state) => state.openCompare);
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
        <button type="button" className="btn btn-primary" onClick={openCompare}>
          비교하기 →
        </button>
        <button type="button" className="ghost-button" onClick={clearCompareList}>
          비우기
        </button>
      </div>
    </div>
  );
};

export default CompareTray;
