const { shallowClone } = require('./lib/helper');
const { PROXYTARGET, UNOBSERVE } = require('./lib/constants');

const observe = (object, callback, options = {}) => {
  const equals = options.equals || Object.is;
  const pathCache = new WeakMap();
  const proxyCache = new WeakMap();

  let unobserved = false;

  let inApply = false;
  let changed = false;
  let applyPath;
  let applyPrevious;

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
    if (unobserved) return;

    if (!inApply) {
      callback(property ? changePath.concat([property]) : changePath, previous, value);
      return;
    }

    if (inApply && applyPrevious && previous !== undefined && value !== undefined && property !== 'length') {
      let item = applyPrevious;

      if (changePath !== applyPath) {
        changePath = changePath.slice(applyPath.length);

        changePath.forEach(key => {
          item[key] = shallowClone(item[key]);
          item = item[key];
        });
      }

      item[property] = previous;
    }

    changed = true;
  };

  const buildProxy = (value, path) => {
    if (unobserved) {
      return value;
    }
    pathCache.set(value, path);
    let proxy = proxyCache.get(value);
    if (proxy === undefined) {
      proxy = new Proxy(value, handler);
      proxyCache.set(value, proxy);
    }
    return proxy;
  };

  const unobserve = target => {
    unobserved = true;
    pathCache = null;
    proxyCache = null;

    return target;
  };

  const ignoreProperty = property => {
    return (
      unobserved ||
      (options.ignoreSymbols === true && isSymbol(property)) ||
      (options.ignoreUnderscores === true && property.charAt(0) === '_') ||
      (options.ignoreKeys !== undefined && options.ignoreKeys.includes(property))
    );
  };

  const handler = {
    get: (target, property, receiver) => {
      if (property === PROXYTARGET) {
        return target;
      }
      if (
        property === UNOBSERVE &&
        pathCache !== null &&
        pathCache.get(target) !== undefined &&
        pathCache.get(target).length === 0
      ) {
        return unobserve(target);
      }
      const value = Reflect.get(target, property, receiver);
      if (
        isPrimitive(value) ||
        isBuiltinWithoutMutableMethods(value) ||
        property === 'constructor' ||
        options.isShallow === true ||
        ignoreProperty(property)
      ) {
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
      if (descriptor && descriptor.set) {
        descriptor.set.call(receiver, value);
      } else if (isChanged) {
        result = Reflect.set(target[ProxyTarget] || target, property, value);
        if (result && !ignoreProperty(property)) {
          handleChange(pathCache.get(target), property, previous, value);
        }
      }
      return result;
    },
    defineProperty: (target, property, descriptor) => {
      let result = true;
      if (!isSameDescriptor(descriptor, Reflect.getOwnPropertyDescriptor(target, property))) {
        result = Reflect.defineProperty(target, property, descriptor);
        if (result && !ignoreProperty(property)) {
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
      if (result && !ignoreProperty(property)) {
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
        if (compare) {
          applyPrevious = new thisArg.constructor(thisArg.valueOf());
        }
        if (Array.isArray(thisArg) || toString.call(thisArg) === '[object Object]') {
          applyPrevious = shallowClone(thisArg[ProxyTarget]);
        }
        applyPath = pathCache.get(target).slice(0, -1);
        const result = Reflect.apply(target, thisArg, argumentsList);
        inApply = false;
        if (changed || (compare && !equals(applyPrevious.valueOf(), thisArg.valueOf()))) {
          changed = false;
          handleChange(applyPath, '', applyPrevious, thisArg[ProxyTarget] || thisArg);
          applyPrevious = undefined;
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

const observed = proxy => proxy[PROXYTARGET] || proxy;
const unobserve = proxy => proxy[UNOBSERVE] || proxy;

module.exports = { observe, observed, unobserve };
