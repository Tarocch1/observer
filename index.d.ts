export interface ObserveOptions {
  isShallow?: boolean;
  equals?: (a: unknown, b: unknown) => boolean;
  ignoreSymbols?: boolean;
  ignoreUnderscores?: boolean;
  ignoreKeys?: Array<string | symbol>;
}

export function observe<T extends { [key: string]: any }>(
  object: T,
  callback: (this: T, path: string[], previous: unknown, value: unknown) => unknown,
  options?: ObserveOptions,
): T;

export function observed<T extends { [key: string]: any }>(object: T): T;

export function unobserve<T extends { [key: string]: any }>(object: T): T;
