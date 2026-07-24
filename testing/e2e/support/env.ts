function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name} — copy .env.test.local.example (if present) or set it yourself. ` +
        `See testing/e2e/README.md.`
    )
  }
  return value
}

export const OWNER_EMAIL = requireEnv("E2E_OWNER_EMAIL")
export const OWNER_PASSWORD = requireEnv("E2E_OWNER_PASSWORD")
