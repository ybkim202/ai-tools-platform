import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/toolStore';
import Compare from '../pages/Compare';
import '../styles/CompareModal.css';

// 비교 모달(IA 재설계 §9) — /compare 페이지 이동 대신 그 자리 오버레이.
// 접근성: role=dialog·aria-modal, ESC 닫기, Tab 포커스 트랩, 바디 스크롤 잠금,
// 닫을 때 호출부로 포커스 복원, 배경 클릭 닫기. 본문은 <Compare embedded/> 재사용.
const CompareModal = () => {
  const isOpen = useUIStore((s) => s.isCompareOpen);
  const closeCompare = useUIStore((s) => s.closeCompare);
  const clearCompareList = useUIStore((s) => s.clearCompareList);
  const count = useUIStore((s) => s.selectedToolsForCompare.length);

  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocused.current = document.activeElement;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    // 초기 포커스: 다이얼로그 내부 첫 포커서블.
    const raf = requestAnimationFrame(() => {
      const el = dialogRef.current?.querySelector(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])'
      );
      (el || dialogRef.current)?.focus();
    });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCompare();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])'
      );
      const list = nodes
        ? Array.from(nodes).filter((el) => !el.disabled && el.offsetParent !== null)
        : [];
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      body.style.overflow = prevOverflow;
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [isOpen, closeCompare]);

  if (!isOpen) return null;

  return (
    <div className="compare-modal-overlay" onClick={closeCompare}>
      <div
        className="compare-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="compare-modal-header">
          <h2 id="compare-modal-title" className="compare-modal-title">
            AI 도구 비교
            {count > 0 && (
              <span className="compare-modal-count" aria-live="polite">
                {count} / 5
              </span>
            )}
          </h2>
          <div className="compare-modal-header-actions">
            {count > 0 && (
              <button
                type="button"
                className="ghost-button"
                onClick={clearCompareList}
              >
                초기화
              </button>
            )}
            <button
              type="button"
              className="compare-modal-close"
              aria-label="비교 닫기"
              onClick={closeCompare}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>
        <div className="compare-modal-body">
          <Compare embedded />
        </div>
      </div>
    </div>
  );
};

export default CompareModal;
