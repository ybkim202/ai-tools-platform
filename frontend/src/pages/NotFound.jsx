import React from 'react';
import { EmptyNoDataState } from '../components/states/StateViews';

// 404 catch-all. 오타 URL/삭제된 경로 진입 시 빈 <main> 대신 복귀 동선 제공.
// 데이터 호출 없는 정적 페이지. 공용 상태뷰(EmptyNoDataState)를 재사용한다.
const NotFound = () => (
  <div className="notfound-page">
    <EmptyNoDataState
      badge="404"
      title="페이지를 찾을 수 없습니다"
      message="주소가 바뀌었거나 더 이상 존재하지 않는 페이지입니다."
      ctaLabel="홈으로 가기"
      ctaTo="/"
    />
  </div>
);

export default NotFound;
