const { shallowClone } = require('./lib/helper');
const { ProxyTarget } = require('./lib/constants');

const observe = (object, callback, options = {}) => {
  const equals = options.equals || Object.is;
  const pathCache = new WeakMap();
  const proxyCache = new WeakMap();

  let inApply = false;
  let changed = false;

  const isPrimitive = value => value === null || (typeof value !== 'object' && typeof value !== 'function');
  const isBuiltinWithoutMutableMethods = value => value instanceof RegExp || value instanceof Number;
  const isBuiltinWithMutableMethods = value => value instanceof Date;
  const isSameDescriptor = (a, b) => {
    return (
      a !== undefined &&
      b !== undefined &&
      Object.is(a.value, b.value) &&
      (a.writable || false) === (b.writable || false) &&
      (a.enumerable || false) === (b.enumerable || false) &&
      (a.configurable || false) === (b.configurable || false)
    );
  };

  const handleChange = (changePath, property, previous, value) => {
    if (!inApply) {
      callback(property ? changePath.concat([property]) : changePath, previous, value);
      return;
    }
    changed = true;
  };

  const buildProxy = (value, path) => {
    pathCache.set(value, path);
    let proxy = proxyCache.get(value);
    if (proxy === undefined) {
      proxy = new Proxy(value, handler);
      proxyCache.set(value, proxy);
    }
    return proxy;
  };

  const handler = {
    get: (target, property, receiver) => {
      if (property === ProxyTarget) {
        return target;
      }
      const value = Reflect.get(target, property, receiver);
      if (isPrimitive(value) || isBuiltinWithoutMutableMethods(value) || property === 'constructor') {
        return value;
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
      if (descriptor && !descriptor.configurable) {
        if (descriptor.set && !descriptor.get) {
          return undefined;
        }
        if (descriptor.writable === false) {
          return value;
        }
      }
      return buildProxy(value, pathCache.get(target).concat([property]));
    },
    set: (target, property, value, receiver) => {
      if (value && value[ProxyTarget] !== undefined) {
        value = value[ProxyTarget];
      }
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
      const previous = Reflect.get(target, property, receiver);
      const isChanged = !(property in target) || !equals(previous, value);
      let result = true;
      if (descriptor.set) {
        descriptor.set.call(receiver, value);
      } else if (isChanged) {
        result = Reflect.set(target[ProxyTarget] || target, property, value);
        if (result) {
          handleChange(pathCache.get(target), property, previous, value);
        }
      }
      return result;
    },
    defineProperty: (target, property, descriptor) => {
      let result = true;
      if (!isSameDescriptor(descriptor, Reflect.getOwnPropertyDescriptor(target, property))) {
        result = Reflect.defineProperty(target, property, descriptor);
        if (result) {
          handleChange(pathCache.get(target), property, undefined, descriptor.value);
        }
      }
      return result;
    },
    deleteProperty: (target, property) => {
      if (!Reflect.has(target, property)) {
        return true;
      }
      const previous = Reflect.get(target, property);
      const result = Reflect.deleteProperty(target, property);
      if (result) {
        handleChange(pathCache.get(target), property, previous, undefined);
      }
      return result;
    },
    apply: (target, thisArg, argumentsList) => {
      const compare = isBuiltinWithMutableMethods(thisArg);
      if (compare) {
        thisArg = thisArg[ProxyTarget];
      }
      if (!inApply) {
        inApply = true;
        let previous = undefined;
        if (compare) {
          previous = new thisArg.constructor(thisArg.valueOf());
        }
        if (Array.isArray(thisArg) || toString.call(thisArg) === '[object Object]') {
          previous = shallowClone(thisArg[ProxyTarget]);
        }
        const applyPath = pathCache.get(target).slice(0, -1);
        const result = Reflect.apply(target, thisArg, argumentsList);
        inApply = false;
        if (changed || (compare && !equals(previous.valueOf(), thisArg.valueOf()))) {
          changed = false;
          handleChange(applyPath, '', previous, thisArg[ProxyTarget] || thisArg);
        }
        return result;
      }
      return Reflect.apply(target, thisArg, argumentsList);
    },
  };

  const proxy = buildProxy(object, []);
  callback = callback.bind(proxy);
  return proxy;
};

module.exports = { observe };
