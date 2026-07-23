"use client"

import * as React from "react"
import { motion, type Variants } from "framer-motion"

export interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

/** Simple fade/slide-up wrapper for route/page content. */
export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

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
