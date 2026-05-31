import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from 'react-router-dom';
import Home from './pages/Home';
import Compare from './pages/Compare';
import Details from './pages/Details';
import Recommendations from './pages/Recommendations';
import News from './pages/News';
import GithubTrends from './pages/GithubTrends';
import Benchmarks from './pages/Benchmarks';
import { useUIStore } from './stores/toolStore';
import ExternalLinkIcon from './components/ExternalLinkIcon';
import GlobalSearch from './components/GlobalSearch';
import './App.css';

// 트렌드 하위 라우트 정의(드롭다운 + 모바일 그룹 공유 진실).
const TREND_ITEMS = [
  { to: '/news', label: '뉴스' },
  { to: '/trends/github', label: '깃헙 트렌드' },
];

// 네비 '트렌드 ▾' 드롭다운(데스크톱) + 모바일 들여쓰기 그룹.
// 단일 DOM + 미디어쿼리 표시전환: .nav-dropdown은 모바일에서 숨기고
// .nav-group(라벨+sub링크)은 데스크톱에서 숨긴다(App.css). 라우트는 한 번만 선언.
const TrendNav = ({ closeMenu }) => {
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const itemRefs = React.useRef([]);
  const closeTimer = React.useRef(null);

  // 하위 경로 중 하나라도 활성이면 트리거를 부모 활성으로 표시.
  const parentActive = TREND_ITEMS.some((it) =>
    location.pathname.startsWith(it.to)
  );

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const closeDropdown = React.useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, []);

  // 바깥 클릭 + Escape 닫기(열림 동안에만).
  React.useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  React.useEffect(() => () => clearCloseTimer(), []);

  const onTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      // 다음 틱에 첫 아이템 포커스.
      requestAnimationFrame(() => itemRefs.current[0]?.focus());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((v) => !v);
    }
  };

  const onMenuKeyDown = (e, idx) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      itemRefs.current[(idx + 1) % TREND_ITEMS.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      itemRefs.current[
        (idx - 1 + TREND_ITEMS.length) % TREND_ITEMS.length
      ]?.focus();
    }
  };

  return (
    <>
      {/* 데스크톱: hover/click 드롭다운 */}
      <div
        className="nav-dropdown"
        ref={containerRef}
        onMouseEnter={() => {
          clearCloseTimer();
          setOpen(true);
        }}
        onMouseLeave={() => {
          clearCloseTimer();
          closeTimer.current = setTimeout(() => setOpen(false), 200);
        }}
      >
        <button
          type="button"
          ref={triggerRef}
          className={`nav-link nav-dropdown-trigger${
            parentActive ? ' nav-link-active' : ''
          }`}
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls="trend-submenu"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
        >
          트렌드
          <svg
            className="chevron"
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
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <div
          id="trend-submenu"
          className="nav-dropdown-menu"
          role="menu"
          hidden={!open}
        >
          {TREND_ITEMS.map((it, idx) => (
            <NavLink
              key={it.to}
              to={it.to}
              role="menuitem"
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                closeDropdown();
                closeMenu();
              }}
              onKeyDown={(e) => onMenuKeyDown(e, idx)}
              className={({ isActive }) =>
                `nav-dropdown-item${isActive ? ' nav-link-active' : ''}`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* 모바일: 들여쓰기 그룹(기존 햄버거 패널 안) */}
      <div className="nav-group">
        <span className="nav-group-label" id="trend-group">
          트렌드
        </span>
        {TREND_ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            onClick={closeMenu}
            className={({ isActive }) =>
              `nav-link nav-link-sub${isActive ? ' nav-link-active' : ''}`
            }
          >
            {it.label}
          </NavLink>
        ))}
      </div>
    </>
  );
};

function App() {
  const { theme, toggleDarkMode } = useUIStore();
  const compareCount = useUIStore(
    (state) => state.selectedToolsForCompare.length
  );
  // 헤더 패널 enum(검색/메뉴 상호배타). 메뉴 열림 여부는 이 enum에서 파생.
  const activeHeaderPanel = useUIStore((state) => state.activeHeaderPanel);
  const toggleHeaderPanel = useUIStore((state) => state.toggleHeaderPanel);
  const closeHeaderPanel = useUIStore((state) => state.closeHeaderPanel);
  const menuOpen = activeHeaderPanel === 'menu';
  // OS prefers-color-scheme 실시간 추적(시스템 따름 모드에서 아이콘/aria-pressed 갱신용).
  const [systemPrefersDark, setSystemPrefersDark] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    // 3-상태: 'light'/'dark'는 data-theme로 명시, null이면 제거(OS prefers 따름).
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setSystemPrefersDark(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  // 효과적 다크 여부(aria-pressed·아이콘용).
  const isDark = theme === 'dark' || (theme === null && systemPrefersDark);

  // 모바일 네비 토글 상태는 store enum(activeHeaderPanel)에서 파생. 데스크톱은 CSS로 항상 가로 노출.
  const navMenuRef = React.useRef(null);
  const menuToggleRef = React.useRef(null);

  // 라우트 이동 등에서 모든 헤더 패널을 닫는다(검색/메뉴 공통).
  const closeMenu = closeHeaderPanel;

  // Escape로 닫기 + 바깥 클릭 닫기. 메뉴 열림 동안에만 리스너 부착.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeHeaderPanel();
        // 닫은 뒤 포커스를 토글 버튼으로 복귀(키보드 흐름 유지).
        menuToggleRef.current?.focus();
      }
    };
    const handlePointerDown = (e) => {
      if (
        navMenuRef.current &&
        !navMenuRef.current.contains(e.target) &&
        menuToggleRef.current &&
        !menuToggleRef.current.contains(e.target)
      ) {
        closeHeaderPanel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [menuOpen, closeHeaderPanel]);

  return (
    <Router>
      <div className="app">
        {/* 네비게이션 바 */}
        <nav className="navbar">
          <div className="navbar-container">
            <Link
              to="/"
              className="navbar-logo"
              aria-label="AITools 홈"
              onClick={closeHeaderPanel}
            >
              <span className="navbar-logo-mark" aria-hidden="true" />
              <span className="navbar-logo-word">AITools</span>
            </Link>

            {/* 전역 검색(F3): 어느 화면에서나 도구 즉시 탐색. 검색은 1급 진입점이므로
                로고 우측에 배치(모바일은 컴포넌트 내부 아이콘 토글). */}
            <GlobalSearch />

            {/* 모바일 전용 햄버거 토글(데스크톱은 CSS로 숨김). 색 단독 금지 → aria-label로 의미 전달 */}
            <button
              type="button"
              ref={menuToggleRef}
              className="nav-toggle"
              onClick={() => {
                const willOpen = activeHeaderPanel !== 'menu';
                toggleHeaderPanel('menu');
                // 검색 패널이 열려 있다가 메뉴로 전환되는 경우 포함:
                // 메뉴를 열 때 포커스를 패널 첫 링크로 이동(포커스 미아 방지).
                if (willOpen) {
                  requestAnimationFrame(() => {
                    navMenuRef.current
                      ?.querySelector('a, button')
                      ?.focus();
                  });
                }
              }}
              aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={menuOpen}
              aria-controls="primary-nav-menu"
            >
              <span className="nav-toggle-icon" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  {menuOpen ? (
                    <>
                      <line x1="6" y1="6" x2="18" y2="18" />
                      <line x1="6" y1="18" x2="18" y2="6" />
                    </>
                  ) : (
                    <>
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </>
                  )}
                </svg>
              </span>
            </button>

            <div
              id="primary-nav-menu"
              ref={navMenuRef}
              className={`navbar-menu${menuOpen ? ' navbar-menu-open' : ''}`}
            >
              {/* 링크 그룹: 데스크톱 가로 / 모바일 세로 패널 */}
              <div className="nav-links">
                <NavLink
                  to="/"
                  end
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' nav-link-active' : ''}`
                  }
                >
                  홈
                </NavLink>
                <NavLink
                  to="/recommendations"
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' nav-link-active' : ''}`
                  }
                >
                  추천
                </NavLink>
                <NavLink
                  to="/compare"
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `nav-link nav-link-compare${isActive ? ' nav-link-active' : ''}`
                  }
                >
                  비교
                  {compareCount > 0 && (
                    <span
                      className="nav-badge"
                      aria-label={`비교 담긴 도구 ${compareCount}개`}
                    >
                      {compareCount}
                    </span>
                  )}
                </NavLink>
                <TrendNav closeMenu={closeMenu} />
                <NavLink
                  to="/benchmarks"
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' nav-link-active' : ''}`
                  }
                >
                  벤치마크
                </NavLink>
              </div>
              <button
                type="button"
                className="nav-button"
                onClick={toggleDarkMode}
                aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
                aria-pressed={isDark}
              >
                <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
              </button>
            </div>
          </div>
        </nav>

        {/* 메인 콘텐츠 */}
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/news" element={<News />} />
            <Route path="/trends/github" element={<GithubTrends />} />
            <Route path="/benchmarks" element={<Benchmarks />} />
            <Route path="/details/:id" element={<Details />} />
          </Routes>
        </main>

        {/* 푸터 */}
        <footer className="footer">
          <div className="footer-content">
            {/* 블록1: 브랜드 */}
            <div className="footer-brand">
              <Link
                to="/"
                className="footer-brand-title"
                aria-label="AITools 홈"
              >
                <span className="footer-brand-mark" aria-hidden="true" />
                <span>AITools</span>
              </Link>
              <p className="footer-tagline">
                모든 AI 도구를 한곳에서 비교하고 추천받으세요.
              </p>
            </div>

            {/* 블록2: 탐색 */}
            <nav className="footer-nav" aria-label="푸터 탐색">
              <Link to="/recommendations" className="footer-link">
                추천
              </Link>
              <Link to="/compare" className="footer-link">
                비교
              </Link>
              <Link to="/news" className="footer-link">
                뉴스
              </Link>
              <Link to="/trends/github" className="footer-link">
                깃헙 트렌드
              </Link>
              <Link to="/benchmarks" className="footer-link">
                벤치마크
              </Link>
              <a
                className="footer-link footer-link-external"
                href="https://github.com/ybkim202/ai-tools-platform"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
                {/* 외부/새 창: 색 외 수단(아이콘) + SR 안내 (공용 패턴) */}
                <ExternalLinkIcon />
                <span className="sr-only">(새 창에서 열림)</span>
              </a>
            </nav>

            {/* 블록3: 카피라이트 */}
            <p className="footer-copyright">&copy; 2026 AITools</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
