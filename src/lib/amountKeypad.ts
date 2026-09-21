import { round2, formatAmountWithCommas } from './formatters';

export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | 'backspace'
  | '+'
  | '−'
  | '×'
  | '÷'
  | '-'
  | '*'
  | '/';

export interface KeypadRules {
  /** Maximum number of integer digits allowed before the decimal point (default: 9) */
  maxIntegerDigits?: number;
  /** Maximum number of decimal digits allowed after the decimal point (default: 2) */
  maxDecimals?: number;
}

export const DEFAULT_KEYPAD_RULES: Required<KeypadRules> = {
  maxIntegerDigits: 9,
  maxDecimals: 2,
};

export const OPERATOR_CHARS = ['+', '−', '×', '÷'] as const;
export type OperatorChar = (typeof OPERATOR_CHARS)[number];

const OPERATOR_SET = new Set<string>(['+', '−', '×', '÷', '-', '*', '/']);
export function isOperator(key: string): boolean {
  return OPERATOR_SET.has(key);
}

const OPERATOR_MAP: Record<string, OperatorChar> = {
  '-': '−', '−': '−',
  '*': '×', '×': '×',
  '/': '÷', '÷': '÷',
};
export function normalizeOperator(key: string): OperatorChar {
  return OPERATOR_MAP[key] ?? '+';
}

/**
 * Applies a keypad key press to the current raw amount/expression string.
 * Supports standard numeric limits as well as binary math operators (+, −, ×, ÷).
 */
export function applyKeypadPress(
  current: string,
  key: KeypadKey | string,
  rules: KeypadRules = DEFAULT_KEYPAD_RULES
): string {
  const maxIntegerDigits = rules.maxIntegerDigits ?? DEFAULT_KEYPAD_RULES.maxIntegerDigits;
  const maxDecimals = rules.maxDecimals ?? DEFAULT_KEYPAD_RULES.maxDecimals;

  if (key === 'backspace') {
    if (!current) return '';
    // If ending with " <op> " (3 characters), drop the operator and surrounding spaces
    for (const op of OPERATOR_CHARS) {
      if (current.endsWith(` ${op} `)) {
        return current.slice(0, -3);
      }
    }
    // If ending with trailing space
    if (current.endsWith(' ')) {
      return current.trimEnd().slice(0, -1).trimEnd();
    }
    return current.slice(0, -1);
  }

  // Operator handling (+, −, ×, ÷)
  if (isOperator(key)) {
    const op = normalizeOperator(key);
    if (!current || current === '0' || current === '0.') {
      // Cannot start expression with an operator
      return current;
    }
    // If already ending with an operator, replace it
    for (const existingOp of OPERATOR_CHARS) {
      if (current.endsWith(` ${existingOp} `)) {
        return current.slice(0, -3) + ` ${op} `;
      }
    }
    // If ending with '.', strip the trailing dot before appending operator
    let base = current;
    if (base.endsWith('.')) {
      base = base.slice(0, -1);
    }
    return `${base} ${op} `;
  }

  // Find the active numeric segment (after the last operator)
  const lastOpIndex = Math.max(
    current.lastIndexOf(' + '),
    current.lastIndexOf(' − '),
    current.lastIndexOf(' × '),
    current.lastIndexOf(' ÷ ')
  );

  const prefix = lastOpIndex >= 0 ? current.slice(0, lastOpIndex + 3) : '';
  const activeSegment = lastOpIndex >= 0 ? current.slice(lastOpIndex + 3) : current;

  if (key === '.') {
    if (activeSegment.includes('.')) {
      return current;
    }
    if (activeSegment === '') {
      return prefix + '0.';
    }
    return prefix + activeSegment + '.';
  }

  // Digit keys ('0'..'9')
  if (activeSegment === '0') {
    if (key === '0') return current;
    return prefix + key;
  }

  if (activeSegment.includes('.')) {
    const [_, decimalPart = ''] = activeSegment.split('.');
    if (decimalPart.length >= maxDecimals) {
      return current;
    }
    return prefix + activeSegment + key;
  }

  if (activeSegment.length >= maxIntegerDigits) {
    return current;
  }

  return prefix + activeSegment + key;
}

export interface EvaluationResult {
  result: number;
  isDivisionByZero: boolean;
  hasOperator: boolean;
  hasCalculation: boolean;
  cleanExpression: string;
}

/**
 * Parses and evaluates a mathematical expression with standard operator precedence
 * (multiplication/division before addition/subtraction).
 * Returns live evaluated result and flags for division by zero.
 */
export function evaluateExpression(expr: string): EvaluationResult {
  if (!expr) {
    return {
      result: 0,
      isDivisionByZero: false,
      hasOperator: false,
      hasCalculation: false,
      cleanExpression: '',
    };
  }

  const hasAnyOperator = OPERATOR_CHARS.some((op) => expr.includes(op));
  if (!hasAnyOperator) {
    const val = parseFloat(expr);
    const num = isNaN(val) ? 0 : val;
    return {
      result: num,
      isDivisionByZero: false,
      hasOperator: false,
      hasCalculation: false,
      cleanExpression: expr,
    };
  }

  const rawTokens = expr.trim().split(/\s+/).filter(Boolean);

  // Pop incomplete trailing operator for live evaluation (e.g. ["350", "+"] -> ["350"])
  const tokens = [...rawTokens];
  while (tokens.length > 0 && isOperator(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  if (tokens.length === 0) {
    return {
      result: 0,
      isDivisionByZero: false,
      hasOperator: true,
      hasCalculation: false,
      cleanExpression: '',
    };
  }

  const nums: number[] = [];
  const ops: OperatorChar[] = [];

  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0) {
      const val = parseFloat(tokens[i]);
      nums.push(isNaN(val) ? 0 : val);
    } else {
      ops.push(normalizeOperator(tokens[i]));
    }
  }

  // Pass 1: Multiplications (×) and Divisions (÷)
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op === '×') {
      nums[i] = nums[i] * nums[i + 1];
      nums.splice(i + 1, 1);
      ops.splice(i, 1);
    } else if (op === '÷') {
      if (nums[i + 1] === 0) {
        return {
          result: 0,
          isDivisionByZero: true,
          hasOperator: true,
          hasCalculation: true,
          cleanExpression: tokens.join(' '),
        };
      }
      nums[i] = nums[i] / nums[i + 1];
      nums.splice(i + 1, 1);
      ops.splice(i, 1);
    } else {
      i++;
    }
  }

  // Pass 2: Additions (+) and Subtractions (−)
  i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op === '+') {
      nums[i] = nums[i] + nums[i + 1];
      nums.splice(i + 1, 1);
      ops.splice(i, 1);
    } else if (op === '−') {
      nums[i] = nums[i] - nums[i + 1];
      nums.splice(i + 1, 1);
      ops.splice(i, 1);
    } else {
      i++;
    }
  }

  const finalResult = Math.max(0, round2(nums[0] || 0));
  const hasCalculation = tokens.length >= 3;

  return {
    result: finalResult,
    isDivisionByZero: false,
    hasOperator: true,
    hasCalculation,
    cleanExpression: tokens.join(' '),
  };
}

/**
 * Formats each numeric segment in an expression with Indian commas while keeping operators intact.
 * e.g. "1200 + 350.5" → "1,200 + 350.5"
 */
export function formatExpressionWithCommas(expr: string): string {
  if (!expr) return '';
  const tokens = expr.split(' ');
  const formattedTokens = tokens.map((token) => {
    if (isOperator(token)) return token;
    return formatAmountWithCommas(token) || token;
  });
  return formattedTokens.join(' ');
}

/**
 * Parses raw keypad string/expression to a numeric float amount.
 * Evaluates any arithmetic expressions present.
 */
export function parseKeypadAmount(raw: string): number {
  if (!raw) return 0;
  const { result } = evaluateExpression(raw);
  return result;
}
