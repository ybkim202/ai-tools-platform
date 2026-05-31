import { buildPageItems } from './pagination';

describe('buildPageItems', () => {
  test('7개 이하면 전부 노출(말줄임 없음)', () => {
    expect(buildPageItems(1, 1)).toEqual([1]);
    expect(buildPageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('8개 첫 페이지: 끝쪽 말줄임', () => {
    expect(buildPageItems(1, 8)).toEqual([1, 2, null, 8]);
  });

  test('8개 마지막 페이지: 앞쪽 말줄임', () => {
    expect(buildPageItems(8, 8)).toEqual([1, null, 7, 8]);
  });

  test('8개 중간 페이지: 양쪽 말줄임', () => {
    expect(buildPageItems(4, 8)).toEqual([1, null, 3, 4, 5, null, 8]);
  });

  test('말줄임 경계: 인접 시 null 미삽입', () => {
    // currentPage=2면 1과 인접 → 앞쪽 말줄임 없음
    expect(buildPageItems(2, 8)).toEqual([1, 2, 3, null, 8]);
  });
});
