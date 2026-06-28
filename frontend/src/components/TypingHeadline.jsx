import React, { useEffect, useState } from 'react';

// 타이핑 애니메이션 헤드라인 — text가 바뀌면 처음부터 한 글자씩 타이핑.
// 접근성: h1엔 완성 텍스트를 aria-label로 제공(SR은 중간 상태를 읽지 않음).
// prefers-reduced-motion이면 즉시 완성 표시(모션 생략).
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TypingHeadline = ({ text, className = '', speed = 45 }) => {
  const [shown, setShown] = useState(text);
  const [done, setDone] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(text);
      setDone(true);
      return undefined;
    }
    setShown('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <h1 className={`hero-title hero-title--typing ${className}`} aria-label={text}>
      <span aria-hidden="true">
        {shown}
        <span className={`type-caret${done ? ' type-caret--idle' : ''}`} />
      </span>
    </h1>
  );
};

export default TypingHeadline;
