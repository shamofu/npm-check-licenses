import parse from 'spdx-expression-parse'

export type LicenseCondition =
  | 'notice'
  | 'document-changes'
  | 'patent-grant'
  | 'disclose-source'
  | 'same-license'
  | 'network-use-disclose'

export interface ConditionDescription {
  label: string
  description: string
}

// Maps SPDX license identifiers to the conditions that must be satisfied when using them.
// The inclusion relationship: if conditions(A) ⊆ conditions(B), then A is "included" in B —
// any project that must satisfy B's conditions automatically satisfies A's as well.
const CONDITIONS_MAP: Record<string, LicenseCondition[]> = {
  'CC0-1.0':           [],
  'Unlicense':         [],
  'MIT':               ['notice'],
  'ISC':               ['notice'],
  'BSD-2-Clause':      ['notice'],
  'BSD-3-Clause':      ['notice'],
  'Apache-2.0':        ['notice', 'document-changes', 'patent-grant'],
  'MPL-2.0':           ['notice', 'disclose-source'],
  'LGPL-2.0-only':     ['notice', 'disclose-source', 'same-license'],
  'LGPL-2.1-only':     ['notice', 'disclose-source', 'same-license'],
  'LGPL-3.0-only':     ['notice', 'disclose-source', 'same-license', 'patent-grant'],
  'GPL-2.0-only':      ['notice', 'disclose-source', 'same-license'],
  'GPL-2.0-or-later':  ['notice', 'disclose-source', 'same-license'],
  'GPL-3.0-only':      ['notice', 'disclose-source', 'same-license', 'patent-grant'],
  'GPL-3.0-or-later':  ['notice', 'disclose-source', 'same-license', 'patent-grant'],
  'AGPL-3.0-only':     ['notice', 'disclose-source', 'same-license', 'patent-grant', 'network-use-disclose'],
  'AGPL-3.0-or-later': ['notice', 'disclose-source', 'same-license', 'patent-grant', 'network-use-disclose'],
}

export const CONDITION_DESCRIPTIONS: Record<LicenseCondition, ConditionDescription> = {
  'notice':               { label: 'notice',               description: 'Include copyright notice and license text in all copies' },
  'document-changes':     { label: 'document-changes',     description: 'Document significant changes made to the source code' },
  'patent-grant':         { label: 'patent-grant',         description: 'Grant patent rights; do not initiate patent litigation' },
  'disclose-source':      { label: 'disclose-source',      description: 'Make complete source code available when distributing' },
  'same-license':         { label: 'same-license',         description: 'Distribute derivative works under the same license (copyleft)' },
  'network-use-disclose': { label: 'network-use-disclose', description: 'Disclose source code even for network/server use (AGPL requirement)' },
}

// Canonical display order for conditions (least to most restrictive)
const CONDITION_ORDER: LicenseCondition[] = [
  'notice',
  'document-changes',
  'patent-grant',
  'disclose-source',
  'same-license',
  'network-use-disclose',
]

type SpdxLeafNode = { license: string; plus?: boolean }
type SpdxBinaryNode = { left: SpdxNode; conjunction: 'or' | 'and'; right: SpdxNode }
type SpdxNode = SpdxLeafNode | SpdxBinaryNode

function conditionsForNode(node: SpdxNode): Set<LicenseCondition> {
  if ('license' in node) {
    // Handle the "+" (or-later) suffix: GPL-3.0+ means GPL-3.0-or-later
    const id = node.plus ? `${node.license}-or-later` : node.license
    return new Set(CONDITIONS_MAP[id] ?? CONDITIONS_MAP[node.license] ?? [])
  }
  const left = conditionsForNode(node.left)
  const right = conditionsForNode(node.right)
  if (node.conjunction === 'and') {
    // AND: must comply with both — union of conditions (more restrictive)
    return new Set([...left, ...right])
  } else {
    // OR: may choose either — intersection of conditions (less restrictive)
    return new Set([...left].filter(c => right.has(c)))
  }
}

/**
 * Returns the set of conditions required by an SPDX expression.
 * Handles compound expressions: OR takes the intersection (user's choice),
 * AND takes the union (must comply with both).
 */
export function conditionsForExpression(spdxExpression: string): Set<LicenseCondition> {
  try {
    const ast = parse(spdxExpression) as SpdxNode
    return conditionsForNode(ast)
  } catch {
    return new Set()
  }
}

/**
 * Computes the union of all conditions across a list of SPDX license identifiers/expressions.
 * This represents the complete set of obligations that must be satisfied when using
 * all listed licenses together. Conditions included in multiple licenses appear only once
 * (inclusion relationship: e.g., MIT's {notice} is already covered when Apache-2.0's
 * {notice, document-changes, patent-grant} is required).
 */
export function computeAllConditions(licenses: string[]): LicenseCondition[] {
  const all = new Set<LicenseCondition>()
  for (const lic of licenses) {
    for (const cond of conditionsForExpression(lic)) {
      all.add(cond)
    }
  }
  return CONDITION_ORDER.filter(c => all.has(c))
}
