/**
 * Single source of truth for demo slide content.
 *
 * Queries come from the benchmark (tests/benchmark/queries.ts).
 * Tool names mirror the 128 tools registered in tests/benchmark/tools.ts —
 * kept as a flat list here so the demo doesn't pull in `ai`/`zod`.
 * Stats are the headline numbers from the 1000-query benchmark run
 * (gpt-5.4, 128 tools) described in the 67a4989 commit.
 */
export { QUERY_PATTERNS, PATTERN_NAMES, makeQuery } from '../../tests/benchmark/queries.js';
import { QUERY_PATTERNS, makeQuery } from '../../tests/benchmark/queries.js';

// Tool names in registration order from tests/benchmark/tools.ts (first 128).
export const TOOL_NAMES: string[] = [
  'search_products', 'get_product', 'list_categories', 'get_category', 'compare_products',
  'get_product_reviews', 'get_price_history', 'get_related_products', 'check_compatibility',
  'get_product_specs', 'get_brand_info', 'list_brands', 'get_bestsellers', 'get_new_arrivals',
  'get_product_images', 'get_product_variants', 'get_product_availability', 'get_product_questions',
  'get_product_answers', 'get_size_guide', 'get_product_warranty', 'get_product_bundle',
  'get_product_rating_breakdown', 'create_order', 'get_order', 'cancel_order', 'list_orders',
  'update_order', 'get_order_history', 'reorder', 'get_invoice', 'get_receipt', 'estimate_delivery',
  'track_order', 'modify_order_address', 'add_order_note', 'get_order_timeline', 'get_order_items',
  'split_order', 'merge_orders', 'get_order_status', 'apply_order_discount', 'get_order_total',
  'duplicate_order', 'verify_order', 'get_order_tax_breakdown', 'add_to_cart', 'remove_from_cart',
  'update_cart_quantity', 'get_cart', 'clear_cart', 'apply_coupon', 'remove_coupon', 'get_cart_total',
  'save_cart', 'restore_cart', 'share_cart', 'move_to_wishlist_from_cart', 'get_cart_recommendations',
  'validate_cart', 'checkout_cart', 'get_payment_methods', 'add_payment_method', 'remove_payment_method',
  'process_payment', 'get_payment_status', 'refund_payment', 'get_balance', 'get_transactions',
  'set_default_payment', 'validate_card', 'get_payment_plans', 'create_installment_plan',
  'get_store_credit', 'apply_store_credit', 'get_gift_card_balance', 'redeem_gift_card',
  'get_payment_receipt', 'void_payment', 'get_profile', 'update_profile', 'get_addresses',
  'add_address', 'update_address', 'delete_address', 'set_default_address', 'get_preferences',
  'update_preferences', 'get_loyalty_points', 'redeem_points', 'get_tier_status', 'change_password',
  'enable_2fa', 'get_login_history', 'deactivate_account', 'get_recently_viewed', 'get_shipping_rates',
  'estimate_delivery_date', 'get_shipping_options', 'track_shipment', 'get_tracking_details',
  'create_shipping_label', 'get_pickup_locations', 'schedule_pickup', 'get_customs_info',
  'calculate_duties', 'get_carrier_info', 'compare_shipping_rates', 'get_delivery_windows',
  'request_signature_delivery', 'get_shipping_insurance', 'create_return', 'get_return_status',
  'get_return_label', 'list_returns', 'cancel_return', 'get_return_policy', 'exchange_item',
  'get_refund_status', 'request_store_credit_return', 'get_return_reasons', 'schedule_return_pickup',
  'get_return_timeline', 'update_return_reason', 'approve_return', 'get_return_shipping_cost',
  'create_review', 'get_review',
];

// Realistic tool chain per benchmark pattern.
// Tools are drawn from TOOL_NAMES (real benchmark tools).
export const PATTERN_TOOL_CHAINS: Record<string, string[]> = {
  cancel_order:          ['get_order', 'cancel_order', 'refund_payment'],
  track_order:           ['get_order', 'track_order', 'estimate_delivery'],
  return_item:           ['get_order', 'create_return', 'get_return_label'],
  check_order_status:    ['get_order', 'get_order_status'],
  process_refund:        ['get_order', 'get_payment_status', 'refund_payment'],
  get_order_invoice:     ['get_order', 'get_invoice'],
  check_stock:           ['get_product', 'get_product_availability'],
  add_to_cart:           ['get_product', 'add_to_cart', 'get_cart_total'],
  apply_coupon:          ['get_cart', 'apply_coupon', 'get_cart_total'],
  create_support_ticket: ['get_profile', 'get_order', 'create_review'],
  get_refund_status:     ['get_order', 'get_refund_status'],
  exchange_product:      ['get_order', 'exchange_item', 'get_return_label'],
  cancel_subscription:   ['get_profile', 'get_order', 'cancel_order'],
  check_loyalty_points:  ['get_profile', 'get_loyalty_points'],
  add_to_wishlist:       ['get_product', 'move_to_wishlist_from_cart'],
  get_shipping_rates:    ['get_order', 'get_shipping_rates'],
  subscribe_stock_alert: ['get_product', 'get_product_availability'],
  get_payment_status:    ['get_order', 'get_payment_status'],
  reorder_previous:      ['get_order_history', 'reorder'],
  get_order_details:     ['get_order', 'get_order_items', 'get_order_total'],
};

export function getToolsForPattern(pattern: string): string[] {
  return PATTERN_TOOL_CHAINS[pattern] ?? ['get_order', 'get_order_status'];
}

// Map a free-form user message back to the closest benchmark pattern.
// Used by the interactive playground.
export function inferPattern(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('cancel') && lower.includes('subscription')) return 'cancel_subscription';
  if (lower.includes('cancel')) return 'cancel_order';
  if (lower.includes('track') || lower.includes('where') || lower.includes('ship')) return 'track_order';
  if (lower.includes('return')) return 'return_item';
  if (lower.includes('refund') && lower.includes('status')) return 'get_refund_status';
  if (lower.includes('refund') || lower.includes('payment')) return 'process_refund';
  if (lower.includes('invoice') || lower.includes('receipt')) return 'get_order_invoice';
  if (lower.includes('stock') || lower.includes('available')) return 'check_stock';
  if (lower.includes('cart')) return 'add_to_cart';
  if (lower.includes('coupon') || lower.includes('discount')) return 'apply_coupon';
  if (lower.includes('status')) return 'check_order_status';
  return 'get_order_details';
}

// Sample queries for the playground — hand-picked short templates from
// QUERY_PATTERNS so they fit the preset chips.
// Indices picked so each maps to the shortest template for that pattern.
export const SAMPLE_QUERIES: { pattern: string; query: string }[] = [
  { pattern: 'cancel_order',       query: makeQuery('cancel_order',       410) }, // template 0
  { pattern: 'track_order',        query: makeQuery('track_order',        332) }, // template 2
  { pattern: 'process_refund',     query: makeQuery('process_refund',     207) }, // template 7
  { pattern: 'return_item',        query: makeQuery('return_item',        893) }, // template 3
];

// ─── Benchmark stats (from commit 67a4989: 1000 queries, gpt-5.4, 128 tools) ───
export const BENCHMARK_STATS = {
  totalQueries: 1000,
  toolCount: 128,
  patternCount: 20,
  model: 'gpt-5.4',
  memoryHits: 822,
  speedup: 2.3,       // ×
  costSavings: 62,    // %
  tokenSavings: 82,   // %
  // Derived aggregates used in the comparison table.
  // Exact per-query averages are not stored in the repo; these are consistent
  // extrapolations from the reported ratios (avg ~2400 tok/query without MM).
  avgLatWithoutMs: 4200,
  avgLatWithMs: 1800,
  totalCostWithout: 21.0,
  totalCostWith: 7.98,
  totalTokensWithout: 2_400_000,
  totalTokensWith: 432_000,
} as const;

// Sample cancel_order tool chain used by LearningSlide as an illustrative DAG.
// Mirrors PATTERN_TOOL_CHAINS.cancel_order with two extra optional nodes.
export const CANCEL_ORDER_DAG = {
  nodes: ['get_order', 'get_order_status', 'cancel_order', 'get_order_total', 'refund_payment'],
  // (from, to, weight, dashed) — dashed = rare branch
  edges: [
    { from: 0, to: 1, weight: 0.92, dashed: false },
    { from: 1, to: 2, weight: 0.88, dashed: false },
    { from: 2, to: 4, weight: 0.80, dashed: false },
    { from: 2, to: 3, weight: 0.20, dashed: true  },
  ],
} as const;
