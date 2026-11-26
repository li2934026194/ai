import { onUnmounted, ref } from "vue";

export function useJobPolling() {
  const isPolling = ref(false);
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const stop = () => {
    cancelled = true;
    isPolling.value = false;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const poll = async <T>(
    fn: () => Promise<T>,
    isDone: (res: T) => boolean,
    maxAttempts = 8
  ): Promise<T> => {
    stop();
    cancelled = false;
    isPolling.value = true;
    const delays = [1000, 1500, 2000, 2500, 3000];
    let attempt = 0;

    while (!cancelled && attempt < maxAttempts) {
      const res = await fn();
      if (isDone(res) || cancelled) {
        isPolling.value = false;
        return res;
      }
      const waitMs = delays[Math.min(attempt, delays.length - 1)];
      attempt += 1;
      await new Promise<void>((resolve) => {
        timerId = setTimeout(resolve, waitMs);
      });
    }
    isPolling.value = false;
    return fn();
  };

  onUnmounted(() => {
    stop();
  });

  return { isPolling, poll, stop };
}
