import {defineConfig, loadEnv} from 'vite'
import vue from '@vitejs/plugin-vue'
import {resolve} from 'path'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import {replaceCodePlugin} from 'vite-plugin-replace'
import UnoCSS from 'unocss/vite'
import packageInfo from './package.json'
import yaml from '@rollup/plugin-yaml'

export default defineConfig(({command, mode}) => {
  const env = loadEnv(mode, process.cwd(), '')
  let outDir = process.env.OUT_DIR || './dist'

  const config: any = {
    entry: './build-app.ts',
    name: 'app',
    fileName: 'app',
    formats: ['es'],
  }

  return {
    // mode: process.env.UI ? '': 'myserver',
    resolve: {
      alias: [
        {find: '~/', replacement: resolve(__dirname, '/')},
        {find: '@', replacement: resolve(__dirname, './src')},
        // {find: '@', replacement: resolve(__dirname, './../directus-origin/app/src')},
      ],
    },
    build: {
      outDir,
      assetsDir: '',
      emptyOutDir: false,
      lib: {
        ...config,
      },
      rollupOptions: {
        external: [
          'vue',
          '@directus/extensions-sdk',
          'pinia',
          'vue-i18n',
          'vue-router',
        ],
        output: {},
      },
      commonjsOptions: {
        esmExternals: true,
      },
    },
    plugins: [
      vue(),
      yaml({
        transform(data) {
          return data === null ? {} : undefined
        },
      }),
      UnoCSS(),
      cssInjectedByJsPlugin(),
      replaceCodePlugin({
        replacements: [
          {
            from: '%%version%%',
            to: packageInfo.version,
          },
        ],
      }),
    ],
    define: {
      'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
    },
  }
})
