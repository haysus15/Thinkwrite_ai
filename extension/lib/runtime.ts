type AnyFn = (...args: any[]) => any;

function hasThen(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as Promise<unknown>).then === "function";
}

function isContextInvalidatedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return message.toLowerCase().includes("context invalidated");
}

async function callMaybePromise<T>(
  call: () => unknown,
  callbackStyle?: (resolve: (value: T) => void) => void
): Promise<T> {
  try {
    const result = call();
    if (hasThen(result)) {
      return (await result) as T;
    }
    if (callbackStyle) {
      return await new Promise<T>((resolve) => callbackStyle(resolve));
    }
    return result as T;
  } catch {
    if (callbackStyle) {
      return await new Promise<T>((resolve) => callbackStyle(resolve));
    }
    throw new Error("Extension API unavailable");
  }
}

export const ext: any =
  (globalThis as any).chrome ??
  (globalThis as any).browser ??
  null;

export function hasExtApi(): boolean {
  return Boolean(ext?.runtime);
}

export async function localGet<T = Record<string, unknown>>(key: string | string[] | null): Promise<T> {
  const storage = (globalThis.chrome ?? (globalThis as any).browser)?.storage?.local;
  if (!storage) {
    console.warn('[MirrorMode] storage.local not available at localGet call time');
    return {} as T;
  }
  return new Promise<T>((resolve) => {
    storage.get(key as any, (result: T) => resolve(result || {} as T));
  });
}

export async function localSet(value: Record<string, unknown>): Promise<void> {
  const storage = (globalThis.chrome ?? (globalThis as any).browser)?.storage?.local;
  if (!storage) {
    console.warn('[MirrorMode] storage.local not available at localSet call time');
    return;
  }
  return new Promise<void>((resolve) => {
    storage.set(value, () => resolve());
  });
}

export async function localRemove(key: string): Promise<void> {
  if (!ext?.storage?.local) return;
  try {
    await callMaybePromise<void>(
      () => ext.storage.local.remove(key),
      (resolve) => ext.storage.local.remove(key, () => resolve(undefined))
    );
  } catch (error) {
    if (!isContextInvalidatedError(error)) {
      throw error;
    }
  }
}

export async function syncGet<T = Record<string, unknown>>(key: string): Promise<T> {
  if (!ext?.storage?.sync) return {} as T;
  try {
    return await callMaybePromise<T>(
      () => ext.storage.sync.get(key),
      (resolve) => ext.storage.sync.get(key, (value: T) => resolve(value || ({} as T)))
    );
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      return {} as T;
    }
    throw error;
  }
}

export async function syncSet(value: Record<string, unknown>): Promise<void> {
  if (!ext?.storage?.sync) return;
  try {
    await callMaybePromise<void>(
      () => ext.storage.sync.set(value),
      (resolve) => ext.storage.sync.set(value, () => resolve(undefined))
    );
  } catch (error) {
    if (!isContextInvalidatedError(error)) {
      throw error;
    }
  }
}

export async function tabsQuery(
  query: Record<string, unknown>
): Promise<Array<{ url?: string }>> {
  if (!ext?.tabs) return [];
  try {
    return await callMaybePromise<Array<{ url?: string }>>(
      () => ext.tabs.query(query),
      (resolve) =>
        ext.tabs.query(query, (tabs: Array<{ url?: string }>) => resolve(tabs || []))
    );
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      return [];
    }
    throw error;
  }
}

export async function runtimeSendMessage(payload: unknown): Promise<unknown> {
  const runtime = (globalThis.chrome ?? (globalThis as any).browser)?.runtime;
  if (!runtime?.sendMessage) {
    throw new Error("Extension runtime sendMessage API unavailable");
  }
  return await new Promise((resolve, reject) => {
    try {
      runtime.sendMessage(payload, (response: unknown) => {
        const lastError = runtime.lastError;
        if (lastError) {
          reject(new Error((lastError as any).message || "Unknown runtime sendMessage error"));
          return;
        }
        resolve(response || null);
      });
    } catch {
      reject(new Error("Failed to send extension runtime message"));
    }
  });
}

export function runtimeOnMessageAddListener(listener: AnyFn): void {
  if (!ext?.runtime?.onMessage?.addListener) return;
  ext.runtime.onMessage.addListener(listener);
}
