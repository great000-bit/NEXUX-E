// Lets Node run the app's TypeScript tests: the app imports './options' without an extension, and '../i18n' for a folder
// with an index file, as Vite allows.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (error) {
    const relative = /^\.{1,2}\//.test(specifier) && !/\.\w+$/.test(specifier)
    if (relative && error?.code === 'ERR_MODULE_NOT_FOUND') return next(`${specifier}.ts`, context)
    if (relative && error?.code === 'ERR_UNSUPPORTED_DIR_IMPORT') return next(`${specifier}/index.ts`, context)
    throw error
  }
}
