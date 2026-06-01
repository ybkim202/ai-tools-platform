import React from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../services/api';
import '../styles/About.css';

// 전환 추적: 모든 About CTA 클릭은 단일 name 사용. target으로 위치를 구분한다.
const TRACK_NAME = 'about_cta_click';

// 정적 스토리 콘텐츠(데이터 호출 없음). Pain→답 서사를 위→아래로 보존.
// 각 블록은 eyebrow(번호) + 제목(Pain) + Pain 본문 + 답 본문 + CTA 링크.
const STORIES = [
  {
    id: 'story-1',
    eyebrow: '문제 01',
    title: '정보 과잉, 뭘 써야 할지 모르겠다면',
    pain: '매주 새로운 AI 도구가 쏟아집니다. 비슷한 이름과 과장된 소개 사이에서 내 작업에 맞는 도구를 고르기는 점점 어려워집니다.',
    answer:
      '몇 가지 질문에 답하면 목적과 예산, 난이도에 맞는 도구를 골라 추천합니다. 처음부터 다 둘러볼 필요가 없습니다.',
    links: [
      { to: '/recommendations', label: '맞춤 추천 받기', target: 'story_recommend' },
    ],
  },
  {
    id: 'story-2',
    eyebrow: '문제 02',
    title: '비슷해 보이는 도구, 무엇이 다른지 궁금하다면',
    pain: '두세 개로 후보를 좁혀도 가격, 기능, 성능을 일일이 탭을 오가며 대조하는 일은 번거롭고 빠뜨리기 쉽습니다.',
    answer:
      '여러 도구를 나란히 놓고 한눈에 비교하고, 객관적인 벤치마크 점수로 성능 차이를 확인할 수 있습니다.',
    links: [
      { to: '/compare', label: '나란히 비교하기', target: 'story_compare' },
      { to: '/benchmarks', label: '벤치마크 보기', target: 'story_benchmark' },
    ],
  },
  {
    id: 'story-3',
    eyebrow: '문제 03',
    title: '흐름을 놓치고 있는 건 아닐까 불안하다면',
    pain: '도구 생태계는 빠르게 바뀝니다. 어제의 정답이 오늘은 아닐 수 있고, 무엇이 뜨고 있는지 따라가기 벅찹니다.',
    answer:
      '깃헙에서 떠오르는 프로젝트와 AI 분야 주요 뉴스를 모아 보여줍니다. 흐름을 한곳에서 확인하세요.',
    links: [
      { to: '/trends/github', label: '깃헙 트렌드', target: 'story_github' },
      { to: '/news', label: 'AI 뉴스', target: 'story_news' },
    ],
  },
  {
    id: 'story-4',
    eyebrow: '문제 04',
    title: '일단 둘러보며 감을 잡고 싶다면',
    pain: '추천도 비교도 좋지만, 먼저 어떤 도구들이 있는지 가볍게 훑어보고 싶을 때가 있습니다.',
    answer:
      '카테고리와 태그로 전체 도구를 탐색하고 검색할 수 있습니다. 마음 가는 대로 둘러보세요.',
    links: [{ to: '/', label: '지금 둘러보기', target: 'story_explore' }],
  },
];

// 우향 화살표(장식) — 링크 텍스트가 의미를 전달하므로 aria-hidden.
const ArrowIcon = () => (
  <svg
    className="about-story-arrow"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

const About = () => {
  return (
    <div className="about-page">
      {/* HERO: 호명 + 한 줄 정의. CTA 없음(1차 액션은 클로징에 집중). */}
      <section className="about-hero">
        <div className="hero-gradient" />
        <div className="container">
          <div className="hero-content">
            <span className="hero-badge">AI 도구 비교 플랫폼</span>
            <h1 className="hero-title">
              AI는 빠르게 바뀌는데,
              <br />뭘 써야 할지 모르겠다면
            </h1>
            <p className="hero-subtitle">
              AITools는 흩어진 AI 도구를 한곳에서 탐색·비교하고, 당신의 작업에
              맞는 도구를 추천하는 플랫폼입니다.
            </p>
          </div>
        </div>
      </section>

      {/* STORY: Pain→답 4블록. 서사 순서 보존을 위해 1열 세로 스택. */}
      <section className="about-stories" aria-label="우리가 푸는 문제">
        <div className="container">
          {STORIES.map((story) => (
            <section
              key={story.id}
              className="about-story-card"
              aria-labelledby={story.id}
            >
              <p className="about-story-eyebrow">{story.eyebrow}</p>
              <h2 id={story.id} className="about-story-title">
                {story.title}
              </h2>
              <p className="about-story-pain">{story.pain}</p>
              <p className="about-story-answer-label">우리의 답</p>
              <p className="about-story-answer">{story.answer}</p>
              <div className="about-story-links">
                {story.links.map((link) => (
                  <Link
                    key={link.to + link.label}
                    to={link.to}
                    className="about-story-link"
                    data-track-name={TRACK_NAME}
                    data-track-target={link.target}
                    onClick={() =>
                      trackEvent(TRACK_NAME, {
                        target: link.target,
                        path: window.location.pathname,
                      })
                    }
                  >
                    {link.label}
                    <ArrowIcon />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {/* CLOSING: 페이지 유일의 1차 솔리드 액션 + 보조 액션. */}
      <section className="footer-cta">
        <div className="container">
          <h2>지금 바로 둘러보세요</h2>
          <p>
            가입 없이 바로 시작할 수 있습니다. 도구를 둘러보거나 맞춤 추천을
            받아보세요.
          </p>
          <div className="cta-buttons">
            <Link
              to="/"
              className="cta-button"
              data-track-name={TRACK_NAME}
              data-track-target="closing_explore"
              onClick={() =>
                trackEvent(TRACK_NAME, {
                  target: 'closing_explore',
                  path: window.location.pathname,
                })
              }
            >
              도구 둘러보기
              <ArrowIcon />
            </Link>
            <Link
              to="/recommendations"
              className="cta-button cta-button-secondary"
              data-track-name={TRACK_NAME}
              data-track-target="closing_recommend"
              onClick={() =>
                trackEvent(TRACK_NAME, {
                  target: 'closing_recommend',
                  path: window.location.pathname,
                })
              }
            >
              맞춤 추천 받기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
