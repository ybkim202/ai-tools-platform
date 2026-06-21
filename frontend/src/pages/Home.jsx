import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toolsAPI } from '../services/api';
import ToolBrowser from '../components/ToolBrowser';
import '../styles/Home.css';

// 랜딩(/). 히어로 + 용도 칩 + 전체 탐색(ToolBrowser 공유) + 푸터 CTA.
// 전체 도구 탐색 UI(검색·필터·정렬·그리드)는 ToolBrowser 로 분리해 Explore(/explore)와
// 공유한다. 히어로 배지 수치는 메타(total_tools)에서 직접 읽어 탐색 상태와 분리한다.
const Home = () => {
  const [totalTools, setTotalTools] = useState(0);
  // 용도(task) 칩: hero 아래 "용도로 바로 찾기" 빠른 진입. DB 메타(tags.type='task')로만
  // 채운다(하드코딩 금지 G5/G6). 비면 섹션 자체를 렌더하지 않는다(빈 약속 금지).
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    let active = true;
    toolsAPI
      .getMeta()
      .then((res) => {
        if (!active) return;
        const meta = res?.data?.data || {};
        if (Number.isFinite(Number(meta.total_tools))) {
          setTotalTools(Number(meta.total_tools));
        }
        if (Array.isArray(meta.tasks)) {
          setTasks(meta.tasks);
        }
      })
      .catch(() => {
        // 메타 실패: 배지는 폴백 카피, 칩은 미노출(과한 스켈레톤 회피).
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            {/* 실측 수치(사회적 증명). 적재 전(0)에는 수치 숨기고 검증 가능한 카피로 폴백. */}
            {totalTools > 0
              ? `AI 도구 ${totalTools}개 · 매주 갱신`
              : '매주 갱신되는 AI 도구 큐레이션'}
          </div>
          <h1 className="hero-title">
            모든 AI 도구를<br />한곳에서 발견하세요
          </h1>
          <p className="hero-subtitle">
            라이선스·난이도·인기로 한눈에 비교하고, 조건에 맞는 도구를 추천받으세요
          </p>
          <div className="hero-cta-group">
            <a href="#tools" className="cta-button">
              도구 탐색하기
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10 4v12m0 0l-4-4m4 4l4-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </a>
            <Link to="/trends/github" className="cta-button cta-button-secondary">
              지금 뜨는 AI 보기
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 17l6-6 4 4 7-7m0 0h-5m5 0v5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
        <div className="hero-gradient"></div>
      </section>

      {/* 용도로 바로 찾기 — task 우선 진입(hero 아래 칩 행, CTA와 비경쟁). */}
      {tasks.length > 0 && (
        <section className="task-quicknav" aria-label="용도로 바로 찾기">
          <div className="container task-quicknav-inner">
            <span className="task-quicknav-label">용도로 바로 찾기</span>
            <ul className="task-quicknav-list">
              {tasks.slice(0, 8).map((task) => (
                <li key={task}>
                  <Link
                    className="task-quicknav-chip"
                    to={`/recommendations?type=task&value=${encodeURIComponent(
                      task
                    )}`}
                  >
                    {task}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 전체 도구 탐색(검색·필터·정렬·그리드·비교 트레이) — Explore 와 공유. */}
      <ToolBrowser />

      {/* Footer CTA — 비교/추천 경로 유지. */}
      <section className="footer-cta">
        <div className="container">
          <h2>AI는 매주 바뀝니다. 계속 따라잡으세요</h2>
          <p>지금 뜨는 도구, 벤치마크, 맞춤 추천까지 한곳에서 확인하세요</p>
          <div className="cta-buttons">
            <Link to="/compare" className="btn btn-primary">
              도구 비교
            </Link>
            <Link to="/recommendations" className="btn btn-secondary">
              맞춤 추천
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
