// Username водительского бота (без @) — для диплинков приглашения в парк
// (t.me/<bot>?startapp=park_<token>). QR ведёт именно в водительский мини-апп.
// Переопределяется через VITE_TG_DRIVER_BOT_USERNAME.
export const TG_DRIVER_BOT_USERNAME
  = (import.meta.env.VITE_TG_DRIVER_BOT_USERNAME as string | undefined) || 'cityflowdriver_bot'
