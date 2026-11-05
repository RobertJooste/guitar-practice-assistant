import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD_LAYOUT,
  isDashboardLayout,
  isDefaultDashboardLayout,
  migrateDashboardLayout,
  moveDashboardWidget,
  type DashboardLayout,
} from './dashboard-layout'

describe('dashboard layout', () => {
  it('accepts the default layout and detects customized layouts', () => {
    expect(isDashboardLayout(DEFAULT_DASHBOARD_LAYOUT)).toBe(true)
    expect(isDefaultDashboardLayout(DEFAULT_DASHBOARD_LAYOUT)).toBe(true)
    expect(isDefaultDashboardLayout({
      ...DEFAULT_DASHBOARD_LAYOUT,
      hidden: ['weekly-chart'],
    })).toBe(false)
  })

  it('rejects invalid ordering, visibility, and sizing data', () => {
    expect(isDashboardLayout({ ...DEFAULT_DASHBOARD_LAYOUT, order: ['weekly-chart'] })).toBe(false)
    expect(isDashboardLayout({
      ...DEFAULT_DASHBOARD_LAYOUT,
      hidden: ['not-a-widget'],
    })).toBe(false)
    expect(isDashboardLayout({
      ...DEFAULT_DASHBOARD_LAYOUT,
      sizes: { ...DEFAULT_DASHBOARD_LAYOUT.sizes, 'weekly-chart': 'large' },
    })).toBe(false)
  })

  it('rejects invalid schema versions', () => {
    expect(isDashboardLayout({ ...DEFAULT_DASHBOARD_LAYOUT, schemaVersion: Infinity })).toBe(false)
    expect(isDashboardLayout({ ...DEFAULT_DASHBOARD_LAYOUT, schemaVersion: 1.5 })).toBe(false)
    expect(isDashboardLayout({ ...DEFAULT_DASHBOARD_LAYOUT, schemaVersion: 0 })).toBe(false)
  })

  it('moves widgets without mutating the original order', () => {
    const moved = moveDashboardWidget(DASHBOARD_WIDGETS.slice(), 'weekly-summary', 0)

    expect(moved).toEqual([
      'weekly-summary',
      'activity-stats',
      'weekly-goal',
      'weekly-chart',
      'routine-preview',
    ])
    expect(DASHBOARD_WIDGETS[0]).toBe('activity-stats')
    expect(moveDashboardWidget(moved, 'weekly-summary', 5)).toBe(moved)
  })

  it('updates the previous untouched layout while preserving user customizations', () => {
    const allFullLegacy: DashboardLayout = {
      order: [...DASHBOARD_WIDGETS],
      hidden: [],
      sizes: {
        'activity-stats': 'full',
        'weekly-summary': 'full',
        'weekly-goal': 'full',
        'weekly-chart': 'full',
        'routine-preview': 'full',
      },
    }

    expect(migrateDashboardLayout(allFullLegacy)).toEqual(DEFAULT_DASHBOARD_LAYOUT)
    expect(migrateDashboardLayout({
      ...allFullLegacy,
      hidden: ['weekly-chart'],
    })).toMatchObject({ hidden: ['weekly-chart'] })
  })

  it('does not re-migrate a versioned layout even when all sizes are full', () => {
    const allFullVersioned: DashboardLayout = {
      order: [...DASHBOARD_WIDGETS],
      hidden: [],
      sizes: {
        'activity-stats': 'full',
        'weekly-summary': 'full',
        'weekly-goal': 'full',
        'weekly-chart': 'full',
        'routine-preview': 'full',
      },
      schemaVersion: 1,
    }

    expect(migrateDashboardLayout(allFullVersioned)).toBe(allFullVersioned)
  })

  it('stamps schemaVersion on legacy non-default layouts', () => {
    const legacyCustom: DashboardLayout = {
      order: [...DASHBOARD_WIDGETS],
      hidden: ['weekly-chart'],
      sizes: {
        'activity-stats': 'full',
        'weekly-summary': 'full',
        'weekly-goal': 'full',
        'weekly-chart': 'full',
        'routine-preview': 'full',
      },
    }

    const migrated = migrateDashboardLayout(legacyCustom)
    expect(migrated.schemaVersion).toBe(1)
    expect(migrated.hidden).toEqual(['weekly-chart'])
  })
})
