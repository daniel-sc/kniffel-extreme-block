import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

interface Size {
  width: number;
  height: number;
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const useElementSize = <T extends HTMLElement>() => {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const ref = useCallback((element: T | null) => {
    setNode(element);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!node) {
      return undefined;
    }

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [node]);

  return { ref, size };
};
