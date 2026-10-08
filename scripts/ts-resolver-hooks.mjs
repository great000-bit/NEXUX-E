// Lets Node run the app's TypeScript tests: the app imports './options' without an extension, as Vite allows.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && /^\.{1,2}\//.test(specifier) && !/\.\w+$/.test(specifier)) {
      return next(`${specifier}.ts`, context)
    }
    throw error
  }
}
