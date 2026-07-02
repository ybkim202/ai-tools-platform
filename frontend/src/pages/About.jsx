import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent, toolsAPI } from '../services/api';
import AboutCompareVisual from '../components/AboutCompareVisual';
import '../styles/About.css';

// 전환 추적: 모든 About CTA 클릭은 단일 name 사용. target으로 위치를 구분한다.
const TRACK_NAME = 'about_cta_click';

// 접근성: 모션 민감 사용자 여부(스크롤 진입·카운트업 즉시 완료용).
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 페르소나(자기식별) 카드. UX_REVIEW §1 P1~P4를 방문자 관점으로 옮김.
//    "당신이 어느 쪽이든" → 자기 상황을 발견하게 해 이탈 대신 몰입시킨다.
const PERSONAS = [
  {
    id: 'p1',
    label: '이제 막 시작한다면',
    desc: 'AI 도구가 너무 많아 뭐부터 써야 할지 막막한 실무자',
    to: '/#recommend',
    cta: '맞춤 추천',
    target: 'persona_p1',
  },
  {
    id: 'p2',
    label: '후보를 좁혔다면',
    desc: '두세 개를 두고 가격·성능·난이도로 근거 있게 고르려는 사람',
    to: '/explore',
    cta: '도구 탐색',
    target: 'persona_p2',
  },
  {
    id: 'p3',
    label: '흐름을 놓치기 싫다면',
    desc: '지금 뜨는 도구와 AI 소식을 빠르게 훑는 얼리어답터',
    to: '/news',
    cta: 'AI 뉴스',
    target: 'persona_p3',
  },
  {
    id: 'p4',
    label: '나만 뒤처질까 불안하다면',
    desc: '전문가는 아니지만 지금 뭐가 핫한지 가볍게 확인하고 싶은 분',
    to: '/trends/github',
    cta: '깃헙 트렌드',
    target: 'persona_p4',
  },
];

// 정적 스토리 콘텐츠(데이터 호출 없음). Pain→답 서사를 위→아래로 보존.
// 링크는 최신 IA 기준: 추천=/#recommend, 탐색·비교=/explore, 벤치마크/트렌드/뉴스=각 페이지.
const STORIES = [
  {
    id: 'story-1',
    eyebrow: '문제 01',
    title: '정보 과잉, 뭘 써야 할지 모르겠다면',
    pain: '매주 새로운 AI 도구가 쏟아집니다. 비슷한 이름과 과장된 소개 사이에서 내 작업에 맞는 도구를 고르기는 점점 어려워집니다.',
    answer:
      '몇 가지 질문에 답하면 목적과 예산, 난이도에 맞는 도구를 골라 추천합니다. 처음부터 다 둘러볼 필요가 없습니다.',
    links: [{ to: '/#recommend', label: '맞춤 추천 받기', target: 'story_recommend' }],
  },
  {
    id: 'story-2',
    eyebrow: '문제 02',
    title: '비슷해 보이는 도구, 무엇이 다른지 궁금하다면',
    pain: '두세 개로 후보를 좁혀도 가격, 기능, 성능을 일일이 탭을 오가며 대조하는 일은 번거롭고 빠뜨리기 쉽습니다.',
    answer:
      '여러 도구를 화면 이탈 없이 나란히 비교하고, 객관적인 벤치마크 점수로 성능 차이를 확인할 수 있습니다.',
    links: [
      { to: '/explore', label: '도구 골라 비교하기', target: 'story_compare' },
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
    links: [{ to: '/explore', label: '전체 도구 탐색', target: 'story_explore' }],
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

// 스크롤 진입 시 .is-visible 부여(1회). reduced-motion이면 처음부터 노출.
// 관찰자 미지원 환경도 안전하게 노출(graceful).
function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

// 카운트업 — 뷰 진입 시 0→목표 애니메이트. 데이터 없으면 null(단어 폴백),
// 데이터 있으나 아직 뷰 밖이면 실수치를 정적 노출(폴백 단어 오노출 방지).
// reduced-motion·미지원이면 즉시 최종값.
function useCountUp(target, active) {
  const [value, setValue] = useState(null);
  const started = useRef(false);
  useEffect(() => {
    if (target == null) {
      setValue(null);
      return;
    }
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      setValue(target);
      return;
    }
    // 아직 뷰 밖 — 실수치를 정적 노출(진입 시 0부터 애니메이트).
    if (!active) {
      setValue(target);
      return;
    }
    if (started.current) return;
    started.current = true;
    setValue(0);
    const DURATION = 900;
    let startTs = null;
    let raf = 0;
    const tick = (ts) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / DURATION);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return value;
}

const About = () => {
  // Hero 메타 스트립 실데이터 카운트. 실패/로딩 시 null 유지 → 기능명만 폴백.
  const [meta, setMeta] = useState({ totalTools: null, totalCategories: null });
  // sticky CTA 는 Hero를 지나친 뒤에만 노출(초기 시야 방해 방지).
  const [showSticky, setShowSticky] = useState(false);
  // Hero 우측 비교뷰 데이터 유무 — 없으면 1단(카피 중앙) graceful 복귀.
  const [heroHasVisual, setHeroHasVisual] = useState(true);
  const heroRef = useRef(null);
  const [statsRef, statsInView] = useInView();

  const handleHeroResolved = useCallback((hasData) => {
    setHeroHasVisual(hasData);
  }, []);

  const toolsCount = useCountUp(meta.totalTools, statsInView);
  const catCount = useCountUp(meta.totalCategories, statsInView);

  useEffect(() => {
    let active = true;
    toolsAPI
      .getMeta()
      .then((res) => {
        if (!active) return;
        const data = res?.data?.data || {};
        const tools = Number(data.total_tools);
        const categories = Number(data.total_categories);
        setMeta({
          totalTools: Number.isFinite(tools) && tools > 0 ? tools : null,
          totalCategories:
            Number.isFinite(categories) && categories > 0 ? categories : null,
        });
      })
      .catch(() => {
        // graceful 폴백 — 수치 없이 기능명만 노출. 콘솔 노이즈 금지.
      });
    return () => {
      active = false;
    };
  }, []);

  // Hero가 뷰포트를 벗어나면 sticky CTA 노출.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const track = (target) =>
    trackEvent(TRACK_NAME, { target, path: window.location.pathname });

  return (
    <div className="about-page">
      {/* HERO: 호명 + 한 줄 정의 + CTA 1개 / 우측 실데이터 "나란히 비교" 뷰. */}
      <section className="about-hero" ref={heroRef}>
        <div className="hero-gradient" />
        <div className="container">
          <div
            className={`about-hero-grid${
              heroHasVisual ? '' : ' about-hero-grid--solo'
            }`}
          >
            <div className="hero-content about-hero-copy">
              <span className="hero-badge">AI 도구 비교 플랫폼</span>
              <h1 className="hero-title">
                AI는 빠르게 바뀌는데,
                <br />뭘 써야 할지 모르겠다면
              </h1>
              <p className="hero-subtitle">
                Grepity는 흩어진 AI 도구를 한곳에서 탐색·비교하고, 당신의 작업에
                맞는 도구를 추천하는 플랫폼입니다.
              </p>
              {/* 메타 스트립 — 실데이터 카운트(있을 때) + 정적 기능 앵커 라벨. */}
              <ul className="about-hero-meta" aria-label="플랫폼 규모와 제공 기능">
                {meta.totalTools !== null && (
                  <li
                    className="about-hero-meta-item"
                    aria-label={`${meta.totalTools}개 이상 AI 도구`}
                  >
                    <span aria-hidden="true">{meta.totalTools}개+ AI 도구</span>
                  </li>
                )}
                {meta.totalCategories !== null && (
                  <li
                    className="about-hero-meta-item"
                    aria-label={`${meta.totalCategories}개 카테고리`}
                  >
                    <span aria-hidden="true">{meta.totalCategories} 카테고리</span>
                  </li>
                )}
                <li className="about-hero-meta-item">가입 불필요</li>
                <li className="about-hero-meta-item">광고 랭킹 아님</li>
              </ul>
              {/* Hero 1차 CTA(리서치: 히어로엔 CTA 1개). 맞춤 추천으로 직행. */}
              <div className="about-hero-cta">
                <Link
                  to="/#recommend"
                  className="cta-button"
                  data-track-name={TRACK_NAME}
                  data-track-target="hero_recommend"
                  onClick={() => track('hero_recommend')}
                >
                  30초, 맞춤 추천 받기
                  <ArrowIcon />
                </Link>
              </div>
            </div>

            {/* 우측 "나란히 비교" 미니 뷰 — 실데이터(주장을 확인시키는 비주얼).
                데이터 없으면 onResolved(false)→1단 복귀. */}
            <div className="about-hero-visual">
              <AboutCompareVisual onResolved={handleHeroResolved} />
            </div>
          </div>
        </div>
      </section>

      {/* PERSONAS: 자기식별 4카드 — "당신이 어느 쪽이든" 몰입 유도. */}
      <section className="about-personas" aria-labelledby="about-personas-title">
        <div className="container">
          <p className="about-section-eyebrow">누구를 위한 서비스인가</p>
          <h2 id="about-personas-title" className="about-section-title">
            당신이 어느 쪽이든, 시작점이 있습니다
          </h2>
          <div className="about-persona-grid">
            {PERSONAS.map((p) => (
              <Link
                key={p.id}
                to={p.to}
                className="about-persona-card glass-soft"
                data-track-name={TRACK_NAME}
                data-track-target={p.target}
                onClick={() => track(p.target)}
              >
                <span className="about-persona-label">{p.label}</span>
                <span className="about-persona-desc">{p.desc}</span>
                <span className="about-persona-cta">
                  {p.cta}
                  <ArrowIcon />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* STORY: Pain→답 4블록 수직 타임라인 — 스크롤 진입 애니메이션. */}
      <section className="about-stories" aria-label="우리가 푸는 문제">
        <div className="container">
          <div className="about-timeline">
            {STORIES.map((story) => (
              <StoryNode key={story.id} story={story} onTrack={track} />
            ))}
          </div>
        </div>
      </section>

      {/* TRUST: 중립성 선언 + 라이브 증거. 소셜 프루프/불신 해소. */}
      <section className="about-trust" aria-labelledby="about-trust-title">
        <div className="container" ref={statsRef}>
          <p className="about-section-eyebrow">왜 믿을 수 있나</p>
          <h2 id="about-trust-title" className="about-section-title">
            광고가 아니라 데이터로 고릅니다
          </h2>
          <ul className="about-trust-grid">
            <li className="about-trust-item">
              <span className="about-trust-value">
                {toolsCount !== null ? `${toolsCount}개+` : '탐색'}
              </span>
              <span className="about-trust-label">실제 적재된 AI 도구</span>
            </li>
            <li className="about-trust-item">
              <span className="about-trust-value">
                {catCount !== null ? catCount : '카테고리'}
              </span>
              <span className="about-trust-label">분류 카테고리</span>
            </li>
            <li className="about-trust-item">
              <span className="about-trust-value">무인증</span>
              <span className="about-trust-label">가입·결제 없이 즉시 이용</span>
            </li>
            <li className="about-trust-item">
              <span className="about-trust-value">중립</span>
              <span className="about-trust-label">
                제휴·광고 랭킹 아님 — 사용자수·벤치마크 기준
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* CLOSING: 1차(추천, 솔리드) + 2차(탐색, 고스트) 위계. */}
      <section className="footer-cta">
        <div className="container">
          <h2>지금 바로 시작하세요</h2>
          <p>
            가입 없이 30초면 됩니다. 맞춤 추천을 받거나, 전체 도구를 둘러보세요.
          </p>
          <div className="cta-buttons">
            <Link
              to="/#recommend"
              className="cta-button"
              data-track-name={TRACK_NAME}
              data-track-target="closing_recommend"
              onClick={() => track('closing_recommend')}
            >
              맞춤 추천 받기
              <ArrowIcon />
            </Link>
            <Link
              to="/explore"
              className="cta-button cta-button-secondary"
              data-track-name={TRACK_NAME}
              data-track-target="closing_explore"
              onClick={() => track('closing_explore')}
            >
              전체 도구 탐색
            </Link>
          </div>
        </div>
      </section>

      {/* STICKY: Hero 이탈 후 상시 노출되는 1차 CTA(모바일 thumb-zone). */}
      <div
        className={`about-sticky-cta${showSticky ? ' is-visible' : ''}`}
        aria-hidden={!showSticky}
      >
        <div className="about-sticky-inner">
          <span className="about-sticky-text">
            내 작업에 맞는 AI 도구, 30초면 찾습니다
          </span>
          <Link
            to="/#recommend"
            className="cta-button about-sticky-btn"
            tabIndex={showSticky ? 0 : -1}
            data-track-name={TRACK_NAME}
            data-track-target="sticky_recommend"
            onClick={() => track('sticky_recommend')}
          >
            맞춤 추천 받기
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </div>
  );
};

// 타임라인 노드 — 스크롤 진입 시 is-visible.
function StoryNode({ story, onTrack }) {
  const [ref, inView] = useInView();
  return (
    <article
      ref={ref}
      className={`about-timeline-node${inView ? ' is-visible' : ''}`}
      aria-labelledby={`${story.id}-eyebrow ${story.id}`}
    >
      <span className="about-timeline-marker" aria-hidden="true" />
      <div className="about-timeline-content">
        <p id={`${story.id}-eyebrow`} className="about-story-eyebrow">
          {story.eyebrow}
        </p>
        <h2 id={story.id} className="about-story-title">
          {story.title}
        </h2>
        <p className="about-story-pain">{story.pain}</p>
        <div className="about-answer-panel">
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
                onClick={() => onTrack(link.target)}
              >
                {link.label}
                <ArrowIcon />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default About;
