export type NodeCategory = 'input' | 'reasoning' | 'tool' | 'embedding' | 'template' | 'dag' | 'response' | 'data';

export interface NodeStyle {
  rx: number;
  bodyFill: string;
  bodyStroke: string;
  bodyStrokeDash: string;
  textFill: string;
  accentColor: string;
  hasLeftBar: boolean;
  hasBottomBar: boolean;
  hasInnerBorder: boolean;
}

/**
 * Differentiation through color + shape + structure:
 *
 *  input     – rounded (rx=10), blue tint, blue accent bar
 *  data      – rounded (rx=8), warm tint, amber accent bar
 *  reasoning – dashed border, purple tint, purple accent bar
 *  tool      – sharp corners (rx=2), dark/inverted body, light text
 *  embedding – teal tint, inner dotted border, teal accent bar
 *  template  – dotted border, yellow tint, yellow accent bar
 *  dag       – standard white (mini-dag content differentiates)
 *  response  – green tint, green accent bar + bottom bar, green text
 */
export const NODE_STYLES: Record<NodeCategory, NodeStyle> = {
  input: {
    rx: 10,
    bodyFill: '#eff3ff',
    bodyStroke: '#c7d7fe',
    bodyStrokeDash: '',
    textFill: '#334',
    accentColor: '#3b82f6',
    hasLeftBar: true,
    hasBottomBar: false,
    hasInnerBorder: false,
  },
  data: {
    rx: 8,
    bodyFill: '#fdf8f0',
    bodyStroke: '#e8dcc8',
    bodyStrokeDash: '',
    textFill: '#444',
    accentColor: '#d97706',
    hasLeftBar: true,
    hasBottomBar: false,
    hasInnerBorder: false,
  },
  reasoning: {
    rx: 6,
    bodyFill: '#f6f2ff',
    bodyStroke: '#cbb8ff',
    bodyStrokeDash: '6,3',
    textFill: '#444',
    accentColor: '#8b5cf6',
    hasLeftBar: true,
    hasBottomBar: false,
    hasInnerBorder: false,
  },
  tool: {
    rx: 2,
    bodyFill: '#282835',
    bodyStroke: '#3a3a48',
    bodyStrokeDash: '',
    textFill: '#b8b8c8',
    accentColor: '#f59e0b',
    hasLeftBar: false,
    hasBottomBar: false,
    hasInnerBorder: false,
  },
  embedding: {
    rx: 6,
    bodyFill: '#eefcf9',
    bodyStroke: '#94ede0',
    bodyStrokeDash: '',
    textFill: '#334',
    accentColor: '#14b8a6',
    hasLeftBar: true,
    hasBottomBar: false,
    hasInnerBorder: true,
  },
  template: {
    rx: 6,
    bodyFill: '#fefce8',
    bodyStroke: '#f5d565',
    bodyStrokeDash: '3,3',
    textFill: '#444',
    accentColor: '#eab308',
    hasLeftBar: true,
    hasBottomBar: false,
    hasInnerBorder: false,
  },
  dag: {
    rx: 6,
    bodyFill: '#fff',
    bodyStroke: '#e0e0e0',
    bodyStrokeDash: '',
    textFill: '#444',
    accentColor: '#10b981',
    hasLeftBar: false,
    hasBottomBar: false,
    hasInnerBorder: false,
  },
  response: {
    rx: 8,
    bodyFill: '#effdf4',
    bodyStroke: '#86efac',
    bodyStrokeDash: '',
    textFill: '#166534',
    accentColor: '#22c55e',
    hasLeftBar: true,
    hasBottomBar: true,
    hasInnerBorder: false,
  },
};

export const HEADER_COLOR = '#1a1a1a';
export const HEADER_H = 30;
