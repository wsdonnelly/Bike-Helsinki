import { useEffect, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/shared";

export default function useGeocoding(
  searchFn,
  { delay = SEARCH_DEBOUNCE_MS, limit = 6 } = {}
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);
  const ctrlRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      const hits = await searchFn(query, { limit, signal: ctrl.signal });
      if (!ctrl.signal.aborted) {
        setResults(hits || []);
        setSearching(false);
      }
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [query, delay, limit, searchFn]);

  return { query, setQuery, results, searching };
}
