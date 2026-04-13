import { describe, it, expect } from 'vitest'
import { conditionsForExpression, computeAllConditions } from '../license-conditions.js'

describe('conditionsForExpression', () => {
  describe('single licenses', () => {
    it('returns [notice] for MIT', () => {
      expect(conditionsForExpression('MIT')).toEqual(new Set(['notice']))
    })

    it('returns [notice] for ISC', () => {
      expect(conditionsForExpression('ISC')).toEqual(new Set(['notice']))
    })

    it('returns [notice] for BSD-2-Clause', () => {
      expect(conditionsForExpression('BSD-2-Clause')).toEqual(new Set(['notice']))
    })

    it('returns empty set for CC0-1.0 (public domain)', () => {
      expect(conditionsForExpression('CC0-1.0')).toEqual(new Set())
    })

    it('returns empty set for Unlicense (public domain)', () => {
      expect(conditionsForExpression('Unlicense')).toEqual(new Set())
    })

    it('returns correct conditions for Apache-2.0', () => {
      expect(conditionsForExpression('Apache-2.0')).toEqual(
        new Set(['notice', 'document-changes', 'patent-grant'])
      )
    })

    it('returns correct conditions for MPL-2.0', () => {
      expect(conditionsForExpression('MPL-2.0')).toEqual(
        new Set(['notice', 'disclose-source'])
      )
    })

    it('returns correct conditions for GPL-3.0-or-later', () => {
      expect(conditionsForExpression('GPL-3.0-or-later')).toEqual(
        new Set(['notice', 'disclose-source', 'same-license', 'patent-grant'])
      )
    })

    it('returns correct conditions for GPL-3.0-only', () => {
      expect(conditionsForExpression('GPL-3.0-only')).toEqual(
        new Set(['notice', 'disclose-source', 'same-license', 'patent-grant'])
      )
    })

    it('returns all conditions for AGPL-3.0-or-later', () => {
      expect(conditionsForExpression('AGPL-3.0-or-later')).toEqual(
        new Set(['notice', 'disclose-source', 'same-license', 'patent-grant', 'network-use-disclose'])
      )
    })
  })

  describe('plus (+) notation for or-later', () => {
    it('treats GPL-3.0+ same as GPL-3.0-or-later', () => {
      expect(conditionsForExpression('GPL-3.0+')).toEqual(
        conditionsForExpression('GPL-3.0-or-later')
      )
    })

    it('treats GPL-2.0+ same as GPL-2.0-or-later', () => {
      expect(conditionsForExpression('GPL-2.0+')).toEqual(
        conditionsForExpression('GPL-2.0-or-later')
      )
    })
  })

  describe('error resilience', () => {
    it('returns empty set for unknown license', () => {
      expect(conditionsForExpression('UNKNOWN-LICENSE-1.0')).toEqual(new Set())
    })

    it('returns empty set for malformed expression', () => {
      expect(conditionsForExpression('not!!valid')).toEqual(new Set())
    })
  })

  describe('OR expressions (intersection — user may choose either)', () => {
    it('MIT OR Apache-2.0 yields only [notice] (intersection)', () => {
      // MIT: {notice}, Apache-2.0: {notice, document-changes, patent-grant}
      // OR → intersection = {notice}
      expect(conditionsForExpression('MIT OR Apache-2.0')).toEqual(
        new Set(['notice'])
      )
    })

    it('MIT OR CC0-1.0 yields empty set (CC0 has no conditions)', () => {
      expect(conditionsForExpression('MIT OR CC0-1.0')).toEqual(new Set())
    })

    it('GPL-3.0-only OR Apache-2.0 yields common conditions only', () => {
      // GPL-3.0: {notice, disclose-source, same-license, patent-grant}
      // Apache-2.0: {notice, document-changes, patent-grant}
      // OR → intersection = {notice, patent-grant}
      expect(conditionsForExpression('GPL-3.0-only OR Apache-2.0')).toEqual(
        new Set(['notice', 'patent-grant'])
      )
    })
  })

  describe('AND expressions (union — must comply with both)', () => {
    it('MIT AND Apache-2.0 yields all Apache-2.0 conditions', () => {
      // MIT: {notice}, Apache-2.0: {notice, document-changes, patent-grant}
      // AND → union = {notice, document-changes, patent-grant}
      expect(conditionsForExpression('MIT AND Apache-2.0')).toEqual(
        new Set(['notice', 'document-changes', 'patent-grant'])
      )
    })

    it('GPL-3.0-only AND Apache-2.0 combines copyleft and document-changes', () => {
      expect(conditionsForExpression('GPL-3.0-only AND Apache-2.0')).toEqual(
        new Set(['notice', 'document-changes', 'patent-grant', 'disclose-source', 'same-license'])
      )
    })
  })
})

describe('computeAllConditions', () => {
  it('returns [] for empty input', () => {
    expect(computeAllConditions([])).toEqual([])
  })

  it('returns [notice] for single MIT', () => {
    expect(computeAllConditions(['MIT'])).toEqual(['notice'])
  })

  it('returns [] for public domain licenses only', () => {
    expect(computeAllConditions(['CC0-1.0', 'Unlicense'])).toEqual([])
  })

  it('MIT conditions are included in Apache-2.0 (inclusion relationship)', () => {
    // MIT: {notice} ⊆ Apache-2.0: {notice, document-changes, patent-grant}
    // Combined: same as Apache-2.0 alone
    expect(computeAllConditions(['MIT', 'Apache-2.0'])).toEqual(
      ['notice', 'document-changes', 'patent-grant']
    )
  })

  it('MIT + Apache-2.0 + GPL-3.0 yields union of all conditions', () => {
    expect(computeAllConditions(['MIT', 'Apache-2.0', 'GPL-3.0-or-later'])).toEqual(
      ['notice', 'document-changes', 'patent-grant', 'disclose-source', 'same-license']
    )
  })

  it('deduplicates: same license twice equals once', () => {
    expect(computeAllConditions(['MIT', 'MIT'])).toEqual(
      computeAllConditions(['MIT'])
    )
  })

  it('AGPL-3.0-or-later includes network-use-disclose', () => {
    expect(computeAllConditions(['AGPL-3.0-or-later'])).toEqual(
      ['notice', 'patent-grant', 'disclose-source', 'same-license', 'network-use-disclose']
    )
  })

  it('returns conditions in canonical order regardless of input order', () => {
    const result = computeAllConditions(['GPL-3.0-only', 'Apache-2.0'])
    expect(result).toEqual(
      ['notice', 'document-changes', 'patent-grant', 'disclose-source', 'same-license']
    )
  })

  it('handles SPDX OR expressions in license list', () => {
    // "MIT OR Apache-2.0" resolves to {notice} only
    expect(computeAllConditions(['MIT OR Apache-2.0'])).toEqual(['notice'])
  })
})
