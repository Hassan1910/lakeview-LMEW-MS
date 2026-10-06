export function quotationTotals(items: { quantity: number; unit_price: number }[], taxRate: number, discount: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const tax_amount = subtotal * (taxRate / 100);
  const total = subtotal + tax_amount - discount;
  return { subtotal, tax_amount, total };
}

export function invoiceAfterPayment(total: number, confirmedAmounts: number[]) {
  const amount_paid = confirmedAmounts.reduce((sum, amount) => sum + amount, 0);
  const balance = total - amount_paid;
  const status = balance <= 0 ? 'paid' : amount_paid > 0 ? 'partially_paid' : 'issued';
  return { amount_paid, balance, status };
}
