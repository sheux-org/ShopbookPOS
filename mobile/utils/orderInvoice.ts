import type { StaffMember } from "../hooks/useStaff";

/** Parses stored invoice strings like `INV-123456 (Staff: Name | Cust: ...)` */
export function getInvoiceLabel(invoiceNumber: string): string {
  const m = invoiceNumber.match(/^(INV-\d+)/);
  if (m) return m[1];
  const firstSpace = invoiceNumber.indexOf(" ");
  if (firstSpace === -1) return invoiceNumber;
  return invoiceNumber.slice(0, firstSpace).trim() || invoiceNumber;
}

/** Value encoded on the receipt barcode (CODE128). Uses invoice label (e.g. INV-589824) when available. */
export function getInvoiceBarcodeValue(invoiceNumber: string, orderId?: string): string {
  const label = getInvoiceLabel(invoiceNumber).trim();
  if (label.length > 0) {
    return label.length > 48 ? label.slice(0, 48) : label;
  }
  const head = invoiceNumber.trim().split(/\s+/)[0]?.slice(0, 48) ?? "";
  if (head.length > 0) return head;
  const idPart = (orderId ?? "").replace(/[^A-Za-z0-9]/g, "").slice(-16);
  return idPart.length > 0 ? idPart : "0";
}

export function getCashierNameFromInvoice(invoiceNumber: string): string {
  const idx = invoiceNumber.indexOf("Staff:");
  if (idx === -1) return "Cashier";
  let rest = invoiceNumber.slice(idx + "Staff:".length).trim();
  const parenEnd = rest.lastIndexOf(")");
  if (parenEnd !== -1) rest = rest.slice(0, parenEnd);
  const beforeCust = rest.split("|")[0]?.trim() ?? "";
  return beforeCust || "Cashier";
}

/** Legacy invoices used " · "; UI shows " / " between name and role. */
function normalizeStaffDisplaySeparators(line: string): string {
  return line.replace(/\s·\s/g, " / ");
}

/** Store owner line (avoid showing "Admin" twice). */
function isOwnerAdminOnlyLine(s: string): boolean {
  const compact = s.replace(/\s+/g, " ").trim();
  if (/^Owner \/ Admin$/i.test(compact)) return true;
  if (/^Owner \/ Admin \/ Admin$/i.test(compact)) return true;
  return false;
}

/** Adds role for legacy rows that only stored a name by matching local staff records. */
export function formatStaffDisplayLine(
  rawStaffPart: string,
  staffMembers: StaffMember[]
): string {
  const trimmed = rawStaffPart.trim();
  if (!trimmed) return "Staff";

  const withSlashes = normalizeStaffDisplaySeparators(trimmed);

  if (isOwnerAdminOnlyLine(withSlashes)) return "Owner / Admin";

  if (withSlashes.includes(" / ") || trimmed.includes(" · ")) {
    return withSlashes;
  }

  const lower = trimmed.toLowerCase();
  const match = staffMembers.find((s) => s.name.trim().toLowerCase() === lower);
  if (match) return `${match.name} / ${match.role}`;

  return trimmed;
}
