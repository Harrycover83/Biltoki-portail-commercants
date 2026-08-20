import { getSupabaseClient } from '@/lib/supabase'
import { calculateInvoiceStatus } from '@/lib/invoiceStatus'

export interface Invoice {
  id: string
  allocationId: string
  merchantId: string
  amount: number
  amountPaid: number
  status: string
  issuedAt: string
  dueAt: string
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  paidAt: string
  createdAt: string
}

/**
 * Get invoices for current merchant for current month
 */
export async function getCurrentMonthInvoices(
  merchantId: string
): Promise<Invoice[]> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase not configured')

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('merchant_id', merchantId)
    .gte('issued_at', firstDay.toISOString())
    .lte('issued_at', lastDay.toISOString())
    .order('issued_at', { ascending: false })

  if (error) throw error
  return data as Invoice[]
}

/**
 * Get all invoices for current merchant, grouped by month
 */
export async function getAllInvoicesByMonth(
  merchantId: string
): Promise<Map<string, Invoice[]>> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('issued_at', { ascending: false })

  if (error) throw error

  const invoices = data as Invoice[]
  const grouped = new Map<string, Invoice[]>()

  for (const invoice of invoices) {
    const date = new Date(invoice.issuedAt)
    const monthKey = date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
    })

    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, [])
    }
    grouped.get(monthKey)!.push(invoice)
  }

  return grouped
}

/**
 * Get payments for an invoice
 */
export async function getInvoicePayments(invoiceId: string): Promise<Payment[]> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: false })

  if (error) throw error
  return data as Payment[]
}

/**
 * Create invoice from allocation
 */
export async function createInvoice(
  allocationId: string,
  merchantId: string,
  amount: number
): Promise<Invoice> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase not configured')

  const now = new Date()
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

  const { data, error } = await supabase
    .from('invoices')
    .insert([
      {
        allocation_id: allocationId,
        merchant_id: merchantId,
        amount,
        amount_paid: 0,
        status: 'unpaid',
        issued_at: now.toISOString(),
        due_at: dueDate.toISOString(),
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data as Invoice
}

/**
 * Record payment for invoice
 */
export async function recordPayment(
  invoiceId: string,
  amount: number
): Promise<Invoice> {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase not configured')

  // First, get the invoice
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .select('amount, amount_paid')
    .eq('id', invoiceId)
    .single()

  if (invoiceError) throw invoiceError

  const invoice = invoiceData as { amount: number; amount_paid: number }
  const newAmountPaid = invoice.amount_paid + amount
  const newStatus = calculateInvoiceStatus(invoice.amount, newAmountPaid)

  // Create payment record
  const { error: paymentError } = await supabase.from('payments').insert([
    {
      invoice_id: invoiceId,
      amount,
      paid_at: new Date().toISOString(),
    },
  ])

  if (paymentError) throw paymentError

  // Update invoice status and amount_paid
  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update({
      amount_paid: newAmountPaid,
      status: newStatus,
    })
    .eq('id', invoiceId)
    .select()
    .single()

  if (updateError) throw updateError
  return updatedInvoice as Invoice
}
