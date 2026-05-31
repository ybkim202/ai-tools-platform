import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Link,
} from 'react-router-dom';
import Home from './pages/Home';
import Compare from './pages/Compare';
import Details from './pages/Details';
import Recommendations from './pages/Recommendations';
import News from './pages/News';
import Benchmarks from './pages/Benchmarks';
import { useUIStore } from './stores/toolStore';
import ExternalLinkIcon from './components/ExternalLinkIcon';
import './App.css';

function App() {
  const { theme, toggleDarkMode } = useUIStore();
  const compareCount = useUIStore(
    (state) => state.selectedToolsForCompare.length
  );
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

  // 모바일 네비 토글 상태. 데스크톱은 CSS로 항상 가로 노출(이 상태는 모바일 패널에만 영향).
  const [menuOpen, setMenuOpen] = React.useState(false);
  const navMenuRef = React.useRef(null);
  const menuToggleRef = React.useRef(null);

  const closeMenu = React.useCallback(() => setMenuOpen(false), []);

  // Escape로 닫기 + 바깥 클릭 닫기. 열림 동안에만 리스너 부착.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
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
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <Router>
      <div className="app">
        {/* 네비게이션 바 */}
        <nav className="navbar">
          <div className="navbar-container">
            <Link to="/" className="navbar-logo" onClick={closeMenu}>
              <span aria-hidden="true">🤖</span> AITools
            </Link>

            {/* 모바일 전용 햄버거 토글(데스크톱은 CSS로 숨김). 색 단독 금지 → aria-label로 의미 전달 */}
            <button
              type="button"
              ref={menuToggleRef}
              className="nav-toggle"
              onClick={() => setMenuOpen((open) => !open)}
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
                  to="/news"
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `nav-link${isActive ? ' nav-link-active' : ''}`
                  }
                >
                  뉴스
                </NavLink>
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
            <Route path="/benchmarks" element={<Benchmarks />} />
            <Route path="/details/:id" element={<Details />} />
          </Routes>
        </main>

        {/* 푸터 */}
        <footer className="footer">
          <div className="footer-content">
            {/* 블록1: 브랜드 */}
            <div className="footer-brand">
              <Link to="/" className="footer-brand-title">
                AITools
              </Link>
              <p className="footer-tagline">
                모든 AI 도구를 한곳에서 비교하고 추천받으세요.
              </p>
            </div>

            {/* 블록2: 탐색 */}
            <nav className="footer-nav" aria-label="푸터 탐색">
              <Link to="/compare" className="footer-link">
                비교
              </Link>
              <Link to="/recommendations" className="footer-link">
                추천
              </Link>
              <Link to="/news" className="footer-link">
                뉴스
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
