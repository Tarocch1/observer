import commonjs from '@rollup/plugin-commonjs';
import pkg from './package.json';

const input = './index.js';

export default [
  { input, output: { file: pkg.main, format: 'cjs', exports: 'default' }, plugins: [commonjs()] },
  { input, output: { file: pkg.module, format: 'es' }, plugins: [commonjs()] },
  { input, output: { file: pkg['umd:main'], format: 'umd', name: 'Observer' }, plugins: [commonjs()] },
];
