import React from 'react';
import { buildPageItems } from '../utils/pagination';

// 페이지네이션(Home·News 공유). 마크업·클래스·동작은 기존 두 페이지와 동일.
// 순수 컴포넌트: 스크롤 등 부수효과는 호출부의 onPageChange 콜백이 담당한다.
// totalPages <= 1이면 렌더하지 않는다(기존 `{totalPages > 1 && ...}` 가드 흡수).
const Pagination = ({ currentPage, totalPages, onPageChange, ariaLabel }) => {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <button
        type="button"
        className="filter-btn"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        이전
      </button>
      {buildPageItems(currentPage, totalPages).map((page, idx) =>
        page === null ? (
          <span
            key={`ellipsis-${idx}`}
            className="pagination-ellipsis"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            className={`filter-btn ${currentPage === page ? 'active' : ''}`}
            aria-current={currentPage === page ? 'page' : undefined}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        )
      )}
      <button
        type="button"
        className="filter-btn"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        다음
      </button>
    </nav>
  );
};

export default Pagination;
