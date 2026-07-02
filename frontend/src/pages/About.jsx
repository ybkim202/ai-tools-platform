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

// ── ③ 어떻게 돕나 — 제품 핵심 루프(탐색→비교→추천). 기능 중심(무엇을 한다).
//    desc는 meta를 받아 실데이터(도구 수)를 가볍게 주입할 수 있다(그래픽 부담 0).
const STEPS = [
  {
    n: '01',
    key: 'explore',
    title: '탐색',
    to: '/explore',
    cta: '탐색하기',
    target: 'how_explore',
    // 돋보기
    iconPath: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
    desc: (m) =>
      `${m.totalTools ? `${m.totalTools}개+ ` : ''}AI 도구를 카테고리·태그·검색으로 한눈에 훑습니다.`,
  },
  {
    n: '02',
    key: 'compare',
    title: '비교',
    to: '/explore',
    cta: '비교하기',
    target: 'how_compare',
    // 막대(값 비교)
    iconPath: 'M6 20v-6 M12 20V4 M18 20V10 M3 20h18',
    desc: () => '후보를 나란히 놓고 가격·난이도·벤치마크 점수로 한 번에 대조합니다.',
  },
  {
    n: '03',
    key: 'recommend',
    title: '추천',
    to: '/#recommend',
    cta: '추천받기',
    target: 'how_recommend',
    // 스파클(맞춤)
    iconPath: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
    desc: () => '목적·예산·난이도 몇 가지만 답하면, 맞는 도구를 골라 추천합니다.',
  },
];

// ── ④ 누구에게 — 사람 중심 라우터(당신이라면 어디서 시작). ③과 달리 "식별→시작".
//    desc는 한 줄 자기식별(설명형 아님).
const PERSONAS = [
  {
    id: 'p1',
    label: '이제 막 시작한다면',
    desc: '뭐부터 써야 할지 막막한 분',
    to: '/#recommend',
    cta: '맞춤 추천',
    target: 'persona_p1',
  },
  {
    id: 'p2',
    label: '후보를 좁혔다면',
    desc: '근거로 골라야 하는 분',
    to: '/explore',
    cta: '도구 탐색',
    target: 'persona_p2',
  },
  {
    id: 'p3',
    label: '흐름을 놓치기 싫다면',
    desc: '최신 도구·소식을 훑는 분',
    to: '/news',
    cta: 'AI 뉴스',
    target: 'persona_p3',
  },
  {
    id: 'p4',
    label: '나만 뒤처질까 불안하다면',
    desc: '지금 뭐가 핫한지 궁금한 분',
    to: '/trends/github',
    cta: '깃헙 트렌드',
    target: 'persona_p4',
  },
];

// ② 문제 섹션 pain 키워드 칩(장식성 요약).
const PAIN_CHIPS = ['정보 과잉', '객관 비교 부재', '최신성 불안'];

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

// 스텝 아이콘 — 무채색(currentColor) 라인, 잉크 톤 일치.
const StepIcon = ({ d }) => (
  <svg
    className="about-how-icon"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
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
      {/* ① HERO: 호명 + 한 줄 정의 + CTA 1개 / 우측 실데이터 "나란히 비교" 뷰. */}
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
              {/* 메타 스트립 — 실데이터 카운트(있을 때) + 신뢰 신호. */}
              <ul className="about-hero-meta" aria-label="플랫폼 규모와 신뢰 신호">
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

      {/* ② 문제 한 컷: 공감 앵커(문제만, 링크 없음). */}
      <section className="about-problem" aria-labelledby="about-problem-title">
        <div className="container">
          <div className="about-problem-inner">
            <p className="about-section-eyebrow">왜 필요한가</p>
            <h2 id="about-problem-title" className="about-problem-title">
              쏟아지는 AI 도구, 정작 ‘내게 맞는 것’은
              <br />고르기 어렵습니다
            </h2>
            <p className="about-problem-sub">
              비슷한 이름, 과장된 소개, 사이트마다 흩어진 정보 — 매주 수십 개씩
              새로 나옵니다.
            </p>
            <ul className="about-problem-chips" aria-label="주요 어려움">
              {PAIN_CHIPS.map((c) => (
                <li key={c} className="about-problem-chip glass-soft">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ③ 어떻게 돕나: 제품 핵심 루프 3스텝(기능 중심). 스크롤 순차 등장. */}
      <section className="about-how" aria-labelledby="about-how-title">
        <div className="container">
          <p className="about-section-eyebrow">어떻게 돕나</p>
          <h2 id="about-how-title" className="about-section-title">
            탐색하고, 비교하고, 추천받고
          </h2>
          <ol className="about-how-grid">
            {STEPS.map((step) => (
              <StepCard key={step.key} step={step} meta={meta} onTrack={track} />
            ))}
          </ol>
        </div>
      </section>

      {/* ④ 누구에게: 사람 중심 라우터(자기식별→시작점). */}
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

      {/* ⑤ 왜 믿나: 중립성 선언 + 라이브 증거. 소셜 프루프/불신 해소. */}
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

      {/* ⑥ CLOSING: 1차(추천, 솔리드) + 2차(탐색, 고스트) 위계. */}
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

// ③ 스텝 카드 — 스크롤 진입 시 is-visible(reduced-motion 시 즉시).
function StepCard({ step, meta, onTrack }) {
  const [ref, inView] = useInView();
  return (
    <li
      ref={ref}
      className={`about-how-step glass-soft${inView ? ' is-visible' : ''}`}
    >
      <span className="about-how-num">{step.n}</span>
      <StepIcon d={step.iconPath} />
      <h3 className="about-how-title">{step.title}</h3>
      <p className="about-how-desc">{step.desc(meta)}</p>
      <Link
        to={step.to}
        className="about-how-link"
        data-track-name={TRACK_NAME}
        data-track-target={step.target}
        onClick={() => onTrack(step.target)}
      >
        {step.cta}
        <ArrowIcon />
      </Link>
    </li>
  );
}

export default About;
