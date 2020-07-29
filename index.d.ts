declare namespace observer {
  interface Options {
    equals?: (a: unknown, b: unknown) => boolean;
  }
}

declare const observer: {
  observe<T extends { [key: string]: any }>(
    object: T,
    callback: (this: T, path: string[], previous: unknown, value: unknown) => unknown,
    options?: observer.Options,
  ): T;
  observed<T extends {[key: string]: any}>(object: T): T;
};

export = observer;
