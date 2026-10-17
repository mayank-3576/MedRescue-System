import { useState, useEffect, useCallback } from 'react';

interface UseApiOptions<T> {
  immediate?: boolean;
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useApi<T, P extends any[] = any[]>(
  apiFunc: (...args: P) => Promise<T>,
  options: UseApiOptions<T> = {}
) {
  const { immediate = true, initialData, onSuccess, onError } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: P): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFunc(...args);
        setData(result);
        if (onSuccess) onSuccess(result);
        return result;
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(err?.message || 'An unexpected error occurred');
        setError(errorObj);
        if (onError) onError(errorObj);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiFunc, onSuccess, onError]
  );

  useEffect(() => {
    if (immediate) {
      execute(...([] as unknown as P));
    }
  }, [immediate, execute]);

  return {
    data,
    loading,
    error,
    execute,
    setData,
    refetch: execute,
  };
}

export default useApi;
