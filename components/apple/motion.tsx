"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

// App-wide route transitions live in app/(app)/template.tsx (Next.js's
// `template.tsx` convention), not here — see that file for why an
// AnimatePresence + `key={pathname}` version of this used to live in this
// file and was replaced.

const listVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
}

export interface StaggerListProps {
  children: React.ReactNode
  className?: string
}

/** Wrap a list; wrap each child in <StaggerItem> for a fade-in cascade. */
export function StaggerList({ children, className }: StaggerListProps) {
  return (
    <motion.div initial="hidden" animate="show" variants={listVariants} className={className}>
      {children}
    </motion.div>
  )
}

export interface StaggerItemProps {
  children: React.ReactNode
  className?: string
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  )
}
