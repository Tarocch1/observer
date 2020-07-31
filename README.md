# Observer

一个 Javascript 对象与数组观察器。基于 [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) API。

[![npm](https://img.shields.io/npm/v/@tarocch1/observer)](https://www.npmjs.com/package/@tarocch1/observer)
[![npm bundle size](https://img.shields.io/bundlephobia/min/@tarocch1/observer)](https://bundlephobia.com/result?p=@tarocch1/observer)
[![GitHub](https://img.shields.io/github/license/tarocch1/observer)](https://github.com/Tarocch1/observer/blob/master/LICENSE)
![Test Workflow](https://github.com/Tarocch1/observer/workflows/Test%20Workflow/badge.svg)

## Install

```bash
npm install @tarocch1/observer
```

## Usage

### Browser

```html
<script src="https://cdn.jsdelivr.net/npm/@tarocch1/observer/dist/index.umd.js"></script>
<script>
  const object = {
    foo: false,
    a: {
      b: [
        {
          c: false,
        },
      ],
    },
  };

  let i = 0;
  const observedObject = Observer.observe(object, function (path, previousValue, value) {
    console.log('Object changed:', ++i);
    console.log('this:', this);
    console.log('path:', path);
    console.log('previousValue:', previousValue);
    console.log('value:', value);
  });

  observedObject.foo = true;
  //=> 'Object changed: 1'
  //=> 'this: {
  //     foo: true,
  //     a: {
  //       b: [
  //         {
  //           c: false
  //         }
  //       ]
  //     }
  //   }'
  //=> 'path: ["foo"]'
  //=> 'previousValue: false'
  //=> 'value: true'
</script>
```

### Node.js

```js
const { observe, observed, unobserve } = require('@tarocch1/observer');

const object = {
  foo: false,
  a: {
    b: [
      {
        c: false,
      },
    ],
  },
};

let i = 0;
const observedObject = observe(object, function (path, previousValue, value) {
  console.log('Object changed:', ++i);
  console.log('this:', this);
  console.log('path:', path);
  console.log('previousValue:', previousValue);
  console.log('value:', value);
});

observedObject.foo = true;
//=> 'Object changed: 1'
//=> 'this: {
//     foo: true,
//     a: {
//       b: [
//         {
//           c: false
//         }
//       ]
//     }
//   }'
//=> 'path: ["foo"]'
//=> 'previousValue: false'
//=> 'value: true'

observedObject.a.b[0].c = true;
//=> 'Object changed: 2'
//=> 'this: {
//     foo: true,
//     a: {
//       b: [
//         {
//           c: true
//         }
//       ]
//     }
//   }'
//=> 'path: ["a", "b", "0", "c"]'
//=> 'previousValue: false'
//=> 'value: true'

// Access the original object
observed(observedObject).foo = false;
// Callback isn't called

// Unobserve
unobserve(observedObject);
observedObject.foo = 'bar';
// Callback isn't called
```

[![Edit Observer](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/observer-do87b?fontsize=14&hidenavigation=1&theme=dark)

## API

### observe(object, callback, options?)

设置对对象的观察，返回被观察对象。

#### object

Type: `object` | `array`

要观察的对象。

#### callback(path, previousValue, value)

Type: `Function`

对象发生变化时的回调。

##### path

Type: `Array<string | symbol>`

发生变化的属性的路径。

##### previousValue

Type: `any`

变化前的值。

##### value

Type: `any`

变化后的值。

#### options

Type: `object`

配置项。

##### isShallow

Type: `boolean`
Default: `false`

设置为 `true` 后，深层变化不会触发回调。

##### equals

Type: `Function`
Default: [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is)

用于判断值是否发生变化的函数，接受两个值，如果两个值不等，返回 `true`。

##### ignoreSymbols

Type: `boolean`
Default: `false`

设置为 `true` 后，属性名为 `Symbol` 的值发生变化不会触发回调。

##### ignoreUnderscores

Type: `boolean`
Default: `false`

设置为 `true` 后，属性名以下划线开头的值发生变化不会触发回调。

##### ignoreKeys

Type: `Array<string | symbol>`
Default: `[]`

属性名存在于该配置中的值发生变化时不会触发回调。

### observed(observedObject)

返回与被观察对象对应的原始对象，对原始对象进行操作不会触发回调。

#### observedObject

Type: `object`

由 `observe` 函数返回的被观察对象。

### unobserve(observedObject)

取消对被观察对象的观察，返回与被观察对象对应的原始对象，取消后对被观察对象进项操作不会触发回调。

#### observedObject

Type: `object`

由 `observe` 函数返回的被观察对象。

## Credit

本项目基于 [sindresorhus/on-change](https://github.com/sindresorhus/on-change)，进行了部分精简并修改了几个 bug。
