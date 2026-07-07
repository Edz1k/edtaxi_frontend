// Username водительского бота (без @) — для реферальных диплинков
// t.me/<bot>?startapp=... Переопределяется через VITE_TG_BOT_USERNAME.
export const TG_BOT_USERNAME
  = (import.meta.env.VITE_TG_BOT_USERNAME as string | undefined) || 'drivertaximinibot'
