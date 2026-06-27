import type { UserModule } from '~/types'

const RELOAD_MARKER = 'edtaxi:driver:chunk-reload'

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : String(error)

  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)
}

export const install: UserModule = ({ router }) => {
  router.onError((error) => {
    if (!isChunkLoadError(error))
      return

    if (sessionStorage.getItem(RELOAD_MARKER) === '1')
      return

    sessionStorage.setItem(RELOAD_MARKER, '1')
    window.location.reload()
  })

  router.afterEach(() => {
    sessionStorage.removeItem(RELOAD_MARKER)
  })
}
