import svelte from 'rollup-plugin-svelte';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import analyze from 'rollup-plugin-analyzer';
import progress from 'rollup-plugin-progress';

const production = !process.env.ROLLUP_WATCH;

export default {
  input: 'src/main.js',
  output: {
    sourcemap: true,
    format: 'iife',
    name: 'app',
    file: 'docs/bundle.js',
  },
  plugins: [
    svelte({
      dev: !production,
      css: (css) => {
        css.write();
      },
    }),
    nodeResolve(),
    commonjs(),
    progress(),
    production && analyze({ summaryOnly: true, limit: 10 }),
    production && terser(),
  ],
};
