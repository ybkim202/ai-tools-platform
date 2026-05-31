import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { benchmarksAPI, handleApiError } from '../services/api';
import {
  LoadingState,
  EmptyNoDataState,
  ErrorState,
} from '../components/states/StateViews';
import '../styles/Benchmarks.css';

// 벤치마크 종류별 한국어 1줄 설명(모듈 상수, 백엔드 호출 없음).
// 키는 benchmark_type 표기. 케이스 변형에 안전하도록 소문자 정규화 조회를 쓴다.
const BENCHMARK_DESCRIPTIONS = {
  mmlu: '57개 분야 객관식으로 지식과 추론의 폭을 측정',
  humaneval: '파이썬 함수 코드 생성의 기능 정확도를 측정',
  gsm8k: '초등 수준 수학 문장제의 다단계 추론을 평가',
  gpqa: '전문가도 어려운 대학원 수준 과학 난문을 평가',
  math: '경시대회 수준의 수학 문제 해결 능력을 측정',
  mmmu: '이미지와 텍스트를 결합한 대학 수준 멀티모달 추론을 평가',
};

const getBenchmarkDescription = (type) =>
  type ? BENCHMARK_DESCRIPTIONS[type.toLowerCase()] : undefined;

const Benchmarks = () => {
  // 종류 칩
  const [types, setTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  // 리더보드
  const [rows, setRows] = useState([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState(null);

  const fetchBoard = useCallback(async (type) => {
    if (!type) return;
    setBoardLoading(true);
    setBoardError(null);
    try {
      const res = await benchmarksAPI.getBenchmarks({
        benchmark_type: type,
        sort_by: 'score_desc',
        limit: 50,
      });
      setRows(res.data?.data || []);
    } catch (err) {
      setRows([]);
      setBoardError(handleApiError(err).message);
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const fetchTypes = useCallback(async () => {
    setTypesLoading(true);
    setTypesError(null);
    try {
      const res = await benchmarksAPI.getBenchmarkTypes();
      const data = res.data?.data || [];
      setTypes(data);
      if (data.length > 0) {
        const first = data[0].type;
        setSelectedType(first);
        fetchBoard(first);
      } else {
        setSelectedType(null);
      }
    } catch (err) {
      setTypesError(handleApiError(err).message);
    } finally {
      setTypesLoading(false);
    }
  }, [fetchBoard]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  // 칩 전환: 이전 결과/에러 초기화 후 재fetch.
  const handleSelectType = (type) => {
    if (type === selectedType) return;
    setSelectedType(type);
    setRows([]);
    setBoardError(null);
    fetchBoard(type);
  };

  // 막대 정규화: 현재 목록 내 최대 점수 기준. 0/누락 가드.
  const maxScore = rows.reduce(
    (m, r) => (Number.isFinite(r.score) && r.score > m ? r.score : m),
    0
  );
  const barPct = (score) =>
    maxScore > 0 && Number.isFinite(score)
      ? Math.max(0, (score / maxScore) * 100)
      : 0;

  // 선택된 벤치마크의 1줄 설명(파생값). 없으면 미렌더(시프트 0).
  const selectedDesc = getBenchmarkDescription(selectedType);

  return (
    <div className="benchmarks-page">
      <div className="page-header">
        <p className="page-eyebrow">벤치마크</p>
        <h1 className="page-title">벤치마크 리더보드</h1>
        <p className="page-subtitle">
          공개 벤치마크 점수로 AI 도구를 줄세워 비교하세요
        </p>
      </div>

      <div className="benchmarks-container">
        {typesLoading ? (
          <LoadingState message="벤치마크 종류를 불러오는 중..." />
        ) : typesError ? (
          <ErrorState onRetry={fetchTypes} message={typesError} />
        ) : types.length === 0 ? (
          <EmptyNoDataState
            title="아직 등록된 벤치마크가 없습니다"
            message="벤치마크 데이터를 준비 중이에요."
            ctaLabel="도구 탐색하기"
            ctaTo="/"
          />
        ) : (
          <>
            <div className="benchmarks-types">
              <p className="filter-label" id="benchmark-type-label">
                벤치마크 종류
              </p>
              <div
                className="filter-buttons"
                role="group"
                aria-labelledby="benchmark-type-label"
              >
                {types.map((item) => {
                  const active = item.type === selectedType;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      className={`filter-btn${active ? ' active' : ''}`}
                      aria-pressed={active}
                      aria-label={`${item.type}, ${item.count}건`}
                      onClick={() => handleSelectType(item.type)}
                    >
                      {item.type}
                      <span className="chip-count" aria-hidden="true">
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 라이브 리전은 항상 DOM에 상주시켜 칩 전환 시 SR이 안정적으로
                announce하도록 한다. 설명이 없으면 빈 채로 두어 레이아웃 시프트
                없이(텍스트 미점유) 유지한다. */}
            <p
              className={`benchmark-desc${selectedDesc ? '' : ' is-empty'}`}
              aria-live="polite"
            >
              {selectedDesc || ''}
            </p>

            <p className="leaderboard-caption">
              막대 길이는 현재 목록 내 상대값입니다. 비교 기준은 점수 숫자입니다.
            </p>

            {boardLoading ? (
              <LoadingState message="리더보드를 불러오는 중..." />
            ) : boardError ? (
              <ErrorState
                onRetry={() => fetchBoard(selectedType)}
                message={boardError}
              />
            ) : rows.length === 0 ? (
              <EmptyNoDataState
                title="이 종류의 점수가 아직 없습니다"
                message="다른 벤치마크 종류를 선택해보세요."
                inline
              />
            ) : (
              <>
                {/* 데스크톱: 테이블 */}
                <div className="leaderboard">
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th scope="col" className="col-rank">
                          순위
                        </th>
                        <th scope="col">도구</th>
                        <th scope="col" className="col-score">
                          점수
                        </th>
                        <th scope="col">점수 막대</th>
                        <th scope="col">출처</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const rank = idx + 1;
                        const top = rank <= 3;
                        return (
                          <tr key={row.id}>
                            <th
                              scope="row"
                              className={`col-rank${top ? ' rank-top' : ''}`}
                            >
                              {rank}
                            </th>
                            <td>
                              <Link
                                to={`/details/${row.tool_id}`}
                                className="leaderboard-tool"
                              >
                                {row.tool_name}
                              </Link>
                            </td>
                            <td className="col-score">{row.score}</td>
                            <td>
                              <div className="bar-track" aria-hidden="true">
                                <div
                                  className="bar-fill"
                                  style={{ width: `${barPct(row.score)}%` }}
                                />
                              </div>
                            </td>
                            <td className="col-source">{row.source || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 모바일: 행 카드 스택 */}
                <div className="leaderboard-cards">
                  {rows.map((row, idx) => {
                    const rank = idx + 1;
                    const top = rank <= 3;
                    return (
                      <div key={row.id} className="leaderboard-card">
                        <div className="leaderboard-card-top">
                          <span
                            className={`leaderboard-card-rank${
                              top ? ' rank-top' : ''
                            }`}
                          >
                            순위 {rank}
                          </span>
                          <Link
                            to={`/details/${row.tool_id}`}
                            className="leaderboard-tool"
                          >
                            {row.tool_name}
                          </Link>
                        </div>
                        <div className="leaderboard-card-score-row">
                          <span className="leaderboard-card-score">
                            {row.score}
                          </span>
                          <div className="bar-track" aria-hidden="true">
                            <div
                              className="bar-fill"
                              style={{ width: `${barPct(row.score)}%` }}
                            />
                          </div>
                        </div>
                        {row.source && (
                          <span className="leaderboard-card-source">
                            {row.source}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Benchmarks;
