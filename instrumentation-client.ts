import posthog from 'posthog-js'

if (typeof window !== 'undefined') {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  if (key) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim(),
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
    })
  }
}

export { posthog }
