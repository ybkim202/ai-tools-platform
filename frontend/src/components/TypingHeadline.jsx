import React, { useEffect, useState } from 'react';

// 타이핑 애니메이션 헤드라인 — text가 바뀌면(또는 start가 켜지면) 한 글자씩 타이핑.
// 태그(as)·클래스·트리거(start)를 받아 히어로 h1, 섹션 h2 등 어디서든 재사용한다.
// 접근성: 완성 텍스트를 aria-label로 제공(SR은 중간 상태를 읽지 않음), 내부는 aria-hidden.
// prefers-reduced-motion이면 즉시 완성 표시(모션 생략).
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TypingHeadline = ({
  text,
  as: Tag = 'h1',
  className = '',
  speed = 45,
  start = true,
  id,
}) => {
  const [shown, setShown] = useState(text);
  const [done, setDone] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(text);
      setDone(true);
      return undefined;
    }
    // 트리거 전(start=false) — 빈 상태 + 대기 커서. start가 켜지면 처음부터 타이핑.
    if (!start) {
      setShown('');
      setDone(false);
      return undefined;
    }
    setShown('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, start]);

  return (
    <Tag className={className} id={id} aria-label={text}>
      <span aria-hidden="true">
        {shown}
        <span className={`type-caret${done ? ' type-caret--idle' : ''}`} />
      </span>
    </Tag>
  );
};

export default TypingHeadline;
