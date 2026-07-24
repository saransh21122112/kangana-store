import path from "node:path"
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"

import type { Bill, Customer } from "@/lib/generated/prisma/client"

export interface BillInvoiceProps {
  bill: Bill & { customer: Customer }
  storeName: string
}

const ACCENT = "#C4326B"
const GOLD = "#B8862E"
const INK = "#2B1620"
const MUTED = "#7D5C61"
const BORDER = "#F0DCD8"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    color: INK,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `2pt solid ${ACCENT}`,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    height: 28,
    width: 61,
  },
  storeName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: INK,
  },
  invoiceLabel: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    textAlign: "right",
  },
  billNo: {
    fontSize: 10,
    color: MUTED,
    textAlign: "right",
    marginTop: 2,
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  block: {
    flexDirection: "column",
    gap: 3,
  },
  blockLabel: {
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  blockValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  blockSub: {
    fontSize: 10,
    color: MUTED,
  },
  table: {
    borderTop: `1pt solid ${BORDER}`,
    borderBottom: `1pt solid ${BORDER}`,
    marginBottom: 24,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: "#FBF3EF",
  },
  colCategory: { flex: 3 },
  colAmount: { flex: 1, textAlign: "right" },
  tableHeaderText: {
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginBottom: 40,
  },
  totalLabel: {
    fontSize: 12,
    color: MUTED,
  },
  totalValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 9,
    color: MUTED,
    borderTop: `1pt solid ${BORDER}`,
    paddingTop: 12,
  },
})

/**
 * PDF text uses the built-in Helvetica base font, which has no glyph for
 * the ₹ sign (U+20B9) — `Intl`'s "currency" style renders it as ₹ and
 * @react-pdf/renderer falls back to a mangled substitute glyph. "Rs. " is
 * used instead of embedding a custom Unicode font just for one symbol.
 */
function formatCurrency(amount: number): string {
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
}

/** Absolute filesystem path to the store logo — @react-pdf/renderer's
 * <Image> accepts a local path directly in the Node runtime this route
 * runs in (App Router API routes default to the Node runtime). Uses the
 * trimmed wordmark (whitespace border cropped out), not the raw source
 * asset — at this print size the untrimmed version's fine detail was
 * illegible, same issue fixed on the login page and Sidebar. */
const LOGO_PATH = path.join(process.cwd(), "public", "kangna-logo-mark.png")

export function BillInvoiceDocument({ bill, storeName }: BillInvoiceProps) {
  return (
    <Document title={`Bill ${bill.billNo}`}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.storeRow}>
            <Image src={LOGO_PATH} style={styles.logo} />
            <Text style={styles.storeName}>{storeName}</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>Invoice</Text>
            <Text style={styles.billNo}>{bill.billNo}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Billed To</Text>
            <Text style={styles.blockValue}>{bill.customer.name}</Text>
            <Text style={styles.blockSub}>{bill.customer.mobileNumber}</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Date</Text>
            <Text style={styles.blockValue}>{formatDate(bill.date)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderText, styles.colCategory]}>Category</Text>
            <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colCategory}>{bill.category}</Text>
            <Text style={styles.colAmount}>{formatCurrency(bill.amount)}</Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(bill.amount)}</Text>
        </View>

        <Text style={styles.footer}>Thank you for shopping with {storeName}.</Text>
      </Page>
    </Document>
  )
}
