const { observe, observed, unobserve } = require('../');

const testValues = [
  null,
  undefined,
  'string',
  new RegExp('regExp1'),
  RegExp('regExp2'),
  /regExp3/,
  true,
  false,
  1,
  '1',
  Number(2),
  new Number(3),
  Infinity,
  0,
  -0,
  NaN,
];

const toString = something => {
  if (something === null) return 'null';
  if (something === undefined) return 'undefined';
  return something.toLocaleString();
};

const testHelper = (object, options, callback) => {
  const last = {};

  const reset = () => {
    last.count = 0;
    last.thisArg = undefined;
    last.path = undefined;
    last.value = undefined;
    last.previous = undefined;
  };

  reset();

  const proxy = observe(
    object,
    function (path, previous, value) {
      last.count++;
      last.thisArg = this;
      last.path = path;
      last.previous = previous;
      last.value = value;
    },
    options,
  );

  const verify = (count, thisArg, path, previous, value, fullObject) => {
    expect(count).toBe(last.count);
    expect(thisArg).toBe(last.thisArg);
    expect(path).toEqual(last.path);
    expect(previous).toEqual(last.previous);
    expect(value).toEqual(last.value);

    expect(object).toBe(observed(proxy));

    if (fullObject !== undefined) {
      expect(object).toEqual(fullObject);
      expect(object).toEqual(proxy);
    }
  };

  callback(proxy, verify, reset, last);
};

test('basic', () => {
  const object = {
    foo: false,
    bar: {
      a: {
        b: 0,
        c: [1, 2],
      },
    },
  };

  let callCount = 0;

  const proxy = observe(object, () => {
    callCount++;
  });

  proxy.foo = true;
  expect(proxy.foo).toBe(true);
  expect(callCount).toBe(1);

  Object.defineProperty(proxy, 'newProp', {
    value: 'newProp',
  });
  expect(proxy.newProp).toBe('newProp');
  expect(callCount).toBe(2);

  Object.assign(proxy, { foo: false });
  expect(proxy.foo).toBe(false);
  expect(callCount).toBe(3);

  delete proxy.foo;
  expect(proxy.foo).toBe(undefined);
  expect(callCount).toBe(4);

  const previous = object.bar.a;
  proxy.bar.a = proxy.bar.a;
  expect(object.bar.a).toBe(previous);
});

for (const [index1, value1] of testValues.entries()) {
  for (const [index2, value2] of testValues.entries()) {
    if (index1 !== index2) {
      test(`should detect value changes from ${toString(value1)} to ${toString(value2)}`, () => {
        const object = {
          a: value1,
          b: [1, 2, value1],
        };

        testHelper(object, {}, (proxy, verify) => {
          proxy.a = value2;
          expect(proxy.a).toBe(value2);
          verify(1, proxy, ['a'], value1, value2);

          proxy.a = value2;
          verify(1, proxy, ['a'], value1, value2);

          proxy.b[2] = value2;
          expect(proxy.b[2]).toBe(value2);
          verify(2, proxy, ['b', '2'], value1, value2);

          proxy.b[2] = value2;
          verify(2, proxy, ['b', '2'], value1, value2);

          delete proxy.nonExistent;
          verify(2, proxy, ['b', '2'], value1, value2);

          delete proxy.b;
          expect(proxy.b).toBe(undefined);
          verify(3, proxy, ['b'], [1, 2, value2], undefined);
        });
      });
    }
  }
}

test('dates', () => {
  const object = {
    a: 0,
  };
  const date = new Date('1/1/2001');

  testHelper(object, {}, (proxy, verify) => {
    proxy.a = date;
    expect(proxy.a instanceof Date).toBe(true);
    verify(1, proxy, ['a'], 0, date);

    let clone = date.valueOf();
    proxy.a.setSeconds(32);
    verify(2, proxy, ['a'], new Date(clone), date);

    clone = date.valueOf();
    proxy.a.setHours(5);
    verify(3, proxy, ['a'], new Date(clone), date);

    proxy.a.setHours(5);
    verify(3, proxy, ['a'], new Date(clone), date);
  });
});

test('should trigger once when an array element is set with an array as the main object', () => {
  const object = [1, 2, { a: false }];

  testHelper(object, {}, (proxy, verify) => {
    proxy[0] = 'a';
    verify(1, proxy, ['0'], 1, 'a', ['a', 2, { a: false }]);
  });
});

test('should trigger once when a property of an array element is set with an array as the main object', () => {
  const object = [1, 2, { a: false }];

  testHelper(object, {}, (proxy, verify) => {
    proxy[2].a = true;
    verify(1, proxy, ['2', 'a'], false, true, [1, 2, { a: true }]);
  });
});

test('should trigger once when an array is sorted with an array as the main object', () => {
  const object = [2, 3, 1];

  testHelper(object, {}, (proxy, verify) => {
    proxy.sort();
    verify(1, proxy, [], [2, 3, 1], [1, 2, 3], [1, 2, 3]);
  });
});

test('should trigger once when an array is popped with an array as the main object', () => {
  const object = [2, 3, 1];

  testHelper(object, {}, (proxy, verify) => {
    proxy.pop();
    verify(1, proxy, [], [2, 3, 1], [2, 3], [2, 3]);
  });
});

test('should trigger once when an array is reversed with an array as the main object', () => {
  const object = [2, 3, 1];

  testHelper(object, {}, (proxy, verify) => {
    proxy.reverse();
    verify(1, proxy, [], [2, 3, 1], [1, 3, 2], [1, 3, 2]);
  });
});

test('should trigger once when an array is spliced with an array as the main object', () => {
  const object = [2, 3, 1];

  testHelper(object, {}, (proxy, verify) => {
    proxy.splice(1, 1, 'a', 'b');
    verify(1, proxy, [], [2, 3, 1], [2, 'a', 'b', 1], [2, 'a', 'b', 1]);
  });
});

test('invariants', () => {
  const object = {};

  Object.defineProperty(object, 'nonWritable', {
    configurable: false,
    writable: false,
    value: { a: true },
  });
  Object.defineProperty(object, 'nonReadable', {
    configurable: false,
    set: () => {},
  });
  Object.defineProperty(object, 'useAccessor', {
    configurable: false,
    set(value) {
      this._useAccessor = value;
    },
    get() {
      return this._useAccessor;
    },
  });

  testHelper(object, {}, (proxy, verify) => {
    expect(proxy.nonWritable).toBe(object.nonWritable);
    expect(proxy.nonReadable).toBe(undefined);

    proxy.useAccessor = 10;
    verify(1, proxy, ['_useAccessor'], undefined, 10);

    proxy.useAccessor = 20;
    verify(2, proxy, ['_useAccessor'], 10, 20);
  });
});

test('the change handler is called after the change is done', () => {
  const proxy = observe({ x: 0 }, () => {
    expect(proxy.x).toBe(1);
  });

  proxy.x = 1;
});

test('the callback should provide the original proxied object, the path to the changed value, the previous value at path, and the new value at path', () => {
  const object = {
    x: {
      y: [
        {
          z: 0,
        },
      ],
    },
  };

  testHelper(object, {}, (proxy, verify, reset, last) => {
    proxy.x.y[0].z = 1;
    verify(1, proxy, ['x', 'y', '0', 'z'], 0, 1);

    proxy.x.y[0].new = 1;
    verify(2, proxy, ['x', 'y', '0', 'new'], undefined, 1);

    delete proxy.x.y[0].new;
    verify(3, proxy, ['x', 'y', '0', 'new'], 1, undefined);

    proxy.x.y.push('pushed');
    verify(4, proxy, ['x', 'y'], [{ z: 1 }], [{ z: 1 }, 'pushed']);

    proxy.x.y.pop();
    verify(5, proxy, ['x', 'y'], [{ z: 1 }, 'pushed'], [{ z: 1 }]);

    proxy.x.y.unshift('unshifted');
    verify(6, proxy, ['x', 'y'], [{ z: 1 }], ['unshifted', { z: 1 }]);

    proxy.x.y.shift();
    verify(7, proxy, ['x', 'y'], ['unshifted', { z: 1 }], [{ z: 1 }]);

    proxy.x.y = proxy.x.y.concat([{ z: 3 }, { z: 2 }]);
    verify(8, proxy, ['x', 'y'], [{ z: 1 }], [{ z: 1 }, { z: 3 }, { z: 2 }]);

    proxy.x.y.sort((a, b) => a.z - b.z);
    verify(9, proxy, ['x', 'y'], [{ z: 1 }, { z: 3 }, { z: 2 }], [{ z: 1 }, { z: 2 }, { z: 3 }]);

    proxy.x.y.reverse();
    verify(10, proxy, ['x', 'y'], [{ z: 1 }, { z: 2 }, { z: 3 }], [{ z: 3 }, { z: 2 }, { z: 1 }]);

    proxy.x.y.forEach(item => item.z++);
    verify(11, proxy, ['x', 'y'], [{ z: 3 }, { z: 2 }, { z: 1 }], [{ z: 4 }, { z: 3 }, { z: 2 }]);

    proxy.x.y.splice(1, 2);
    verify(12, proxy, ['x', 'y'], [{ z: 4 }, { z: 3 }, { z: 2 }], [{ z: 4 }]);

    let unproxied = observed(proxy);

    expect(unproxied).toBe(object);
    expect(unproxied).not.toBe(proxy);
    expect(unproxied).toEqual(proxy);

    unproxied = observed(unproxied);

    expect(unproxied).toBe(object);
    expect(unproxied).not.toBe(proxy);
    expect(unproxied).toEqual(proxy);

    proxy.foo = function () {
      proxy.x.y[0].z = 2;
    };

    expect(last.count).toBe(13);

    proxy.foo();
    expect(last.thisArg).toBe(proxy);
    expect(last.path).toEqual([]);
    expect(last.count).toBe(14);
  });
});

test('the callback should not get called when methods are called that don’t mutate the proxied item', () => {
  const object = [
    {
      y: 1,
    },
    {
      y: 2,
    },
    {
      y: 3,
    },
  ];

  testHelper(object, {}, (proxy, verify) => {
    proxy.map(item => item.y);
    verify(0);

    proxy.reduce((result, item) => {
      result.push(item.y);
      return result;
    }, []);
    verify(0);

    proxy.slice(0, 1);
    verify(0);
  });
});

test('the callback should return a raw value when apply traps are triggered', () => {
  const object = {
    x: {
      y: [
        {
          z: 0,
        },
      ],
    },
  };

  testHelper(object, {}, (proxy, verify, reset, last) => {
    proxy.x.y.push('pushed');
    verify(1, proxy, ['x', 'y'], [{ z: 0 }], [{ z: 0 }, 'pushed']);

    last.value.pop();
    expect(last.count).toBe(1);
  });
});

test('the callback should trigger when a Symbol is used as the key and ignoreSymbols is not set', () => {
  const object = {
    x: {
      y: [
        {
          z: 0,
        },
      ],
    },
  };

  testHelper(object, {}, (proxy, verify) => {
    const SYMBOL = Symbol('test');
    const SYMBOL2 = Symbol('test2');

    proxy[SYMBOL] = true;
    verify(1, proxy, [SYMBOL], undefined, true);

    Object.defineProperty(proxy, SYMBOL2, {
      value: true,
      configurable: true,
      writable: true,
      enumerable: false,
    });
    verify(2, proxy, [SYMBOL2], undefined, true);

    delete proxy[SYMBOL2];
    verify(3, proxy, [SYMBOL2], true, undefined);

    proxy.z = true;
    verify(4, proxy, ['z'], undefined, true);
  });
});

test('should not trigger the callback when a Symbol is used as the key and ignoreSymbols is true', () => {
  const object = {
    x: {
      y: [
        {
          z: 0,
        },
      ],
    },
  };

  testHelper(object, { ignoreSymbols: true }, (proxy, verify) => {
    const SYMBOL = Symbol('test');
    const SYMBOL2 = Symbol('test2');
    const object2 = {
      c: 2,
    };

    proxy[SYMBOL] = object2;
    verify(0);

    expect(proxy[SYMBOL]).toBe(object2);

    proxy[SYMBOL].c = 3;
    verify(0);

    Object.defineProperty(proxy, SYMBOL2, {
      value: true,
      configurable: true,
      writable: true,
      enumerable: false,
    });
    verify(0);

    delete proxy[SYMBOL2];
    verify(0);

    proxy.z = true;
    verify(1, proxy, ['z'], undefined, true);
  });
});

test('should not trigger the callback when a key is used that is in ignoreKeys', () => {
  const object = {
    x: {
      y: [
        {
          z: 0,
        },
      ],
    },
  };

  testHelper(object, { ignoreKeys: ['a', 'b'] }, (proxy, verify) => {
    const object2 = {
      c: 2,
    };

    proxy.a = object2;
    verify(0);

    expect(proxy.a).toBe(object2);

    proxy.a.c = 3;
    verify(0);

    Object.defineProperty(proxy, 'b', {
      value: true,
      configurable: true,
      writable: true,
      enumerable: false,
    });
    verify(0);

    delete proxy.b;
    verify(0);

    proxy.z = true;
    verify(1, proxy, ['z'], undefined, true);
  });
});

test('should not trigger the callback when a key with an underscore is used and ignoreUnderscores is true', () => {
  const object = {
    x: {
      y: [
        {
          z: 0,
        },
      ],
    },
  };

  testHelper(object, { ignoreUnderscores: true }, (proxy, verify) => {
    const object2 = {
      c: 2,
    };

    proxy._a = object2;
    verify(0);

    expect(proxy._a).toBe(object2);

    proxy._a.c = 3;
    verify(0);

    Object.defineProperty(proxy, '_b', {
      value: true,
      configurable: true,
      writable: true,
      enumerable: false,
    });
    verify(0);

    delete proxy._b;
    verify(0);

    proxy.z = true;
    verify(1, proxy, ['z'], undefined, true);
  });
});

test('should not call the callback for nested items if isShallow is true', () => {
  const object = {
    x: {
      y: [
        {
          z: 0,
        },
      ],
    },
  };

  testHelper(object, { isShallow: true }, (proxy, verify) => {
    proxy.a = 1;
    verify(1, proxy, ['a'], undefined, 1);

    proxy.x.new = 1;
    verify(1, proxy, ['a'], undefined, 1);

    proxy.x.y[0].new = 1;
    verify(1, proxy, ['a'], undefined, 1);

    proxy.a = 2;
    verify(2, proxy, ['a'], 1, 2);
  });
});

test('should allow nested proxied objects', () => {
  const object1 = {
    x: {
      y: [
        {
          z: 0,
        },
      ],
    },
  };
  const object2 = {
    a: {
      b: [
        {
          c: 0,
        },
      ],
    },
  };

  let callCount1 = 0;
  let returnedObject1;
  let returnedPath1;
  let returnedPrevious1;
  let returnedValue1;

  let callCount2 = 0;
  let returnedObject2;
  let returnedPath2;
  let returnedPrevious2;
  let returnedValue2;

  const proxy1 = observe(
    object1,
    function (path, previous, value) {
      returnedObject1 = this;
      returnedPath1 = path;
      returnedPrevious1 = previous;
      returnedValue1 = value;
      callCount1++;
    },
    {},
  );
  const proxy2 = observe(
    object2,
    function (path, previous, value) {
      returnedObject2 = this;
      returnedPath2 = path;
      returnedPrevious2 = previous;
      returnedValue2 = value;
      callCount2++;
    },
    {},
  );

  proxy1.x.y[0].z = 1;
  expect(returnedObject1).toBe(proxy1);
  expect(returnedPath1).toEqual(['x', 'y', '0', 'z']);
  expect(returnedPrevious1).toBe(0);
  expect(returnedValue1).toBe(1);
  expect(callCount1).toBe(1);
  expect(callCount2).toBe(0);

  proxy2.a.b[0].c = 1;
  expect(returnedObject2).toBe(proxy2);
  expect(returnedPath2).toEqual(['a', 'b', '0', 'c']);
  expect(returnedPrevious2).toBe(0);
  expect(returnedValue2).toBe(1);
  expect(callCount1).toBe(1);
  expect(callCount2).toBe(1);

  proxy1.g = proxy2;
  expect(returnedObject1).toBe(proxy1);
  expect(returnedPath1).toEqual(['g']);
  expect(returnedPrevious1).toBe(undefined);
  expect(returnedValue1).toBe(proxy2);
  expect(callCount1).toBe(2);
  expect(callCount2).toBe(1);

  proxy1.g.a.b[0].c = 2;
  expect(returnedObject1).toBe(proxy1);
  expect(returnedPath1).toEqual(['g', 'a', 'b', '0', 'c']);
  expect(returnedPrevious1).toBe(1);
  expect(returnedValue1).toBe(2);
  expect(callCount1).toBe(3);

  expect(returnedObject2).toBe(proxy2);
  expect(returnedPath2).toEqual(['a', 'b', '0', 'c']);
  expect(returnedPrevious2).toBe(1);
  expect(returnedValue2).toBe(2);
  expect(callCount2).toBe(2);
});

test('should be able to mutate itself in an object', () => {
  const method = proxy => {
    proxy.x++;
  };

  const object = {
    x: 0,
    method,
  };

  testHelper(object, {}, (proxy, verify) => {
    proxy.method(proxy);
    verify(1, proxy, [], { x: 0, method }, { x: 1, method });
  });
});

test('should be able to mutate itself in a class', () => {
  class TestClass {
    constructor(x) {
      this.x = x || 0;
    }

    method() {
      this.x++;
    }
  }

  testHelper(new TestClass(), {}, (proxy, verify) => {
    proxy.method();
    verify(1, proxy, [], { x: 0 }, { x: 1 });
  });
});

test('should not trigger after unobserve is called', () => {
  const object = {
    x: {
      y: [
        {
          z: 0,
        },
      ],
    },
  };

  testHelper(object, {}, (proxy, verify, reset) => {
    proxy.z = true;
    verify(1, proxy, ['z'], undefined, true);

    let unobserved = unobserve(proxy);
    reset();

    proxy.z = false;
    verify(0);

    unobserved.x.y[0].z = true;
    verify(0);

    unobserved = unobserve(unobserved);

    unobserved.x.y[0].z = true;
    verify(0);
  });
});

test('should trigger if a new property is set to undefined', () => {
  const object = {
    x: true,
  };

  testHelper(object, {}, (proxy, verify) => {
    proxy.z = undefined;
    verify(1, proxy, ['z'], undefined, undefined);
  });
});

test('should NOT trigger if defining a property fails', () => {
  const object = {
    x: true,
  };

  Object.freeze(object);

  testHelper(object, {}, (proxy, verify) => {
    try {
      Object.defineProperty(proxy, 'y', {
        configurable: false,
        writable: false,
        value: false,
      });
    } catch (error) {
      //
    }
    verify(0, undefined, undefined, undefined, undefined);
  });
});

test('should NOT trigger if defining a property that is already set', () => {
  const object = {};

  Object.defineProperty(object, 'x', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: 1,
  });

  Object.defineProperty(object, 'y', {
    configurable: true,
    value: 2,
  });

  testHelper(object, {}, (proxy, verify) => {
    Object.defineProperty(proxy, 'x', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: 1,
    });
    verify(0);

    Object.defineProperty(proxy, 'y', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: 2,
    });
    verify(0);
  });
});

test('should NOT trigger if setting a property fails', () => {
  const object = {
    x: true,
  };

  Object.freeze(object);

  testHelper(object, {}, (proxy, verify) => {
    proxy.x = false;

    verify(0, undefined, undefined, undefined, undefined);
  });
});

test('should NOT trigger if deleting a property fails', () => {
  const object = {
    x: true,
  };

  Object.freeze(object);

  testHelper(object, {}, (proxy, verify) => {
    delete proxy.x;

    verify(0);
  });
});

// https://github.com/sindresorhus/on-change/issues/50
test('the callback should provide correct path when changes in setter', () => {
  const object = {
    _something: 'hello world',

    get something() {
      return this._something;
    },
    set something(val) {
      this._something = val;
    },
  };

  testHelper(object, {}, (proxy, verify) => {
    proxy.something = 'goodbye world';

    verify(1, proxy, ['_something'], 'hello world', 'goodbye world');
  });
});

// https://github.com/sindresorhus/on-change/issues/60
test('infinite loops should be avoided when call function in callback', () => {
  const object = {
    arr: [],
    foo: true,
  };

  const proxy = observe(
    object,
    function (path, previous, value) {
      this.arr.map(item => {});

      expect(path).toEqual(['arr']);
      expect(previous).toEqual([]);
      expect(value).toEqual(['value']);
    },
    {},
  );

  proxy.arr.unshift('value');
});
