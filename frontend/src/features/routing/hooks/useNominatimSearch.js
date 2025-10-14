import { useEffect, useRef, useState } from "react";

export default function useNominatimSearch(
  searchFn,
  { delay = 300, limit = 6 } = {}
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const t = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      const hits = await searchFn(query, { limit });
      setResults(hits || []);
      setSearching(false);
    }, delay);
    return () => clearTimeout(t.current);
  }, [query, delay, limit, searchFn]);

  return { query, setQuery, results, searching };
}
