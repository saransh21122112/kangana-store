"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

/**
 * Thin wrapper around next-themes' ThemeProvider.
 * Class-based dark mode: toggles the `dark` class on <html>, which
 * app/globals.css's `@custom-variant dark (&:is(.dark *))` hooks into.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
