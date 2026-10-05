import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { createDatabase } from './database.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const databasePath = process.env.DB_PATH || path.join(projectRoot, 'data', 'bidboard.sqlite')
const database = createDatabase(databasePath)
const isProduction = process.env.NODE_ENV === 'production'
const app = createApp(database, {
  isProduction,
  serveWeb: isProduction || process.argv.includes('--serve-web'),
  publicDirectory: path.join(projectRoot, 'dist'),
})
const port = Number(process.env.PORT || 3000)

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Bidboard server listening on http://localhost:${port}`)
  console.log(`SQLite database: ${databasePath}`)
})

function shutdown() {
  server.close(() => {
    database.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)