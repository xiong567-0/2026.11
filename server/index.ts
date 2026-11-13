import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app'

const DEFAULT_PORT = 8787
const parsedPort = Number.parseInt(process.env.PORT ?? '', 10)
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT

const distDir = fileURLToPath(new URL('../dist/', import.meta.url))

/** API 路径永远走 JSON 路由，不交给静态资源处理 */
function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/')
}

const app = createApp()

if (existsSync(distDir)) {
  const assets = serveStatic({ root: distDir })
  const index = serveStatic({ root: distDir, path: 'index.html' })

  app.use('*', (c, next) => (isApiPath(c.req.path) ? next() : assets(c, next)))
  // 前端是单页应用：找不到静态文件时回退到 index.html
  app.get('*', (c, next) => (isApiPath(c.req.path) ? next() : index(c, next)))
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`微语 API 已启动：http://localhost:${info.port}`)
})
