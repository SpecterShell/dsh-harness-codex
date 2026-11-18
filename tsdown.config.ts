// The client build only: tsc owns lib/index.js and the per-row modules, and
// tsdown wraps src/client.ts into the CJS ModuleLoader registration that DSH
// executes in the page. clean stays off so it never deletes tsc's output.
import { defineConfig } from 'tsdown'

export default defineConfig({
  // The installed client entry adds the settings form, whose React and
  // ui-primitives imports resolve from the browser module table.
  entry: { client: 'src/client.ts' },
  outDir: 'lib',
  format: 'cjs',
  inputOptions: { platform: 'browser' },
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  target: 'chrome120',
  dts: false,
  sourcemap: false,
  clean: false,
  outExtensions: () => ({ js: '.js' }),
  outputOptions: {
    // DSH reconciles this registration against the package name, so the id
    // must match `name` in package.json. A stale id fails client activation
    // with "loaded without registering".
    banner: 'window.__ModuleLoader__.load({ id: "@spectershell/dsh-harness-codex", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
})
