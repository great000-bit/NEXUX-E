// After the build: the not-found page. Vercel serves dist/404.html, with a real 404 status, for any address that no file or
// rewrite in vercel.json answers. It is the same app shell as index.html, so the router shows the site's own not-found page.
import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve(import.meta.dirname, '..', 'dist')
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'))
console.log('Wrote dist/404.html')
