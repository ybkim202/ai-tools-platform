import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { trendingAPI } from '../services/api';
import { safeHttpUrl } from '../utils/url';
import ExternalLinkIcon from './ExternalLinkIcon';
import { TrendBentoSkeleton } from './Skeletons';
import '../styles/Curated.css';

// 랜딩 깃헙 트렌드 프리뷰 — Apple 벤토(Bento) 그리드. 이번 주 급부상 오픈소스 Top N을
// 큰 히어로 셀(1위: 이름·설명·큰 별점)+작은 셀(2~5위)로. 전체는 /trends/github.
// 데이터 미점등(0행)이면 렌더하지 않는다(정직성 G3).
const TOP_N = 5; // 히어로 1 + 셀 4 = 벤토 4×2

// 별점 압축 표기(1,234 → 1.2k). GithubTrends 페이지와 동일 규칙.
const formatStars = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return n.toLocaleString();
};

const StarIcon = () => (
  <svg
    className="star-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9L12 2.5z" />
  </svg>
);

// 레포 → 표시 필드 파생.
const repoView = (repo) => {
  const url = safeHttpUrl(repo.html_url);
  return {
    url,
    avatarUrl: safeHttpUrl(repo.avatar_url),
    ownerRepo: repo.owner
      ? `${repo.owner}/${repo.repo || repo.name}`
      : repo.repo || repo.name,
    starsText: formatStars(repo.stars),
    descText: repo.description_ko || repo.description || '',
    topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : [],
    name: repo.name || repo.repo,
    language: repo.language,
  };
};

const Avatar = ({ url }) =>
  url ? (
    <img
      className="trend-avatar"
      src={url}
      alt=""
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  ) : null;

const cellProps = (url, ownerRepo) =>
  url
    ? {
        as: 'a',
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': `${ownerRepo} 깃헙 레포 (새 창에서 열림)`,
      }
    : { as: 'article' };

const GithubTrendTeaser = () => {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    trendingAPI
      .getGithubTrending({ period: 'weekly', limit: TOP_N })
      .then((res) => {
        if (!alive) return;
        setRepos(res?.data?.data?.repos || []);
      })
      .catch(() => {
        if (alive) setRepos([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 로딩 끝났는데 0행이면 섹션 미렌더(정직성 G3). 로딩 중엔 스켈레톤(헤더 포함).
  if (!loading && repos.length === 0) return null;

  const hero = repos[0] ? repoView(repos[0]) : null;
  const rest = repos.slice(1, TOP_N).map(repoView);

  const HeroTag = hero?.url ? 'a' : 'article';
  const heroProps = hero?.url
    ? {
        href: hero.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': `${hero.ownerRepo} 깃헙 레포 (새 창에서 열림)`,
      }
    : {};

  return (
    <section className="curated-section" aria-labelledby="trend-teaser-title">
      <div className="curated-section-header">
        <div className="curated-section-heading">
          <h2 id="trend-teaser-title" className="curated-section-title">
            깃헙 트렌드
          </h2>
          <p className="curated-section-subtitle">
            이번 주 빠르게 떠오르는 오픈소스 AI 프로젝트
          </p>
        </div>
        <Link className="curated-see-all" to="/trends/github">
          트렌드 전체 보기
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      {loading || !hero ? (
        <TrendBentoSkeleton />
      ) : (
      <div className="bento-grid">
        {/* 히어로 셀(2×2): 1위 레포 — 이름·설명·큰 별점 */}
        <HeroTag className="bento-cell bento-hero trend-hero" {...heroProps}>
          <div className="trend-hero-top">
            <span className="trend-owner">
              <Avatar url={hero.avatarUrl} />
              <span className="trend-owner-name">{hero.ownerRepo}</span>
            </span>
            {hero.starsText && (
              <span className="trend-stars trend-stars--hero">
                <StarIcon />
                <b>{hero.starsText}</b>
              </span>
            )}
          </div>
          <h3 className="trend-hero-name">{hero.name}</h3>
          <p className="trend-hero-desc">
            {hero.descText || '설명이 없는 레포예요.'}
          </p>
          <div className="trend-hero-foot">
            <span className="trend-tags">
              {hero.language && (
                <span className="trend-lang">
                  <span className="trend-lang-dot" aria-hidden="true" />
                  {hero.language}
                </span>
              )}
              {hero.topics.map((t) => (
                <span key={t} className="trend-topic">
                  #{t}
                </span>
              ))}
            </span>
            {hero.url && (
              <span className="trend-go">
                깃헙에서 보기
                <ExternalLinkIcon />
                <span className="sr-only">(새 창에서 열림)</span>
              </span>
            )}
          </div>
        </HeroTag>

        {/* 나머지(2~5위): 컴팩트 셀 */}
        {rest.map((r, idx) => {
          const Tag = r.url ? 'a' : 'article';
          const p = cellProps(r.url, r.ownerRepo);
          delete p.as;
          return (
            <Tag
              key={repos[idx + 1].id || r.url || r.ownerRepo}
              className="bento-cell trend-cell"
              {...p}
            >
              <span className="trend-owner trend-owner--sm">
                <Avatar url={r.avatarUrl} />
                <span className="trend-owner-name">{r.ownerRepo}</span>
              </span>
              <h4 className="trend-cell-name">{r.name}</h4>
              <div className="trend-cell-foot">
                {r.starsText && (
                  <span className="trend-stars">
                    <StarIcon />
                    {r.starsText}
                  </span>
                )}
                {r.language && (
                  <span className="trend-lang">
                    <span className="trend-lang-dot" aria-hidden="true" />
                    {r.language}
                  </span>
                )}
              </div>
            </Tag>
          );
        })}
      </div>
      )}
    </section>
  );
};

export default GithubTrendTeaser;
