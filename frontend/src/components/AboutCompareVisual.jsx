import React, { useEffect, useState } from 'react';
import { formatPrice, formatUserCount } from '../utils/format';
import { difficultyLabel } from '../utils/difficulty';
import { resolveLogoSrc, handleLogoError } from '../utils/logoFallback';
import { toolsAPI, compareAPI } from '../services/api';
import '../styles/Skeleton.css';

// About Hero 우측 "나란히 비교" 미니 뷰 — 실데이터(2단 적재).
// ① 인기 리스트로 "비교가 가장 잘 갈리는" 카테고리 선택(난이도 다양성 최대).
// ② compare 엔드포인트로 그 3개의 실 가격·난이도·인기를 채워 나란히 비교.
// 홈 Hero(카테고리 인기 "랭킹")와 개념이 다른 "비교"라 정체성이 겹치지 않고,
// 리서치 원칙대로 "우리가 비교해준다"는 주장을 실데이터로 확인시킨다.
//
// onResolved(hasData): 적재 종료 시 데이터 유무를 상위에 통지(빈 경우 1단 복귀).

const TOOLS_PER = 3;

// 시작가(무료=0 포함, 최저) → 헤드라인. Compare.jsx 규칙과 동일.
const pricingStart = (tool) => {
  const plans = Array.isArray(tool?.pricing) ? tool.pricing : [];
  let cheapest = null;
  plans.forEach((p) => {
    const n = Number(p.price);
    if (!Number.isFinite(n) || n < 0) return;
    if (cheapest === null || n < cheapest.price) {
      cheapest = { price: n, billing_period: p.billing_period };
    }
  });
  if (cheapest === null) return null;
  return cheapest.price === 0
    ? '무료'
    : `${formatPrice(cheapest.price, { billingPeriod: cheapest.billing_period })}~`;
};

const ROWS = [
  { key: 'price', label: '가격', render: (t) => pricingStart(t) || '미상' },
  {
    key: 'difficulty',
    label: '난이도',
    render: (t) => (t.difficulty ? difficultyLabel(t.difficulty) : '-'),
  },
  { key: 'popularity', label: '인기', render: (t) => formatUserCount(t.user_count) || '-' },
];

// 비교가 가장 잘 갈리는 카테고리 선택 — 난이도 다양성 최대(동률 시 도구 수),
// 최소 TOOLS_PER개 보유. 리스트 응답엔 pricing이 없어 난이도 다양성을 프록시로 쓴다.
const pickCategory = (tools) => {
  const buckets = new Map();
  tools.forEach((t) => {
    if (!t.category) return;
    if (!buckets.has(t.category)) buckets.set(t.category, []);
    buckets.get(t.category).push(t);
  });
  const eligible = [...buckets.entries()].filter(([, l]) => l.length >= TOOLS_PER);
  if (!eligible.length) return null;
  eligible.sort((a, b) => {
    const va = new Set(a[1].slice(0, TOOLS_PER).map((t) => t.difficulty)).size;
    const vb = new Set(b[1].slice(0, TOOLS_PER).map((t) => t.difficulty)).size;
    if (vb !== va) return vb - va;
    return b[1].length - a[1].length;
  });
  const [category, list] = eligible[0];
  return { category, tools: list.slice(0, TOOLS_PER) };
};

const CompareSkeleton = () => (
  <div className="about-compare glass-soft" role="status" aria-label="비교 예시 불러오는 중">
    <span className="skeleton" style={{ width: '45%', height: 12 }} />
    <div className="about-compare-grid" style={{ '--cols': TOOLS_PER }}>
      <span />
      {Array.from({ length: TOOLS_PER }).map((_, i) => (
        <div key={i} className="about-compare-tool">
          <span className="skeleton" style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)' }} />
          <span className="skeleton" style={{ width: '70%', height: 10 }} />
        </div>
      ))}
      {ROWS.map((r) => (
        <React.Fragment key={r.key}>
          <span className="skeleton" style={{ width: 36, height: 10 }} />
          {Array.from({ length: TOOLS_PER }).map((_, i) => (
            <span key={i} className="skeleton" style={{ width: '60%', height: 10, margin: '0 auto' }} />
          ))}
        </React.Fragment>
      ))}
    </div>
    <span className="sr-only">불러오는 중…</span>
  </div>
);

const AboutCompareVisual = ({ onResolved }) => {
  const [state, setState] = useState({ loading: true, category: null, tools: [] });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // ① 카테고리 선택(인기 리스트).
        const listRes = await toolsAPI.getTools({ sort_by: 'popularity', limit: 100 });
        const picked = pickCategory(listRes.data?.data || []);
        if (!picked) {
          if (active) setState({ loading: false, category: null, tools: [] });
          return;
        }
        // ② 실 가격/난이도/인기 적재(compare).
        const ids = picked.tools.map((t) => t.id);
        const cmpRes = await compareAPI.compareTools(ids);
        const comparison = cmpRes.data?.data?.comparison || [];
        // compare 순서를 선택 순서(인기순)에 맞춰 정렬.
        const byId = new Map(comparison.map((t) => [t.id, t]));
        const merged = ids.map((id) => byId.get(id)).filter(Boolean);
        if (!active) return;
        setState({
          loading: false,
          category: picked.category,
          tools: merged.length >= 2 ? merged : [],
        });
      } catch {
        if (active) setState({ loading: false, category: null, tools: [] });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.loading) return;
    if (onResolved) onResolved(state.tools.length >= 2);
  }, [state, onResolved]);

  if (state.loading) return <CompareSkeleton />;
  if (state.tools.length < 2) return null;

  const { category, tools } = state;

  return (
    <div
      className="about-compare glass-soft"
      role="img"
      aria-label={`${category} 카테고리 인기 도구를 가격·난이도·인기로 나란히 비교한 예시`}
    >
      <span className="about-compare-eyebrow">{category} · 나란히 비교</span>
      <div className="about-compare-grid" style={{ '--cols': tools.length }}>
        {/* 헤더 행: 코너(빈칸) + 도구 로고/이름 */}
        <span aria-hidden="true" />
        {tools.map((t) => (
          <div key={t.id} className="about-compare-tool">
            <img
              src={resolveLogoSrc(t.logo_url, t.name, t.official_url)}
              alt=""
              className="about-compare-logo"
              data-official-url={t.official_url || ''}
              onError={handleLogoError}
              loading="lazy"
            />
            <span className="about-compare-name">{t.name}</span>
          </div>
        ))}
        {/* 데이터 행: 라벨 + 셀 */}
        {ROWS.map((row) => (
          <React.Fragment key={row.key}>
            <span className="about-compare-rowlabel">{row.label}</span>
            {tools.map((t) => (
              <span key={t.id} className="about-compare-cell">
                {row.render(t)}
              </span>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default AboutCompareVisual;
