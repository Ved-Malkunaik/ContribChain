// Node 24's type stripping plus the same @/ alias as Next.js, without a second TS runtime.
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
const source=new URL('../src/',import.meta.url)
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith('@/')) {
    const target=new URL(specifier.slice(2),source)
    for(const extension of ['.ts','.tsx','.js','/index.js']) {
      const filename=fileURLToPath(target)+extension
      if(existsSync(filename)) return nextResolve(pathToFileURL(filename).href,context)
    }
    return nextResolve(target.href,context)
  }
  try {return nextResolve(specifier,context)} catch(error) {
    if(specifier.startsWith('next/') && !specifier.endsWith('.js')) return nextResolve(specifier+'.js',context)
    if(specifier.startsWith('.') && context.parentURL) {
      const target=new URL(specifier,context.parentURL)
      for(const extension of ['.ts','.tsx','.js','/index.js']) {
        const filename=fileURLToPath(target)+extension
        if(existsSync(filename)) return nextResolve(pathToFileURL(filename).href,context)
      }
    }
    throw error
  }
}})
