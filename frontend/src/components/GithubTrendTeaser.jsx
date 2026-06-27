import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { trendingAPI } from '../services/api';
import { safeHttpUrl } from '../utils/url';
import ExternalLinkIcon from './ExternalLinkIcon';
import '../styles/Curated.css';
import '../styles/GithubTrends.css';

// 랜딩 깃헙 트렌드 프리뷰 — 주간 급부상 오픈소스 상위 N개를 맛보기로 보여준다.
// 전체는 /trends/github. 데이터 미점등(0행)이면 렌더하지 않는다(정직성 G3).
const TOP_N = 4;

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

const GithubTrendTeaser = () => {
  const [repos, setRepos] = useState([]);

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
      });
    return () => {
      alive = false;
    };
  }, []);

  if (repos.length === 0) return null;

  return (
    <section className="curated-section" aria-labelledby="trend-teaser-title">
      <div className="curated-section-header">
        <h2 id="trend-teaser-title" className="curated-section-title">
          깃헙 트렌드
        </h2>
        <Link className="curated-see-all" to="/trends/github">
          트렌드 전체 보기
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      <div className="repo-grid repo-grid--teaser">
        {repos.slice(0, TOP_N).map((repo) => {
          const url = safeHttpUrl(repo.html_url);
          const avatarUrl = safeHttpUrl(repo.avatar_url);
          const ownerRepo = repo.owner
            ? `${repo.owner}/${repo.repo || repo.name}`
            : repo.repo || repo.name;
          const starsText = formatStars(repo.stars);
          const descText = repo.description_ko || repo.description || '';
          const CardTag = url ? 'a' : 'article';
          const cardProps = url
            ? {
                href: url,
                target: '_blank',
                rel: 'noopener noreferrer',
                'aria-label': `${ownerRepo} 깃헙 레포 (새 창에서 열림)`,
              }
            : {};

          return (
            <CardTag
              key={repo.id || repo.html_url || ownerRepo}
              className="repo-card"
              {...cardProps}
            >
              <div className="repo-card-head">
                <span className="repo-owner">
                  {avatarUrl && (
                    <img
                      className="repo-owner-avatar"
                      src={avatarUrl}
                      alt=""
                      loading="lazy"
                      width="28"
                      height="28"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <span className="repo-owner-name">{ownerRepo}</span>
                </span>
                {starsText && (
                  <span className="repo-stars">
                    <StarIcon />
                    {starsText}
                  </span>
                )}
              </div>

              <h3 className="repo-name">{repo.name || repo.repo}</h3>

              {descText ? (
                <p className="repo-desc">{descText}</p>
              ) : (
                <p className="repo-desc repo-desc-empty">설명이 없는 레포예요.</p>
              )}

              {url && (
                <span className="repo-link">
                  깃헙에서 보기
                  <ExternalLinkIcon />
                  <span className="sr-only">(새 창에서 열림)</span>
                </span>
              )}
            </CardTag>
          );
        })}
      </div>
    </section>
  );
};

export default GithubTrendTeaser;
