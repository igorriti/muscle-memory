export function evaluateCondition(
  condition: string | null,
  context: Record<string, any>,
): boolean {
  if (condition === null) return true;

  const match = condition.match(/^([\w.]+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
  if (!match) return false;

  const [, path, operator, rawValue] = match;
  const actual = resolvePath(context, path);

  let expected: any = rawValue.trim();
  if (expected.startsWith("'") && expected.endsWith("'")) {
    expected = expected.slice(1, -1);
  } else if (expected === 'true') {
    expected = true;
  } else if (expected === 'false') {
    expected = false;
  } else if (!isNaN(Number(expected))) {
    expected = Number(expected);
  }

  switch (operator) {
    case '==': return actual == expected;
    case '!=': return actual != expected;
    case '>':  return actual > expected;
    case '<':  return actual < expected;
    case '>=': return actual >= expected;
    case '<=': return actual <= expected;
    default: return false;
  }
}

function resolvePath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}
