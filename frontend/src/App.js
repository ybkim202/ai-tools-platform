import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Compare from './pages/Compare';
import Details from './pages/Details';
import Recommendations from './pages/Recommendations';
import { useUIStore } from './stores/toolStore';
import './App.css';

function App() {
  const { darkMode } = useUIStore();

  useEffect(() => {
    // 다크 모드 설정
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [darkMode]);

  return (
    <Router>
      <div className="app">
        {/* 네비게이션 바 */}
        <nav className="navbar">
          <div className="navbar-container">
            <a href="/" className="navbar-logo">
              🤖 AITools
            </a>
            
            <div className="navbar-menu">
              <a href="/" className="nav-link">
                홈
              </a>
              <a href="/compare" className="nav-link">
                비교
              </a>
              <a href="/recommendations" className="nav-link">
                추천
              </a>
              <button className="nav-button">
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </nav>

        {/* 메인 콘텐츠 */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/details/:id" element={<Details />} />
        </Routes>

        {/* 푸터 */}
        <footer className="footer">
          <div className="footer-content">
            <p>&copy; 2026 AITools. 모든 AI 도구를 한곳에서 비교하고 추천받으세요.</p>
            <div className="footer-links">
              <a href="/#">문서</a>
              <a href="/#">API</a>
              <a href="/#">GitHub</a>
              <a href="/#">문의</a>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
