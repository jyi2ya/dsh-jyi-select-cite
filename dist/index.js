// Host half of dsh-jyi-select-cite: serves the review preset table to the
// client so editing presets.json applies on the next box open, with no dsh
// restart and no page refresh. A local presets.json wins; the committed
// presets.example.json answers when it is absent.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOCAL_PATH = join(ROOT, 'presets.json')
const EXAMPLE_PATH = join(ROOT, 'presets.example.json')

/** 优先读本地 presets.json；文件不存在时用仓库里的示例表。 */
async function readPresets() {
  try {
    return await readFile(LOCAL_PATH, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return readFile(EXAMPLE_PATH, 'utf8')
  }
}

export const name = 'dsh-jyi-select-cite'
export const inject = ['connection']

export function apply(ctx) {
  const dispose = ctx.connection.fetch.register({
    path: '/api/select-cite/presets',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      try {
        const presets = JSON.parse(await readPresets())
        if (!Array.isArray(presets)) throw new Error('presets must be a JSON array')
        return Response.json(
          { ok: true, presets },
          { status: 200, headers: { 'cache-control': 'no-store' } },
        )
      } catch (error) {
        ctx.logger.warn('select-cite: presets read failed: %s', error instanceof Error ? error.message : String(error))
        return Response.json(
          { ok: false, error: 'could not read presets' },
          { status: 500, headers: { 'cache-control': 'no-store' } },
        )
      }
    },
  })
  ctx.effect(() => () => dispose())
  ctx.logger.info('select-cite: presets route registered at /api/select-cite/presets')
}
