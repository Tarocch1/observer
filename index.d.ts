declare namespace observer {
  interface Options {
    isShallow?: boolean;
    equals?: (a: unknown, b: unknown) => boolean;
    ignoreSymbols?: boolean;
    ignoreUnderscores?: boolean;
    ignoreKeys?: Array<string | symbol>;
  }
}

declare const observer: {
  observe<T extends { [key: string]: any }>(
    object: T,
    callback: (this: T, path: string[], previous: unknown, value: unknown) => unknown,
    options?: observer.Options,
  ): T;
  observed<T extends { [key: string]: any }>(object: T): T;
  unobserve<T extends { [key: string]: any }>(object: T): T;
};

export = observer;
