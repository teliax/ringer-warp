/**
 * Adapter to transform API Customer data to match Polymet UI CustomerAccount type
 */

import type { Customer } from "@/hooks/useCustomers";
import type { CustomerAccount } from "@/polymet/data/admin-mock-data";

export function apiCustomerToPolymetAccount(customer: Customer): CustomerAccount {
  return {
    id: customer.id,
    companyName: customer.company_name,
    contactName: customer.contact?.name || "",
    email: customer.contact?.email || "",
    contactEmail: customer.contact?.email || "",
    phone: customer.contact?.phone || "",
    contactPhone: customer.contact?.phone || "",
    accountNumber: customer.ban,
    status: customer.status.toLowerCase() as "active" | "suspended" | "inactive",
    tier: customer.tier.toLowerCase() as "enterprise" | "business" | "standard" | "basic",
    createdDate: customer.created_at,
    lastActivity: customer.updated_at,
    monthlySpend: Math.abs(customer.current_balance), // Mock uses positive for spend
    creditLimit: customer.credit_limit || 0,
    currentBalance: customer.current_balance,
    balance: customer.current_balance,
    warningThreshold: (customer.credit_limit || 0) * 0.8,
    products: {
      trunks: 0, // TODO: Get from customer_trunks relationship
      numbers: 0, // TODO: Get from customer_dids relationship
      messaging: false, // TODO: Determine from customer config
      telecomData: false,
    },
    productsList: [], // TODO: Build from products
    address: {
      street: customer.address?.line1 || "",
      city: customer.address?.city || "",
      state: customer.address?.state || "",
      zip: customer.address?.zip || "",
      country: customer.address?.country || "USA",
    },
  };
}

export function apiCustomersToPolymetAccounts(customers: Customer[]): CustomerAccount[] {
  return customers.map(apiCustomerToPolymetAccount);
}
