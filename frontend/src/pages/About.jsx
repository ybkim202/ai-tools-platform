import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent, toolsAPI } from '../services/api';
import AboutCompareVisual from '../components/AboutCompareVisual';
import TypingHeadline from '../components/TypingHeadline';
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
//    desc는 한 줄 자기식별(설명형 아님). iconPath = 상황 은유 라인 아이콘.
const PERSONAS = [
  {
    id: 'p1',
    label: '이제 막 시작한다면',
    desc: '뭐부터 써야 할지 막막한 분',
    to: '/#recommend',
    cta: '맞춤 추천',
    target: 'persona_p1',
    iconPath: 'M5 3v18 M5 4h11l-1.6 3.5L16 11H5', // 깃발(출발점)
  },
  {
    id: 'p2',
    label: '후보를 좁혔다면',
    desc: '근거로 골라야 하는 분',
    to: '/explore',
    cta: '도구 탐색',
    target: 'persona_p2',
    iconPath: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01', // 목록(후보)
  },
  {
    id: 'p3',
    label: '흐름을 놓치기 싫다면',
    desc: '최신 도구·소식을 훑는 분',
    to: '/news',
    cta: 'AI 뉴스',
    target: 'persona_p3',
    iconPath: 'M3 17l6-6 4 4 8-8 M17 7h4v4', // 상승 추세(흐름)
  },
  {
    id: 'p4',
    label: '나만 뒤처질까 불안하다면',
    desc: '지금 뭐가 핫한지 궁금한 분',
    to: '/trends/github',
    cta: '깃헙 트렌드',
    target: 'persona_p4',
    iconPath:
      'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 9a3 3 0 100 6 3 3 0 000-6z', // 눈(지켜봄)
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

// 라인 아이콘 — 무채색(currentColor), 잉크 톤 일치. 스텝·페르소나 공용.
const LineIcon = ({ d, size = 22, className }) => (
  <svg
    className={className}
    width={size}
    height={size}
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

// ③ 스텝별 실 미니 UI — 실제 제품 어휘로 "무엇을 한다"를 보여준다(장식 아닌 데모).
//    정적이되 실 카테고리·도구·직군 어휘라 목업 티가 나지 않는다(reduced-motion 안전).
function StepMini({ stepKey }) {
  if (stepKey === 'explore') {
    return (
      <div className="about-mini about-mini-explore" aria-hidden="true">
        <div className="about-mini-search">
          <LineIcon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35" size={13} />
          <span>이미지 생성</span>
        </div>
        <div className="about-mini-chips">
          {['개발도구', '생성형AI', '이미지생성', '생산성'].map((c, i) => (
            <span key={c} className={`about-mini-chip${i === 2 ? ' is-on' : ''}`}>
              {c}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (stepKey === 'compare') {
    const rows = [
      { n: 'ChatGPT', w: 92 },
      { n: 'Claude', w: 88 },
      { n: 'Gemini', w: 74 },
    ];
    return (
      <div className="about-mini about-mini-compare" aria-hidden="true">
        {rows.map((r) => (
          <div key={r.n} className="about-mini-row">
            <span className="about-mini-row-name">{r.n}</span>
            <span className="about-mini-bar">
              <span className="about-mini-bar-fill" style={{ width: `${r.w}%` }} />
            </span>
            <span className="about-mini-row-val">{r.w}</span>
          </div>
        ))}
      </div>
    );
  }
  // recommend
  return (
    <div className="about-mini about-mini-recommend" aria-hidden="true">
      <div className="about-mini-chips">
        {['마케터', '개발자', '디자이너', '기획자'].map((c, i) => (
          <span key={c} className={`about-mini-chip${i === 0 ? ' is-on' : ''}`}>
            {c}
          </span>
        ))}
      </div>
      <div className="about-mini-rec">
        <span className="about-mini-rec-dot" />
        <span className="about-mini-rec-line" />
      </div>
    </div>
  );
}

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
          <p className="about-section-eyebrow">
            <span className="about-eyebrow-en">How</span>
            <span className="about-eyebrow-ko">어떻게 돕나</span>
          </p>
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
          <p className="about-section-eyebrow">
            <span className="about-eyebrow-en">Who</span>
            <span className="about-eyebrow-ko">누구를 위한 서비스인가</span>
          </p>
          <h2 id="about-personas-title" className="about-section-title">
            당신이 어느 쪽이든, 시작점이 있습니다
          </h2>
          <div className="about-persona-grid">
            {PERSONAS.map((p, i) => (
              <PersonaCard key={p.id} p={p} index={i} onTrack={track} />
            ))}
          </div>
        </div>
      </section>

      {/* ⑤ 왜 믿나: 중립성 선언 + 라이브 증거. 소셜 프루프/불신 해소. */}
      <section className="about-trust" aria-labelledby="about-trust-title">
        <div className="container" ref={statsRef}>
          <p className="about-section-eyebrow">
            <span className="about-eyebrow-en">Why</span>
            <span className="about-eyebrow-ko">왜 믿을 수 있나</span>
          </p>
          {/* 스크롤 진입(statsInView) 시 타이핑. reduced-motion이면 즉시 완성. */}
          <TypingHeadline
            as="h2"
            id="about-trust-title"
            className="about-section-title about-trust-title"
            text="광고가 아니라 데이터로 고릅니다"
            start={statsInView}
          />
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

// ④ 페르소나 카드 — 스크롤 진입 시 is-visible(블러→선명, index로 stagger).
function PersonaCard({ p, index, onTrack }) {
  const [ref, inView] = useInView();
  return (
    <Link
      ref={ref}
      to={p.to}
      className={`about-persona-card glass-soft${inView ? ' is-visible' : ''}`}
      style={{ transitionDelay: `${index * 60}ms` }}
      data-track-name={TRACK_NAME}
      data-track-target={p.target}
      onClick={() => onTrack(p.target)}
    >
      <span className="about-persona-icon" aria-hidden="true">
        <LineIcon d={p.iconPath} size={18} />
      </span>
      <span className="about-persona-label">{p.label}</span>
      <span className="about-persona-desc">{p.desc}</span>
      <span className="about-persona-cta">
        {p.cta}
        <ArrowIcon />
      </span>
    </Link>
  );
}

// ③ 스텝 카드 — 스크롤 진입 시 is-visible(reduced-motion 시 즉시).
function StepCard({ step, meta, onTrack }) {
  const [ref, inView] = useInView();
  return (
    <li
      ref={ref}
      className={`about-how-step glass-soft${inView ? ' is-visible' : ''}`}
    >
      <div className="about-how-head">
        <span className="about-how-tile glass-soft">
          <LineIcon d={step.iconPath} size={22} className="about-how-icon" />
        </span>
        <span className="about-how-num">{step.n}</span>
      </div>
      <h3 className="about-how-title">{step.title}</h3>
      <p className="about-how-desc">{step.desc(meta)}</p>
      <StepMini stepKey={step.key} />
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
