import svelte from 'rollup-plugin-svelte';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
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
      // enable run-time checks when not in production
      dev: !production,
      // we'll extract any component CSS out into
      // a separate file — better for performance
      css: (css) => {
        css.write('docs/bundle.css');
      },
    }),
    nodeResolve(),
    commonjs(),
    progress(),
    analyze({ summaryOnly: true, limit: 10 }),
    production && terser(),
  ],
};
