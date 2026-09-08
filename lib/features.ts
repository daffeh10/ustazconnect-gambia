// Keep deferred products reversible without removing their implementation or data.
export const DIASPORA_QURAN_ENABLED = false

// The 90-day Basic grace period is paused while we build tutor supply. The
// implementation stays in place: flip this back to true to re-arm it.
export const BASIC_TUTOR_GRACE_ENABLED = false

// The "Ask TutorConnect for Help" call to action on an empty search result.
// Turned off while support email volume is unmanageable; the searches behind it
// are still captured as marketplace_search funnel events, so demand is not lost.
export const TUTOR_SEARCH_HELP_ENABLED = false
