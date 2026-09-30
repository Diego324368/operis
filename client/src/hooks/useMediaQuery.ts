import { useEffect, useState } from 'react';
export function useMediaQuery(query: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => { const mq = window.matchMedia(query); const h = () => setM(mq.matches); h(); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, [query]);
  return m;
}
