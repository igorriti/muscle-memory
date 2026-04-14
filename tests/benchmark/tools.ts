/**
 * 200 e-commerce tools for the muscle-memory benchmark.
 *
 * Organized by domain. Every tool has:
 *  - Realistic Zod parameter schema
 *  - Mock `execute` that returns plausible data instantly
 */
import { tool } from 'ai';
import { z } from 'zod';

// ── Helpers ──

const s = (d: string) => z.string().describe(d);
const n = (d: string) => z.number().describe(d);
const os = (d: string) => z.string().describe(d).optional();
const on = (d: string) => z.number().describe(d).optional();
const ob = (d: string) => z.boolean().describe(d).optional();

function t(
  description: string,
  params: z.ZodRawShape,
  mock: (a: any) => any,
) {
  return tool({
    description,
    inputSchema: z.object(params),
    execute: async (a: any) => mock(a),
  });
}

// ════════════════════════════════════════════
//  PRODUCTS  (25 tools)
// ════════════════════════════════════════════

const products = {
  search_products: t('Search the product catalog by keyword', {
    query: s('Search keywords'), category: os('Category filter'), min_price: on('Min price'), max_price: on('Max price'),
  }, ({ query }: any) => ({ results: [{ id: 'PROD-101', name: `${query} Pro`, price: 29.99, rating: 4.5 }], total: 47 })),

  get_product: t('Get detailed product information by ID', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, name: 'Premium Widget', price: 49.99, stock: 23, rating: 4.7, category: 'Electronics', description: 'High-quality widget' })),

  list_categories: t('List all product categories', {
    parent_id: os('Parent category ID for subcategories'),
  }, () => ({ categories: [{ id: 'CAT-1', name: 'Electronics' }, { id: 'CAT-2', name: 'Clothing' }, { id: 'CAT-3', name: 'Home' }] })),

  get_category: t('Get category details', {
    category_id: s('Category ID'),
  }, ({ category_id }: any) => ({ category_id, name: 'Electronics', product_count: 1247, subcategories: ['Phones', 'Laptops', 'Accessories'] })),

  compare_products: t('Compare two or more products side by side', {
    product_ids: z.array(s('Product ID')).describe('List of product IDs to compare'),
  }, ({ product_ids }: any) => ({ comparison: product_ids.map((id: string) => ({ id, price: 29.99, rating: 4.5 })) })),

  get_product_reviews: t('Get reviews for a product', {
    product_id: s('Product ID'), limit: on('Max reviews'),
  }, ({ product_id }: any) => ({ product_id, reviews: [{ rating: 5, text: 'Great product!', author: 'John' }], average: 4.5, count: 128 })),

  get_price_history: t('Get historical price data for a product', {
    product_id: s('Product ID'), days: on('Number of days of history'),
  }, ({ product_id }: any) => ({ product_id, history: [{ date: '2024-01-01', price: 59.99 }, { date: '2024-06-01', price: 49.99 }] })),

  get_related_products: t('Get products related to a given product', {
    product_id: s('Product ID'), limit: on('Max results'),
  }, ({ product_id }: any) => ({ product_id, related: [{ id: 'PROD-201', name: 'Widget Deluxe', price: 69.99 }] })),

  check_compatibility: t('Check if two products are compatible', {
    product_id_a: s('First product ID'), product_id_b: s('Second product ID'),
  }, () => ({ compatible: true, notes: 'Fully compatible' })),

  get_product_specs: t('Get technical specifications for a product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, specs: { weight: '0.5kg', dimensions: '10x5x3cm', material: 'Aluminum', warranty: '2 years' } })),

  get_brand_info: t('Get information about a brand', {
    brand_id: s('Brand ID'),
  }, ({ brand_id }: any) => ({ brand_id, name: 'Acme Corp', country: 'US', products_count: 342 })),

  list_brands: t('List all available brands', {
    category: os('Filter by category'),
  }, () => ({ brands: [{ id: 'BR-1', name: 'Acme Corp' }, { id: 'BR-2', name: 'TechPro' }] })),

  get_bestsellers: t('Get current bestselling products', {
    category: os('Category filter'), limit: on('Max results'),
  }, () => ({ bestsellers: [{ id: 'PROD-50', name: 'Super Widget', price: 19.99, sold: 5024 }] })),

  get_new_arrivals: t('Get recently added products', {
    category: os('Category filter'), limit: on('Max results'),
  }, () => ({ arrivals: [{ id: 'PROD-300', name: 'Neo Widget', price: 39.99, added: '2024-06-15' }] })),

  get_product_images: t('Get all images for a product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, images: [{ url: 'https://img.example.com/1.jpg', alt: 'Front view' }] })),

  get_product_variants: t('Get all variants (size, color) for a product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, variants: [{ sku: 'W-S-BLK', size: 'S', color: 'Black', stock: 12 }] })),

  get_product_availability: t('Check product availability across stores', {
    product_id: s('Product ID'), zip_code: os('ZIP code for local stores'),
  }, ({ product_id }: any) => ({ product_id, online: true, stores: [{ name: 'Downtown', stock: 5 }] })),

  get_product_questions: t('Get customer questions about a product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, questions: [{ q: 'Is this waterproof?', a: 'Yes, IP67 rated' }] })),

  get_product_answers: t('Get answers to a specific product question', {
    question_id: s('Question ID'),
  }, ({ question_id }: any) => ({ question_id, answers: [{ text: 'Yes it works great', helpful: 42 }] })),

  get_size_guide: t('Get the size guide for a product category', {
    category: s('Product category'),
  }, ({ category }: any) => ({ category, sizes: { S: '34-36', M: '38-40', L: '42-44', XL: '46-48' } })),

  get_product_warranty: t('Get warranty information for a product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, warranty_months: 24, type: 'manufacturer', covers: ['defects', 'malfunction'] })),

  get_product_bundle: t('Get bundle deals containing a product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, bundles: [{ id: 'BDL-1', name: 'Starter Kit', price: 79.99, savings: 20 }] })),

  get_product_rating_breakdown: t('Get rating distribution for a product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, breakdown: { 5: 64, 4: 30, 3: 15, 2: 8, 1: 3 }, average: 4.2 })),

};

// ════════════════════════════════════════════
//  ORDERS  (25 tools)
// ════════════════════════════════════════════

const orders = {
  create_order: t('Create a new order from the current cart', {
    payment_method_id: s('Payment method ID'), shipping_address_id: s('Shipping address ID'),
  }, ({ payment_method_id }: any) => ({ order_id: 'ORD-9001', status: 'confirmed', payment_method_id, total: 89.99 })),

  get_order: t('Get full order details by order ID', {
    order_id: s('The order ID to look up'),
  }, ({ order_id }: any) => ({ order_id, status: 'processing', total: 89.99, items: [{ name: 'Widget', qty: 2, price: 44.99 }], email: 'customer@example.com' })),

  cancel_order: t('Cancel an existing order', {
    order_id: s('The order ID to cancel'), reason: os('Cancellation reason'),
  }, ({ order_id }: any) => ({ order_id, cancelled: true, refund_initiated: true })),

  list_orders: t('List orders for the current user', {
    status: os('Filter by status'), limit: on('Max results'),
  }, () => ({ orders: [{ id: 'ORD-100', status: 'delivered', total: 49.99 }], total: 12 })),

  update_order: t('Update order details before shipping', {
    order_id: s('Order ID'), notes: os('Updated notes'),
  }, ({ order_id }: any) => ({ order_id, updated: true })),

  get_order_history: t('Get full order history for the customer', {
    months: on('How many months of history'),
  }, () => ({ orders: [{ id: 'ORD-1', date: '2024-01-15', total: 29.99 }], total_spent: 1249.50 })),

  reorder: t('Place a new order with the same items as a previous order', {
    order_id: s('Previous order ID to reorder'),
  }, ({ order_id }: any) => ({ new_order_id: 'ORD-9002', copied_from: order_id, status: 'confirmed' })),

  get_invoice: t('Get the invoice for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, invoice_number: 'INV-2024-001', total: 89.99, tax: 7.20, pdf_url: 'https://inv.example.com/1.pdf' })),

  get_receipt: t('Get the payment receipt for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, receipt_id: 'RCP-001', amount: 89.99, method: 'Visa ending 4242' })),

  estimate_delivery: t('Estimate delivery date for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, estimated_date: '2024-07-20', business_days: 5 })),

  track_order: t('Track the shipping status of an order', {
    order_id: s('Order ID to track'),
  }, ({ order_id }: any) => ({ order_id, tracking_number: 'TRK-ABC123', carrier: 'FedEx', status: 'in_transit', last_location: 'Memphis, TN' })),

  modify_order_address: t('Change the shipping address for an order', {
    order_id: s('Order ID'), new_address: s('New shipping address'),
  }, ({ order_id }: any) => ({ order_id, address_updated: true })),

  add_order_note: t('Add a note to an order', {
    order_id: s('Order ID'), note: s('Note text'),
  }, ({ order_id }: any) => ({ order_id, note_added: true })),

  get_order_timeline: t('Get the full timeline of events for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, events: [{ date: '2024-07-01', event: 'Order placed' }, { date: '2024-07-02', event: 'Payment confirmed' }] })),

  get_order_items: t('Get the list of items in an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, items: [{ product_id: 'PROD-1', name: 'Widget', qty: 2, price: 44.99 }] })),

  split_order: t('Split an order into multiple shipments', {
    order_id: s('Order ID'), item_groups: z.array(z.array(s('item ID'))).describe('Groups of items'),
  }, ({ order_id }: any) => ({ original: order_id, new_orders: ['ORD-9003', 'ORD-9004'] })),

  merge_orders: t('Merge multiple pending orders into one', {
    order_ids: z.array(s('Order ID')).describe('Orders to merge'),
  }, ({ order_ids }: any) => ({ merged_order_id: 'ORD-9005', merged_from: order_ids })),

  get_order_status: t('Get the current status of an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, status: 'processing', updated_at: '2024-07-15T10:30:00Z' })),

  apply_order_discount: t('Apply a discount to an existing order', {
    order_id: s('Order ID'), discount_code: s('Discount code'),
  }, ({ order_id }: any) => ({ order_id, discount_applied: true, new_total: 79.99, saved: 10.00 })),

  get_order_total: t('Get the total cost breakdown for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, subtotal: 82.79, tax: 7.20, shipping: 0, total: 89.99 })),

  duplicate_order: t('Create a draft order duplicating an existing one', {
    order_id: s('Order ID to duplicate'),
  }, ({ order_id }: any) => ({ draft_order_id: 'ORD-DRAFT-1', copied_from: order_id })),

  verify_order: t('Verify order details are correct before processing', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, verified: true, issues: [] })),

  get_order_tax_breakdown: t('Get tax breakdown for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, federal: 5.40, state: 1.80, local: 0, total_tax: 7.20 })),
};

// ════════════════════════════════════════════
//  CART  (15 tools)
// ════════════════════════════════════════════

const cart = {
  add_to_cart: t('Add a product to the shopping cart', {
    product_id: s('Product ID to add'), quantity: on('Quantity, defaults to 1'),
  }, ({ product_id }: any) => ({ product_id, added: true, cart_count: 3 })),

  remove_from_cart: t('Remove a product from the shopping cart', {
    product_id: s('Product ID to remove'),
  }, ({ product_id }: any) => ({ product_id, removed: true, cart_count: 2 })),

  update_cart_quantity: t('Update the quantity of a product in the cart', {
    product_id: s('Product ID'), quantity: n('New quantity'),
  }, ({ product_id, quantity }: any) => ({ product_id, quantity, updated: true })),

  get_cart: t('Get the current shopping cart contents', {}, () => ({
    items: [{ product_id: 'PROD-1', name: 'Widget', qty: 2, price: 44.99 }], subtotal: 89.98, item_count: 2,
  })),

  clear_cart: t('Clear all items from the cart', {}, () => ({ cleared: true, items_removed: 3 })),

  apply_coupon: t('Apply a coupon code to the cart', {
    code: s('Coupon code to apply'),
  }, ({ code }: any) => ({ code, applied: true, discount: 10.00, new_total: 79.98 })),

  remove_coupon: t('Remove applied coupon from the cart', {
    code: s('Coupon code to remove'),
  }, ({ code }: any) => ({ code, removed: true })),

  get_cart_total: t('Get the cart total with all discounts applied', {}, () => ({
    subtotal: 89.98, discount: 10.00, tax: 6.40, shipping: 0, total: 86.38,
  })),

  save_cart: t('Save the current cart for later', {
    name: os('Name for the saved cart'),
  }, () => ({ saved_cart_id: 'SC-1', saved: true })),

  restore_cart: t('Restore a previously saved cart', {
    saved_cart_id: s('Saved cart ID'),
  }, ({ saved_cart_id }: any) => ({ saved_cart_id, restored: true, item_count: 3 })),

  share_cart: t('Generate a shareable link for the current cart', {}, () => ({
    share_url: 'https://shop.example.com/cart/shared/abc123', expires_in: '7 days',
  })),

  move_to_wishlist_from_cart: t('Move an item from cart to wishlist', {
    product_id: s('Product ID to move'),
  }, ({ product_id }: any) => ({ product_id, moved: true })),

  get_cart_recommendations: t('Get product recommendations based on cart contents', {
    limit: on('Max recommendations'),
  }, () => ({ recommendations: [{ id: 'PROD-201', name: 'Widget Case', price: 14.99 }] })),

  validate_cart: t('Validate cart items are all in stock and prices are current', {}, () => ({
    valid: true, issues: [], all_in_stock: true,
  })),

  checkout_cart: t('Begin the checkout process for the current cart', {
    payment_method_id: s('Payment method ID'), shipping_address_id: s('Shipping address ID'),
  }, () => ({ checkout_id: 'CHK-1', status: 'pending_payment', total: 86.38 })),
};

// ════════════════════════════════════════════
//  PAYMENTS  (20 tools)
// ════════════════════════════════════════════

const payments = {
  get_payment_methods: t('List saved payment methods for the user', {}, () => ({
    methods: [{ id: 'PM-1', type: 'visa', last4: '4242', default: true }],
  })),

  add_payment_method: t('Add a new payment method', {
    type: s('Payment type (card, paypal, etc.)'), token: s('Payment token'),
  }, ({ type }: any) => ({ method_id: 'PM-2', type, added: true })),

  remove_payment_method: t('Remove a saved payment method', {
    method_id: s('Payment method ID'),
  }, ({ method_id }: any) => ({ method_id, removed: true })),

  process_payment: t('Process a payment for an order', {
    order_id: s('Order ID'), method_id: s('Payment method ID'),
  }, ({ order_id }: any) => ({ order_id, payment_id: 'PAY-001', status: 'completed', amount: 89.99 })),

  get_payment_status: t('Check the status of a payment', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, payment_status: 'completed', method: 'Visa 4242', amount: 89.99 })),

  refund_payment: t('Process a refund for an order', {
    order_id: s('Order ID to refund'), amount: on('Partial refund amount'),
  }, ({ order_id }: any) => ({ order_id, refund_id: 'REF-001', amount: 89.99, status: 'initiated', estimated_days: 5 })),

  get_balance: t('Get the user account balance', {}, () => ({
    balance: 25.00, currency: 'USD', pending: 0,
  })),

  get_transactions: t('Get transaction history for the user', {
    limit: on('Max transactions'), from_date: os('Start date'),
  }, () => ({ transactions: [{ id: 'TXN-1', amount: -89.99, type: 'purchase', date: '2024-07-01' }] })),

  set_default_payment: t('Set a payment method as default', {
    method_id: s('Payment method ID'),
  }, ({ method_id }: any) => ({ method_id, set_as_default: true })),

  validate_card: t('Validate a credit card number', {
    card_number: s('Card number to validate'),
  }, () => ({ valid: true, type: 'visa', issuer: 'Chase' })),

  get_payment_plans: t('Get available payment plans for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, plans: [{ months: 3, monthly: 30.00, interest: 0 }, { months: 6, monthly: 15.83, interest: 5 }] })),

  create_installment_plan: t('Create an installment payment plan', {
    order_id: s('Order ID'), months: n('Number of installments'),
  }, ({ order_id, months }: any) => ({ order_id, plan_id: 'INST-1', months, monthly_amount: 89.99 / months })),

  get_store_credit: t('Get available store credit balance', {}, () => ({
    credit: 15.00, expiry: '2025-01-01',
  })),

  apply_store_credit: t('Apply store credit to an order', {
    order_id: s('Order ID'), amount: n('Amount of store credit to apply'),
  }, ({ order_id, amount }: any) => ({ order_id, applied: amount, remaining_credit: 15 - amount })),

  get_gift_card_balance: t('Check the balance of a gift card', {
    card_number: s('Gift card number'),
  }, ({ card_number }: any) => ({ card_number, balance: 50.00, currency: 'USD' })),

  redeem_gift_card: t('Redeem a gift card to account balance', {
    card_number: s('Gift card number'),
  }, ({ card_number }: any) => ({ card_number, redeemed: true, amount: 50.00 })),

  get_payment_receipt: t('Get the receipt for a specific payment', {
    payment_id: s('Payment ID'),
  }, ({ payment_id }: any) => ({ payment_id, amount: 89.99, date: '2024-07-01', pdf_url: 'https://rcpt.example.com/1.pdf' })),

  void_payment: t('Void a pending payment', {
    payment_id: s('Payment ID to void'),
  }, ({ payment_id }: any) => ({ payment_id, voided: true })),
};

// ════════════════════════════════════════════
//  USERS  (20 tools)
// ════════════════════════════════════════════

const users = {
  get_profile: t('Get the current user profile', {}, () => ({
    user_id: 'USR-1', name: 'Jane Smith', email: 'jane@example.com', tier: 'gold', member_since: '2022-03-15',
  })),

  update_profile: t('Update user profile information', {
    name: os('New name'), phone: os('New phone number'),
  }, (a: any) => ({ updated: true, ...a })),

  get_addresses: t('Get all saved addresses for the user', {}, () => ({
    addresses: [{ id: 'ADDR-1', street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701', default: true }],
  })),

  add_address: t('Add a new shipping address', {
    street: s('Street address'), city: s('City'), state: s('State'), zip: s('ZIP code'),
  }, (a: any) => ({ address_id: 'ADDR-2', ...a, added: true })),

  update_address: t('Update an existing address', {
    address_id: s('Address ID'), street: os('Street'), city: os('City'), state: os('State'), zip: os('ZIP'),
  }, ({ address_id }: any) => ({ address_id, updated: true })),

  delete_address: t('Delete a saved address', {
    address_id: s('Address ID'),
  }, ({ address_id }: any) => ({ address_id, deleted: true })),

  set_default_address: t('Set an address as the default shipping address', {
    address_id: s('Address ID'),
  }, ({ address_id }: any) => ({ address_id, set_as_default: true })),

  get_preferences: t('Get user shopping preferences', {}, () => ({
    currency: 'USD', language: 'en', newsletter: true, notifications: true,
  })),

  update_preferences: t('Update user shopping preferences', {
    currency: os('Preferred currency'), language: os('Preferred language'), newsletter: ob('Subscribe to newsletter'),
  }, (a: any) => ({ updated: true, ...a })),

  get_loyalty_points: t('Get the current loyalty points balance', {}, () => ({
    points: 2450, tier: 'gold', next_tier: 'platinum', points_to_next: 550, value_usd: 24.50,
  })),

  redeem_points: t('Redeem loyalty points for a discount', {
    points: n('Number of points to redeem'), order_id: s('Order ID to apply discount'),
  }, ({ points, order_id }: any) => ({ order_id, points_redeemed: points, discount: points * 0.01 })),

  get_tier_status: t('Get loyalty tier status and benefits', {}, () => ({
    tier: 'gold', benefits: ['Free shipping', '2x points', 'Early access'], next_tier: 'platinum',
  })),

  change_password: t('Change the user account password', {
    current_password: s('Current password'), new_password: s('New password'),
  }, () => ({ changed: true })),

  enable_2fa: t('Enable two-factor authentication', {
    method: s('2FA method (sms, authenticator)'),
  }, ({ method }: any) => ({ enabled: true, method, backup_codes: ['ABC123', 'DEF456'] })),

  get_login_history: t('Get recent login history', {
    limit: on('Max entries'),
  }, () => ({ logins: [{ date: '2024-07-15', ip: '192.168.1.1', device: 'Chrome on Mac' }] })),

  deactivate_account: t('Deactivate the user account', {
    reason: s('Reason for deactivation'),
  }, () => ({ deactivated: true, reactivation_deadline: '2024-10-15' })),

  get_recently_viewed: t('Get recently viewed products', {
    limit: on('Max results'),
  }, () => ({ products: [{ id: 'PROD-42', name: 'Widget', viewed_at: '2024-07-15' }] })),
};

// ════════════════════════════════════════════
//  SHIPPING  (15 tools)
// ════════════════════════════════════════════

const shipping = {
  get_shipping_rates: t('Get available shipping rates for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, rates: [{ carrier: 'FedEx', service: 'Ground', price: 8.99, days: 5 }, { carrier: 'UPS', service: 'Express', price: 24.99, days: 2 }] })),

  estimate_delivery_date: t('Estimate delivery date for a given shipping method', {
    order_id: s('Order ID'), shipping_method: s('Shipping method'),
  }, ({ order_id }: any) => ({ order_id, estimated_date: '2024-07-22', confidence: 'high' })),

  get_shipping_options: t('Get all shipping options available to the user', {
    zip_code: s('Destination ZIP code'),
  }, () => ({ options: [{ method: 'standard', price: 5.99, days: '5-7' }, { method: 'express', price: 14.99, days: '2-3' }] })),

  track_shipment: t('Track a shipment by tracking number or order ID', {
    order_id: s('Order ID to track'),
  }, ({ order_id }: any) => ({ order_id, tracking: 'TRK-XYZ', status: 'in_transit', carrier: 'FedEx', location: 'Memphis, TN', updated: '2024-07-15T14:30:00Z' })),

  get_tracking_details: t('Get detailed tracking history for a shipment', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, events: [{ date: '2024-07-14', status: 'Shipped', location: 'Warehouse' }, { date: '2024-07-15', status: 'In transit', location: 'Memphis' }] })),

  create_shipping_label: t('Create a shipping label for an order', {
    order_id: s('Order ID'), carrier: s('Carrier name'),
  }, ({ order_id }: any) => ({ order_id, label_url: 'https://labels.example.com/2.pdf', tracking: 'TRK-NEW1' })),

  get_pickup_locations: t('Find nearby pickup locations', {
    zip_code: s('ZIP code'), radius_miles: on('Search radius in miles'),
  }, () => ({ locations: [{ name: 'FedEx Office Downtown', address: '100 Main St', distance: 1.2 }] })),

  schedule_pickup: t('Schedule a package pickup at your address', {
    order_id: s('Order ID'), pickup_date: s('Preferred pickup date'),
  }, ({ order_id }: any) => ({ order_id, pickup_scheduled: true, confirmation: 'PKP-001' })),

  get_customs_info: t('Get customs declaration info for international shipping', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, customs_value: 89.99, hs_code: '8471.30', origin: 'US' })),

  calculate_duties: t('Calculate import duties and taxes for international orders', {
    order_id: s('Order ID'), destination_country: s('Destination country code'),
  }, ({ order_id }: any) => ({ order_id, duties: 12.50, taxes: 8.10, total: 20.60 })),

  get_carrier_info: t('Get information about a shipping carrier', {
    carrier: s('Carrier name'),
  }, ({ carrier }: any) => ({ carrier, website: `https://${carrier.toLowerCase()}.com`, tracking_url: `https://${carrier.toLowerCase()}.com/track/` })),

  compare_shipping_rates: t('Compare rates across carriers for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, comparison: [{ carrier: 'FedEx', price: 8.99, days: 5 }, { carrier: 'UPS', price: 9.49, days: 4 }] })),

  get_delivery_windows: t('Get available delivery time windows', {
    order_id: s('Order ID'), date: s('Delivery date'),
  }, ({ order_id }: any) => ({ order_id, windows: [{ start: '9:00', end: '12:00' }, { start: '14:00', end: '17:00' }] })),

  request_signature_delivery: t('Request signature required on delivery', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, signature_required: true, extra_charge: 2.99 })),

  get_shipping_insurance: t('Get shipping insurance options', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, options: [{ coverage: 100, price: 3.99 }, { coverage: 500, price: 9.99 }] })),
};

// ════════════════════════════════════════════
//  RETURNS  (15 tools)
// ════════════════════════════════════════════

const returns = {
  create_return: t('Create a return request for an order', {
    order_id: s('Order ID to return'), reason: s('Return reason'),
  }, ({ order_id }: any) => ({ return_id: 'RET-001', order_id, status: 'pending', label_url: 'https://labels.example.com/ret1.pdf' })),

  get_return_status: t('Check the status of a return', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, return_id: 'RET-001', status: 'in_transit', refund_status: 'pending' })),

  get_return_label: t('Get or generate a return shipping label', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, label_url: 'https://labels.example.com/ret2.pdf', carrier: 'USPS', expires: '2024-08-01' })),

  list_returns: t('List all return requests', {
    status: os('Filter by status'),
  }, () => ({ returns: [{ id: 'RET-001', order_id: 'ORD-100', status: 'completed' }] })),

  cancel_return: t('Cancel a pending return request', {
    return_id: s('Return ID'),
  }, ({ return_id }: any) => ({ return_id, cancelled: true })),

  get_return_policy: t('Get the return policy for a product or category', {
    product_id: os('Product ID'), category: os('Category'),
  }, () => ({ days: 30, conditions: ['unused', 'original packaging'], free_returns: true })),

  exchange_item: t('Exchange an item from an order for a different variant', {
    order_id: s('Order ID'), old_product_id: s('Product to exchange'), new_product_id: s('Replacement product'),
  }, ({ order_id }: any) => ({ order_id, exchange_id: 'EXC-001', status: 'approved', price_difference: 0 })),

  get_refund_status: t('Check the status of a refund for an order', {
    order_id: s('Order ID'),
  }, ({ order_id }: any) => ({ order_id, refund_id: 'REF-001', status: 'processing', amount: 89.99, estimated_days: 3 })),

  request_store_credit_return: t('Request store credit instead of refund', {
    return_id: s('Return ID'),
  }, ({ return_id }: any) => ({ return_id, store_credit: 89.99, applied: true })),

  get_return_reasons: t('Get list of valid return reasons', {}, () => ({
    reasons: ['Defective', 'Wrong item', 'Not as described', 'Changed mind', 'Too late', 'Better price found'],
  })),

  schedule_return_pickup: t('Schedule a pickup for a return package', {
    return_id: s('Return ID'), pickup_date: s('Preferred date'),
  }, ({ return_id }: any) => ({ return_id, pickup_scheduled: true, confirmation: 'RPK-001' })),

  get_return_timeline: t('Get the full timeline of a return', {
    return_id: s('Return ID'),
  }, ({ return_id }: any) => ({ return_id, events: [{ date: '2024-07-10', event: 'Return requested' }, { date: '2024-07-12', event: 'Label sent' }] })),

  update_return_reason: t('Update the reason for a return', {
    return_id: s('Return ID'), new_reason: s('Updated reason'),
  }, ({ return_id }: any) => ({ return_id, updated: true })),

  approve_return: t('Approve a pending return request (admin)', {
    return_id: s('Return ID'),
  }, ({ return_id }: any) => ({ return_id, approved: true })),

  get_return_shipping_cost: t('Get the shipping cost for a return', {
    return_id: s('Return ID'),
  }, ({ return_id }: any) => ({ return_id, cost: 0, free_return: true })),
};

// ════════════════════════════════════════════
//  REVIEWS  (10 tools)
// ════════════════════════════════════════════

const reviews = {
  create_review: t('Submit a review for a product', {
    product_id: s('Product ID'), rating: n('Rating 1-5'), text: s('Review text'),
  }, ({ product_id, rating }: any) => ({ review_id: 'REV-001', product_id, rating, published: true })),

  get_review: t('Get a specific review', {
    review_id: s('Review ID'),
  }, ({ review_id }: any) => ({ review_id, rating: 5, text: 'Amazing product!', author: 'Jane', date: '2024-07-01' })),

  list_reviews: t('List reviews for a product', {
    product_id: s('Product ID'), sort: os('Sort by: recent, helpful, rating'),
  }, ({ product_id }: any) => ({ product_id, reviews: [{ id: 'REV-1', rating: 5, text: 'Great!' }], total: 128 })),

  update_review: t('Update your existing review', {
    review_id: s('Review ID'), rating: on('New rating'), text: os('New text'),
  }, ({ review_id }: any) => ({ review_id, updated: true })),

  delete_review: t('Delete your review', {
    review_id: s('Review ID'),
  }, ({ review_id }: any) => ({ review_id, deleted: true })),

  report_review: t('Report a review for policy violation', {
    review_id: s('Review ID'), reason: s('Report reason'),
  }, ({ review_id }: any) => ({ review_id, reported: true, report_id: 'RPT-001' })),

  helpful_vote: t('Mark a review as helpful or not', {
    review_id: s('Review ID'), helpful: z.boolean().describe('Whether the review is helpful'),
  }, ({ review_id }: any) => ({ review_id, vote_recorded: true })),

  get_review_summary: t('Get an AI-generated summary of reviews for a product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, summary: 'Customers love the quality and price.', pros: ['Quality', 'Price'], cons: ['Packaging'] })),

  get_review_photos: t('Get photos uploaded with reviews', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, photos: [{ url: 'https://img.example.com/review1.jpg', review_id: 'REV-1' }] })),

  get_verified_reviews: t('Get only verified purchase reviews', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, reviews: [{ id: 'REV-2', rating: 4, text: 'Good value', verified: true }], total: 89 })),
};

// ════════════════════════════════════════════
//  NOTIFICATIONS  (10 tools)
// ════════════════════════════════════════════

const notifications = {
  get_notifications: t('Get recent notifications for the user', {
    unread_only: ob('Only show unread'),
  }, () => ({ notifications: [{ id: 'NOT-1', type: 'order_shipped', message: 'Your order has shipped!', read: false }] })),

  mark_notification_read: t('Mark a notification as read', {
    notification_id: s('Notification ID'),
  }, ({ notification_id }: any) => ({ notification_id, marked_read: true })),

  update_notification_preferences: t('Update notification preferences', {
    email_orders: ob('Email for order updates'), email_promotions: ob('Email for promotions'), push_enabled: ob('Push notifications'),
  }, (a: any) => ({ updated: true, ...a })),

  subscribe_price_alert: t('Set a price alert for a product', {
    product_id: s('Product ID'), target_price: n('Alert when price drops below this'),
  }, ({ product_id, target_price }: any) => ({ product_id, target_price, subscribed: true, alert_id: 'PA-001' })),

  subscribe_stock_alert: t('Get notified when a product is back in stock', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, subscribed: true, alert_id: 'SA-001' })),

  get_email_preferences: t('Get current email notification preferences', {}, () => ({
    orders: true, promotions: false, newsletter: true, price_alerts: true,
  })),

  unsubscribe_notifications: t('Unsubscribe from a notification type', {
    type: s('Notification type to unsubscribe from'),
  }, ({ type }: any) => ({ type, unsubscribed: true })),

  get_sms_preferences: t('Get SMS notification preferences', {}, () => ({
    order_updates: true, delivery_alerts: true, promotions: false,
  })),

  send_order_update: t('Send an order update notification to the customer', {
    order_id: s('Order ID'), message: s('Update message'),
  }, ({ order_id }: any) => ({ order_id, sent: true })),

  get_notification_history: t('Get notification history', {
    limit: on('Max notifications'),
  }, () => ({ history: [{ id: 'NOT-1', type: 'order', date: '2024-07-15', read: true }], total: 42 })),
};

// ════════════════════════════════════════════
//  INVENTORY  (10 tools)
// ════════════════════════════════════════════

const inventory = {
  check_stock: t('Check if a product is currently in stock', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, in_stock: true, quantity: 23, warehouse: 'US-East' })),

  get_store_availability: t('Check product availability at physical stores', {
    product_id: s('Product ID'), zip_code: s('ZIP code'),
  }, ({ product_id }: any) => ({ product_id, stores: [{ name: 'Downtown Store', stock: 5, distance: '1.2 mi' }] })),

  reserve_item: t('Reserve an item for in-store pickup', {
    product_id: s('Product ID'), store_id: s('Store ID'),
  }, ({ product_id }: any) => ({ product_id, reservation_id: 'RSV-001', expires: '2024-07-16T18:00:00Z' })),

  get_restock_date: t('Get the estimated restock date for an out-of-stock product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, restock_date: '2024-08-01', confidence: 'medium' })),

  subscribe_restock_alert: t('Get notified when a product is restocked', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, subscribed: true })),

  get_warehouse_locations: t('Get warehouse locations for a product', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, warehouses: [{ id: 'WH-1', location: 'US-East', stock: 150 }] })),

  check_bundle_availability: t('Check if all items in a bundle are available', {
    bundle_id: s('Bundle ID'),
  }, ({ bundle_id }: any) => ({ bundle_id, available: true, all_in_stock: true })),

  get_inventory_count: t('Get total inventory count for a product across all locations', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, total: 450, by_warehouse: { 'US-East': 200, 'US-West': 150, 'EU': 100 } })),

  get_low_stock_items: t('Get products with low stock levels', {
    threshold: on('Stock threshold'),
  }, () => ({ items: [{ product_id: 'PROD-42', name: 'Rare Widget', stock: 3 }] })),

};

// ════════════════════════════════════════════
//  SUPPORT  (15 tools)
// ════════════════════════════════════════════

const support = {
  create_ticket: t('Create a customer support ticket', {
    order_id: os('Related order ID'), subject: s('Ticket subject'), description: s('Issue description'),
  }, ({ subject }: any) => ({ ticket_id: 'TKT-001', subject, status: 'open', created: '2024-07-15' })),

  get_ticket: t('Get details of a support ticket', {
    ticket_id: s('Ticket ID'),
  }, ({ ticket_id }: any) => ({ ticket_id, subject: 'Order issue', status: 'open', messages: 2 })),

  list_tickets: t('List all support tickets for the user', {
    status: os('Filter by status'),
  }, () => ({ tickets: [{ id: 'TKT-001', subject: 'Order issue', status: 'open' }], total: 3 })),

  update_ticket: t('Update a support ticket', {
    ticket_id: s('Ticket ID'), message: s('New message'),
  }, ({ ticket_id }: any) => ({ ticket_id, updated: true })),

  close_ticket: t('Close a resolved support ticket', {
    ticket_id: s('Ticket ID'),
  }, ({ ticket_id }: any) => ({ ticket_id, closed: true })),

  reopen_ticket: t('Reopen a closed support ticket', {
    ticket_id: s('Ticket ID'),
  }, ({ ticket_id }: any) => ({ ticket_id, reopened: true })),

  escalate_ticket: t('Escalate a ticket to a senior agent', {
    ticket_id: s('Ticket ID'), reason: s('Escalation reason'),
  }, ({ ticket_id }: any) => ({ ticket_id, escalated: true, new_priority: 'high' })),

  add_ticket_comment: t('Add a comment to a support ticket', {
    ticket_id: s('Ticket ID'), comment: s('Comment text'),
  }, ({ ticket_id }: any) => ({ ticket_id, comment_added: true })),

  get_faq: t('Get frequently asked questions', {
    topic: os('Topic filter'),
  }, () => ({ faqs: [{ q: 'How do I return an item?', a: 'Go to My Orders and click Return' }] })),

  search_help: t('Search the help center', {
    query: s('Search query'),
  }, ({ query }: any) => ({ results: [{ title: `How to ${query}`, url: 'https://help.example.com/1' }] })),

  get_agent_availability: t('Check if live support agents are available', {}, () => ({
    available: true, wait_time_minutes: 3, agents_online: 12,
  })),

  start_live_chat: t('Start a live chat session with support', {
    topic: s('Chat topic'),
  }, ({ topic }: any) => ({ chat_id: 'CHAT-001', topic, status: 'connecting', estimated_wait: '2 min' })),

  rate_support: t('Rate a support interaction', {
    ticket_id: s('Ticket ID'), rating: n('Rating 1-5'), feedback: os('Optional feedback'),
  }, ({ ticket_id, rating }: any) => ({ ticket_id, rating, recorded: true })),

  get_support_hours: t('Get customer support operating hours', {}, () => ({
    hours: { weekday: '8am-10pm ET', weekend: '9am-6pm ET' }, holiday: 'Closed on major holidays',
  })),

  get_contact_info: t('Get customer support contact information', {}, () => ({
    phone: '1-800-EXAMPLE', email: 'support@example.com', chat: 'https://chat.example.com',
  })),
};

// ════════════════════════════════════════════
//  WISHLIST  (10 tools)
// ════════════════════════════════════════════

const wishlist = {
  add_to_wishlist: t('Add a product to the user wishlist', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, added: true, wishlist_count: 8 })),

  remove_from_wishlist: t('Remove a product from the wishlist', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, removed: true })),

  get_wishlist: t('Get all items in the user wishlist', {}, () => ({
    items: [{ product_id: 'PROD-42', name: 'Dream Widget', price: 99.99, in_stock: true }], total: 7,
  })),

  share_wishlist: t('Generate a shareable wishlist link', {}, () => ({
    share_url: 'https://shop.example.com/wishlist/shared/xyz789',
  })),

  create_wishlist: t('Create a new named wishlist', {
    name: s('Wishlist name'),
  }, ({ name }: any) => ({ wishlist_id: 'WL-2', name, created: true })),

  get_public_wishlists: t('Browse public wishlists', {
    query: os('Search query'),
  }, () => ({ wishlists: [{ id: 'WL-PUB-1', name: 'Tech Essentials', owner: 'John', items: 12 }] })),

  move_to_cart_from_wishlist: t('Move a wishlist item to the shopping cart', {
    product_id: s('Product ID to move to cart'),
  }, ({ product_id }: any) => ({ product_id, moved_to_cart: true })),

  get_wishlist_price_changes: t('Get price changes for wishlist items', {}, () => ({
    changes: [{ product_id: 'PROD-42', old_price: 119.99, new_price: 99.99, change: -20.00 }],
  })),

  merge_wishlists: t('Merge two wishlists into one', {
    source_id: s('Source wishlist ID'), target_id: s('Target wishlist ID'),
  }, ({ target_id }: any) => ({ merged_into: target_id, items_moved: 5 })),

  set_wishlist_privacy: t('Set wishlist visibility (public or private)', {
    wishlist_id: s('Wishlist ID'), public: z.boolean().describe('Make public'),
  }, ({ wishlist_id }: any) => ({ wishlist_id, updated: true })),
};

// ════════════════════════════════════════════
//  PROMOTIONS  (5 tools)
// ════════════════════════════════════════════

const promotions = {
  get_active_promotions: t('Get currently active promotions and deals', {
    category: os('Category filter'),
  }, () => ({ promotions: [{ id: 'PROMO-1', title: 'Summer Sale 20% Off', code: 'SUMMER20', expires: '2024-08-31' }] })),

  validate_coupon_code: t('Validate a coupon code and check eligibility', {
    code: s('Coupon code'), order_total: on('Current order total'),
  }, ({ code }: any) => ({ code, valid: true, discount_type: 'percentage', value: 20, min_order: 25.00 })),

  get_flash_deals: t('Get current flash deals with countdown timers', {}, () => ({
    deals: [{ product_id: 'PROD-77', name: 'Widget Ultra', original: 79.99, sale: 39.99, ends_in: '2h 30m' }],
  })),

  get_bundle_deals: t('Get available bundle deals', {}, () => ({
    bundles: [{ id: 'BDL-1', name: 'Home Office Kit', items: 3, price: 149.99, savings: 45.00 }],
  })),

  get_loyalty_offers: t('Get special offers for loyalty members', {}, () => ({
    offers: [{ id: 'LO-1', title: 'Gold Member Exclusive', discount: 15, code: 'GOLD15' }],
  })),
};

// ════════════════════════════════════════════
//  SUBSCRIPTIONS  (10 tools)
// ════════════════════════════════════════════

const subscriptions = {
  create_subscription: t('Create a new product subscription', {
    product_id: s('Product ID'), frequency: s('Delivery frequency (weekly, monthly, quarterly)'),
  }, ({ product_id, frequency }: any) => ({ subscription_id: 'SUB-001', product_id, frequency, status: 'active', next_delivery: '2024-08-01' })),

  cancel_subscription: t('Cancel an active subscription', {
    subscription_id: s('Subscription ID'), reason: os('Cancellation reason'),
  }, ({ subscription_id }: any) => ({ subscription_id, cancelled: true, effective_date: '2024-07-31' })),

  get_subscription: t('Get details of a subscription', {
    subscription_id: s('Subscription ID'),
  }, ({ subscription_id }: any) => ({ subscription_id, product: 'Widget Refills', frequency: 'monthly', status: 'active', next_delivery: '2024-08-01', price: 14.99 })),

  update_subscription: t('Update subscription frequency or quantity', {
    subscription_id: s('Subscription ID'), frequency: os('New frequency'), quantity: on('New quantity'),
  }, ({ subscription_id }: any) => ({ subscription_id, updated: true })),

  list_subscriptions: t('List all user subscriptions', {
    status: os('Filter by status'),
  }, () => ({ subscriptions: [{ id: 'SUB-001', product: 'Widget Refills', status: 'active' }], total: 2 })),

  pause_subscription: t('Pause a subscription temporarily', {
    subscription_id: s('Subscription ID'), resume_date: os('When to resume'),
  }, ({ subscription_id }: any) => ({ subscription_id, paused: true, resume_date: '2024-09-01' })),

  resume_subscription: t('Resume a paused subscription', {
    subscription_id: s('Subscription ID'),
  }, ({ subscription_id }: any) => ({ subscription_id, resumed: true, next_delivery: '2024-08-01' })),

  change_subscription_plan: t('Change the subscription plan tier', {
    subscription_id: s('Subscription ID'), new_plan: s('New plan name'),
  }, ({ subscription_id, new_plan }: any) => ({ subscription_id, plan: new_plan, updated: true })),

  get_subscription_history: t('Get delivery history for a subscription', {
    subscription_id: s('Subscription ID'),
  }, ({ subscription_id }: any) => ({ subscription_id, deliveries: [{ date: '2024-07-01', status: 'delivered' }, { date: '2024-06-01', status: 'delivered' }] })),

  get_available_plans: t('Get all available subscription plans', {
    product_id: s('Product ID'),
  }, ({ product_id }: any) => ({ product_id, plans: [{ name: 'basic', price: 9.99, frequency: 'monthly' }, { name: 'premium', price: 24.99, frequency: 'monthly' }] })),
};

// ════════════════════════════════════════════
//  ANALYTICS  (5 tools)
// ════════════════════════════════════════════

const analytics = {
  get_spending_summary: t('Get spending summary for a time period', {
    period: s('Time period (month, quarter, year)'),
  }, ({ period }: any) => ({ period, total: 1249.50, orders: 12, avg_order: 104.12, top_category: 'Electronics' })),

  get_order_analytics: t('Get analytics about ordering patterns', {}, () => ({
    total_orders: 47, avg_frequency_days: 14, most_ordered: { product: 'Widget', count: 8 },
  })),

  get_savings_report: t('Get a report of savings from deals and coupons', {
    period: s('Time period'),
  }, ({ period }: any) => ({ period, total_saved: 234.50, coupons_used: 8, loyalty_savings: 45.00 })),

  get_purchase_trends: t('Get purchase trends over time', {
    months: on('Number of months'),
  }, () => ({ trends: [{ month: '2024-06', spent: 120 }, { month: '2024-07', spent: 89.99 }] })),

  get_category_spending: t('Get spending breakdown by category', {
    period: s('Time period'),
  }, ({ period }: any) => ({ period, categories: [{ name: 'Electronics', spent: 450 }, { name: 'Clothing', spent: 320 }] })),
};

// ════════════════════════════════════════════
//  EXPORT 128 TOOLS  (OpenAI Chat API max)
// ════════════════════════════════════════════

const allTools: Record<string, any> = {
  ...products,
  ...orders,
  ...cart,
  ...payments,
  ...users,
  ...shipping,
  ...returns,
  ...reviews,
  ...notifications,
  ...inventory,
  ...support,
  ...wishlist,
  ...promotions,
  ...subscriptions,
  ...analytics,
};

// Take exactly 128 tools (OpenAI limit)
const MAX_TOOLS = 128;
const allKeys = Object.keys(allTools);
export const ecommerceTools: Record<string, any> = {};
for (let i = 0; i < Math.min(MAX_TOOLS, allKeys.length); i++) {
  ecommerceTools[allKeys[i]] = allTools[allKeys[i]];
}

const toolCount = Object.keys(ecommerceTools).length;
if (toolCount !== MAX_TOOLS) {
  console.warn(`⚠️  Expected ${MAX_TOOLS} tools, got ${toolCount}`);
}
