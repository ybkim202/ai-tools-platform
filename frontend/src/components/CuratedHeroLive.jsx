import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toolsAPI, benchmarksAPI } from '../services/api';
import CuratedHeroWidget from './CuratedHeroWidget';
import { CuratedHeroSkeleton } from './Skeletons';

// 자체 완결형 큐레이션 위젯 — Home의 Hero 로직(데이터 적재·섹션 구성·자동 회전)을
// 캡슐화해 어디서든 <CuratedHeroLive/> 한 줄로 "진짜 제품"을 임베드한다.
// About Hero 우측에서 사용(데이터 의존이 있으나 실 로고·실 순위를 보여줘 신뢰↑).
//
// onResolved(hasData): 적재 종료 시 1회 호출 — 데이터 유무를 상위에 통지해
//   빈 경우(0행/실패) 상위가 레이아웃을 graceful히 조정(예: 1단 복귀)하게 한다.

const FEATURED_CATEGORIES = 7; // Home과 동일 — 노출 카테고리 수.
const TOP_PER_CATEGORY = 5;
const ROTATE_MS = 4500;
const EXCLUDED_CATEGORIES = new Set(['특수목적', '콘텐츠생성', '데이터분석']);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CuratedHeroLive = ({ onResolved }) => {
  const [sections, setSections] = useState([]);
  const [benchmarkIds, setBenchmarkIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [paused, setPaused] = useState(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [toolsRes, benchRes] = await Promise.all([
          toolsAPI.getTools({ sort_by: 'popularity', limit: 100 }),
          benchmarksAPI.getBenchmarks({ limit: 100 }).catch(() => null),
        ]);
        if (!active) return;
        const tools = toolsRes.data?.data || [];
        const benchRows = benchRes?.data?.data || [];
        setBenchmarkIds(new Set(benchRows.map((r) => r.tool_id)));

        const buckets = new Map();
        tools.forEach((t) => {
          if (!t.category || EXCLUDED_CATEGORIES.has(t.category)) return;
          if (!buckets.has(t.category)) buckets.set(t.category, []);
          buckets.get(t.category).push(t);
        });
        const ordered = Array.from(buckets.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, FEATURED_CATEGORIES)
          .map(([category, list]) => ({
            category,
            tools: list.slice(0, TOP_PER_CATEGORY),
          }));
        setSections(ordered);
      } catch {
        if (active) setSections([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 첫 카테고리 활성화(현재 활성이 사라지면 보정).
  useEffect(() => {
    if (!sections.length) return;
    setActiveCategory((prev) =>
      prev && sections.some((s) => s.category === prev) ? prev : sections[0].category
    );
  }, [sections]);

  // 자동 회전 — 활성 변경마다 타이머 재시작. hover/포커스 시 정지. 모션 민감 시 미회전.
  useEffect(() => {
    if (paused || prefersReducedMotion() || sections.length < 2 || !activeCategory)
      return undefined;
    const idx = sections.findIndex((s) => s.category === activeCategory);
    const timer = setTimeout(() => {
      const next = sections[(idx + 1) % sections.length];
      setActiveCategory(next.category);
    }, ROTATE_MS);
    return () => clearTimeout(timer);
  }, [activeCategory, sections, paused]);

  // 적재 종료 시 데이터 유무 1회 통지.
  useEffect(() => {
    if (loading || resolvedRef.current) return;
    resolvedRef.current = true;
    if (onResolved) onResolved(sections.length > 0);
  }, [loading, sections, onResolved]);

  const hasData = useMemo(() => sections.length > 0, [sections]);

  if (loading) return <CuratedHeroSkeleton />;
  if (!hasData) return null; // graceful — 상위가 onResolved(false)로 1단 복귀.

  return (
    <CuratedHeroWidget
      sections={sections}
      benchmarkIds={benchmarkIds}
      active={activeCategory}
      onSelect={setActiveCategory}
      onPauseChange={setPaused}
    />
  );
};

export default CuratedHeroLive;
