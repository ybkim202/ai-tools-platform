import React, { useEffect } from 'react';
import { useUIStore } from '../stores/toolStore';
import '../styles/CompareDock.css';

/**
 * CompareTray — 전역 비교 독(iOS 하단 도크식).
 * App 에 1회 전역 마운트한다. store(useUIStore)를 자립 구독해 선택 도구가 1개 이상이면
 * 어느 화면에서든 화면 하단에 플로팅 바로 슬라이드업한다. 0개면 렌더하지 않는다.
 * "비교하기"는 전역 비교 모달을 그 자리에서 연다(라우트 이동 없음).
 */
const CompareTray = () => {
  const selected = useUIStore((s) => s.selectedToolsForCompare);
  const namesById = useUIStore((s) => s.compareNamesById);
  const removeToolForCompare = useUIStore((s) => s.removeToolForCompare);
  const clearCompareList = useUIStore((s) => s.clearCompareList);
  const openCompare = useUIStore((s) => s.openCompare);
  const count = selected.length;

  // 독이 떠 있는 동안 본문 하단에 여백을 줘 마지막 콘텐츠가 가리지 않게 한다.
  useEffect(() => {
    const cls = 'has-compare-dock';
    document.body.classList.toggle(cls, count > 0);
    return () => document.body.classList.remove(cls);
  }, [count]);

  if (count === 0) return null;

  return (
    <div className="compare-dock" role="region" aria-label="비교할 도구">
      <span className="compare-dock-count" aria-live="polite">
        비교 <strong>{count}</strong>
        <span className="compare-dock-count-max">/5</span>
      </span>

      <ul className="compare-dock-chips">
        {selected.map((id) => {
          const name = namesById[id] || `#${id}`;
          return (
            <li key={id} className="compare-dock-chip">
              <span className="compare-dock-chip-name">{name}</span>
              <button
                type="button"
                className="compare-dock-chip-remove"
                aria-label={`${name} 비교에서 제거`}
                onClick={() => removeToolForCompare(id)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="compare-dock-actions">
        <button
          type="button"
          className="compare-dock-compare"
          onClick={openCompare}
        >
          비교하기
        </button>
        <button
          type="button"
          className="compare-dock-clear"
          onClick={clearCompareList}
        >
          비우기
        </button>
      </div>
    </div>
  );
};

export default CompareTray;
