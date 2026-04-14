export interface SimStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done';
  startedAt?: number;
  completedAt?: number;
  data?: Record<string, any>;
}

export interface SimResult {
  steps: SimStep[];
  totalMs: number;
  cost: number;
  llmCalls: number;
  response: string;
}

// Tool catalog - 128 tools for e-commerce/support context
export const TOOL_CATALOG: string[] = [
  'get_order', 'cancel_order', 'process_refund', 'send_notification', 'get_customer',
  'update_order', 'check_inventory', 'create_return', 'get_shipping_status', 'update_address',
  'apply_coupon', 'remove_coupon', 'get_payment_method', 'charge_payment', 'void_payment',
  'create_credit', 'get_credit_balance', 'transfer_credit', 'get_invoice', 'send_invoice',
  'create_ticket', 'update_ticket', 'close_ticket', 'assign_ticket', 'escalate_ticket',
  'get_product', 'search_products', 'check_availability', 'get_pricing', 'apply_discount',
  'get_subscription', 'cancel_subscription', 'pause_subscription', 'resume_subscription', 'upgrade_plan',
  'downgrade_plan', 'get_billing_history', 'update_billing', 'get_tax_info', 'calculate_tax',
  'verify_identity', 'check_fraud', 'flag_account', 'unflag_account', 'get_risk_score',
  'send_email', 'send_sms', 'send_push', 'create_template', 'schedule_message',
  'get_analytics', 'track_event', 'get_funnel', 'get_cohort', 'export_report',
  'create_user', 'update_user', 'delete_user', 'get_permissions', 'update_permissions',
  'reset_password', 'enable_2fa', 'disable_2fa', 'generate_api_key', 'revoke_api_key',
  'get_warehouse', 'allocate_stock', 'release_stock', 'transfer_stock', 'count_inventory',
  'create_shipment', 'track_shipment', 'cancel_shipment', 'get_carrier_rates', 'print_label',
  'get_reviews', 'moderate_review', 'respond_to_review', 'get_ratings', 'flag_review',
  'create_campaign', 'send_campaign', 'get_campaign_stats', 'ab_test', 'segment_users',
  'get_chat_history', 'search_knowledge_base', 'suggest_response', 'auto_categorize', 'sentiment_analysis',
  'create_webhook', 'test_webhook', 'delete_webhook', 'get_webhook_logs', 'retry_webhook',
  'sync_crm', 'import_contacts', 'export_contacts', 'merge_duplicates', 'enrich_profile',
  'get_metrics', 'set_alert', 'get_alerts', 'acknowledge_alert', 'get_dashboard',
  'run_query', 'save_query', 'schedule_query', 'get_schema', 'validate_data',
  'deploy_config', 'rollback_config', 'get_feature_flags', 'toggle_feature', 'get_experiments',
  'create_workflow', 'execute_workflow', 'pause_workflow', 'get_workflow_status', 'clone_workflow',
  'get_audit_log', 'export_audit', 'search_logs', 'get_compliance_report', 'archive_data',
  'translate_text', 'detect_language', 'get_locale',
];

// Determine which tools to "use" based on the message
function getToolsForMessage(message: string): string[] {
  const lower = message.toLowerCase();
  // Tool chains match real benchmark patterns (tests/benchmark/tools.ts)
  if (lower.includes('cancel')) return ['get_order', 'cancel_order', 'refund_payment'];
  if (lower.includes('ship') || lower.includes('track') || lower.includes('where')) return ['get_order', 'track_order', 'estimate_delivery'];
  if (lower.includes('payment') || lower.includes('refund') || lower.includes('charge')) return ['get_order', 'get_payment_status', 'refund_payment'];
  if (lower.includes('return')) return ['get_order', 'get_order_items', 'refund_payment'];
  if (lower.includes('invoice') || lower.includes('receipt')) return ['get_order', 'get_invoice'];
  return ['get_order', 'get_order_status'];
}

function getResponseForMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('cancel')) return 'Order cancelled successfully. Refund of $59.99 will be processed within 3-5 business days.';
  if (lower.includes('ship') || lower.includes('track')) return 'Your order is currently in transit. Estimated delivery: April 16, 2026. Tracking: 1Z999AA10123456784';
  if (lower.includes('payment') || lower.includes('refund')) return 'Payment issue resolved. A refund of $59.99 has been initiated to your original payment method.';
  if (lower.includes('return')) return 'Return label generated and sent to your email. Please ship within 14 days.';
  return 'Request processed successfully. A confirmation has been sent to your email.';
}

// Simulate Phase 1: Full LLM (slow, expensive)
export function simulatePhase1(
  message: string,
  onStep: (stepId: string, status: 'active' | 'done', data?: Record<string, any>) => void,
): Promise<SimResult> {
  const tools = getToolsForMessage(message);
  const response = getResponseForMessage(message);

  return new Promise(resolve => {
    const startTime = Date.now();
    let elapsed = 0;

    // Step 1: Intent Analysis (500ms)
    setTimeout(() => onStep('intent', 'active'), elapsed);
    elapsed += 500;
    setTimeout(() => onStep('intent', 'done', { intent: 'order_cancellation' }), elapsed);

    // Step 2: LLM Reasoning (2000ms)
    elapsed += 200;
    setTimeout(() => onStep('reasoning', 'active'), elapsed);
    elapsed += 2000;
    setTimeout(() => onStep('reasoning', 'done', { plan: tools }), elapsed);

    // Step 3-6: Tool executions (400ms each)
    for (let i = 0; i < tools.length; i++) {
      elapsed += 200;
      const toolId = `tool_${i}`;
      setTimeout(() => onStep(toolId, 'active', { name: tools[i] }), elapsed);
      elapsed += 400;
      setTimeout(() => onStep(toolId, 'done', { name: tools[i], success: true }), elapsed);
    }

    // Step 7: Response generation (500ms)
    elapsed += 200;
    setTimeout(() => onStep('response', 'active'), elapsed);
    elapsed += 500;
    setTimeout(() => {
      onStep('response', 'done');
      resolve({
        steps: [],
        totalMs: Date.now() - startTime,
        cost: 0.021,
        llmCalls: 4,
        response,
      });
    }, elapsed);
  });
}

// Simulate Phase 3: Muscle Memory (fast, cheap)
export function simulatePhase3(
  message: string,
  onStep: (stepId: string, status: 'active' | 'done', data?: Record<string, any>) => void,
): Promise<SimResult> {
  const tools = getToolsForMessage(message);
  const response = getResponseForMessage(message);

  return new Promise(resolve => {
    const startTime = Date.now();
    let elapsed = 0;

    // Step 1: Embedding Lookup (instant)
    setTimeout(() => onStep('embedding', 'active', { similarity: 0.94 }), elapsed);
    elapsed += 30;
    setTimeout(() => onStep('embedding', 'done', { similarity: 0.94 }), elapsed);

    // Step 2: Template Match (instant)
    elapsed += 20;
    setTimeout(() => onStep('template', 'active', { confidence: 0.97, name: 'cancel_order' }), elapsed);
    elapsed += 20;
    setTimeout(() => onStep('template', 'done', { confidence: 0.97, name: 'cancel_order' }), elapsed);

    // Step 3: Arg Extraction (150ms for SLM or instant for regex)
    elapsed += 10;
    setTimeout(() => onStep('extraction', 'active'), elapsed);
    elapsed += 80;
    setTimeout(() => onStep('extraction', 'done', { order_id: 'ORD-412' }), elapsed);

    // Step 4: DAG Execution (tools fire rapidly, 20ms each)
    for (let i = 0; i < tools.length; i++) {
      elapsed += 10;
      const toolId = `tool_${i}`;
      setTimeout(() => onStep(toolId, 'active', { name: tools[i] }), elapsed);
      elapsed += 20;
      setTimeout(() => onStep(toolId, 'done', { name: tools[i], success: true }), elapsed);
    }

    // Step 5: Done
    elapsed += 10;
    setTimeout(() => {
      onStep('response', 'done');
      resolve({
        steps: [],
        totalMs: Date.now() - startTime,
        cost: 0.001,
        llmCalls: 0,
        response,
      });
    }, elapsed);
  });
}
