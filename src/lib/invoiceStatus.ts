/**
 * Invoice Status and Color Utilities
 */

// Define invoice status values as constants
export const INVOICE_STATUS_UNPAID = 'unpaid'
export const INVOICE_STATUS_PARTIALLY_PAID = 'partially_paid'
export const INVOICE_STATUS_PAID = 'paid'

export type InvoiceStatus = typeof INVOICE_STATUS_UNPAID | typeof INVOICE_STATUS_PARTIALLY_PAID | typeof INVOICE_STATUS_PAID

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

const statusConfigs: Record<InvoiceStatus, StatusConfig> = {
  [INVOICE_STATUS_UNPAID]: {
    label: 'À régler',
    color: 'red',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
  [INVOICE_STATUS_PARTIALLY_PAID]: {
    label: 'Partiellement réglée',
    color: 'orange',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
  },
  [INVOICE_STATUS_PAID]: {
    label: 'Réglée',
    color: 'green',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
  },
};

export function getStatusLabel(status: InvoiceStatus | string): string {
  const statusKey = status.toLowerCase() as InvoiceStatus;
  return statusConfigs[statusKey]?.label || status;
}

export function getStatusColor(status: InvoiceStatus | string): string {
  const statusKey = status.toLowerCase() as InvoiceStatus;
  return statusConfigs[statusKey]?.color || 'gray';
}

export function getStatusBgColor(status: InvoiceStatus | string): string {
  const statusKey = status.toLowerCase() as InvoiceStatus;
  return statusConfigs[statusKey]?.bgColor || 'bg-gray-50';
}

export function getStatusTextColor(status: InvoiceStatus | string): string {
  const statusKey = status.toLowerCase() as InvoiceStatus;
  return statusConfigs[statusKey]?.textColor || 'text-gray-700';
}

/**
 * Calculate invoice status based on amount and amount paid
 */
export function calculateInvoiceStatus(
  amount: number,
  amountPaid: number
): InvoiceStatus {
  if (amountPaid === 0) {
    return INVOICE_STATUS_UNPAID;
  }
  if (amountPaid >= amount) {
    return INVOICE_STATUS_PAID;
  }
  return INVOICE_STATUS_PARTIALLY_PAID;
}

/**
 * Get badge variant for Tailwind styling
 */
export function getStatusBadgeClass(status: InvoiceStatus | string): string {
  const statusKey = status.toLowerCase() as InvoiceStatus;
  return `${statusConfigs[statusKey]?.bgColor} ${statusConfigs[statusKey]?.textColor}`;
}
