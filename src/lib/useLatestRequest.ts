"use client";

import { useCallback, useRef } from "react";

/**
 * Guards against out-of-order async responses clobbering a newer one — e.g.
 * a slow request for an earlier field-change landing after a faster
 * request for a later one. Call the returned function with the promise and
 * a callback; the callback only runs if no newer call has been made since.
 */
export function useLatestRequest<T>() {
  const seqRef = useRef(0);
  return useCallback((promise: Promise<T>, onResolve: (result: T) => void) => {
    const id = ++seqRef.current;
    promise.then((result) => {
      if (id === seqRef.current) onResolve(result);
    });
  }, []);
}
