<template>
  <div class="flex flex-wrap items-center gap-2">
    <span class="h-9 inline-flex items-center rounded-lg bg-white px-3.5" role="img" aria-label="Visa">
      <span class="text-lg text-#1434CB font-900 tracking-tight italic">VISA</span>
    </span>

    <span class="h-9 inline-flex items-center rounded-lg bg-white px-3">
      <svg class="h-5.5 w-8" viewBox="0 0 48 32" role="img" aria-label="Mastercard">
        <circle cx="19" cy="16" r="10" fill="#EB001B" />
        <circle cx="29" cy="16" r="10" fill="#F79E1B" />
        <path d="M24 7.34a10 10 0 0 1 0 17.32 10 10 0 0 1 0-17.32Z" fill="#FF5F00" />
      </svg>
    </span>

    <span class="h-9 inline-flex items-center gap-1 rounded-lg bg-white px-3 text-#111" role="img" aria-label="Apple Pay">
      <span class="i-mdi-apple text-xl" />
      <span class="text-sm font-700">Pay</span>
    </span>

    <span class="h-9 inline-flex items-center gap-1 rounded-lg bg-white px-3 text-#5f6368" role="img" aria-label="Google Pay">
      <span class="i-mdi-google text-lg" />
      <span class="text-sm font-700">Pay</span>
    </span>
  </div>
</template>
