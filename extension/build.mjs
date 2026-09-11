import { build } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'

const outdir = 'dist'

await rm(outdir, { recursive: true, force: true })
await mkdir(outdir)

await build({
  entryPoints: {
    content: 'src/content/main.ts',
    background: 'src/background.ts',
  },
  outdir,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: 'linked',
  logLevel: 'info',
})

await cp('manifest.json', `${outdir}/manifest.json`)
