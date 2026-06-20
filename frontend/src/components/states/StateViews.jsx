import React from 'react';
import { Link } from 'react-router-dom';
import { SearchEmptyIcon, ComingSoonIcon, ErrorIcon } from './StateIcons';
import '../../styles/StateViews.css';

/**
 * Standardized data-page state views.
 * State vocabulary: Loading / EmptyFiltered / EmptyNoData / Error.
 * All visuals use Linear design tokens (see styles/StateViews.css).
 */

// Loading — spinner + contextual message.
export const LoadingState = ({ message = '불러오는 중...' }) => (
  <div className="state-container state-loading" role="status" aria-live="polite">
    <div className="spinner" aria-hidden="true"></div>
    <p className="state-message">{message}</p>
  </div>
);

// EmptyFiltered — user applied non-default filters, 0 results.
export const EmptyFilteredState = ({
  title = '조건에 맞는 결과가 없습니다',
  message = '필터나 검색어를 바꿔보세요',
  onReset,
  resetLabel = '필터 초기화',
}) => (
  <div className="state-container empty-filtered" role="status">
    <SearchEmptyIcon />
    <p className="state-title">{title}</p>
    <p className="state-message">{message}</p>
    {onReset && (
      <button type="button" className="state-cta-secondary" onClick={onReset}>
        {resetLabel}
      </button>
    )}
  </div>
);

// EmptyNoData — feature data not yet loaded ("coming soon"). Neutral, never error red.
export const EmptyNoDataState = ({
  title = '이 기능은 데이터 준비 중입니다',
  message,
  badge = '준비 중 · Coming soon',
  ctaLabel,
  ctaTo,
  ctaHref,
  onCta,
  inline = false,
  icon,
}) => (
  <div
    className={`state-container empty-nodata${inline ? ' empty-nodata--inline' : ''}`}
    role="status"
  >
    {icon || <ComingSoonIcon size={inline ? 32 : 48} />}
    {badge && <span className="coming-soon-badge">{badge}</span>}
    <p className="state-title">{title}</p>
    {message && <p className="state-message">{message}</p>}
    {/* 내부 경로는 SPA 라우팅 유지를 위해 Link 사용(전체 리로드 방지). */}
    {ctaLabel && ctaTo && (
      <Link className="state-cta-primary" to={ctaTo}>
        {ctaLabel}
      </Link>
    )}
    {ctaLabel && !ctaTo && ctaHref && (
      <a className="state-cta-primary" href={ctaHref}>
        {ctaLabel}
      </a>
    )}
    {ctaLabel && !ctaTo && !ctaHref && onCta && (
      <button type="button" className="state-cta-primary" onClick={onCta}>
        {ctaLabel}
      </button>
    )}
  </div>
);

// Error — request failed (network / 5xx / 4xx).
export const ErrorState = ({
  title = '서버에 연결할 수 없습니다',
  message,
  errorId,
  onRetry,
  retryLabel = '다시 시도',
}) => (
  <div className="state-container state-error" role="alert" aria-live="assertive">
    <div className="error-box">
      <ErrorIcon />
      <p className="error-title">{title}</p>
      {message && <p className="error-message">{message}</p>}
      {onRetry && (
        <button type="button" className="state-cta-error" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
      {/* 서버측 오류(5xx)에만 실리는 상관관계 ID. 신고 시 이 코드로 로그를 추적한다.
          선택 메타라 작게/약하게 — 4xx 등 id가 없으면 렌더하지 않는다. */}
      {errorId && <p className="error-id">오류 코드: {errorId}</p>}
    </div>
  </div>
);
