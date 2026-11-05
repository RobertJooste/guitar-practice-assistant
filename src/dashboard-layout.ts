export const DASHBOARD_WIDGETS = [
  'activity-stats',
  'weekly-summary',
  'weekly-goal',
  'weekly-chart',
  'routine-preview',
] as const

export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number]
export type DashboardWidgetSize = 'half' | 'full'

export type DashboardLayout = {
  order: DashboardWidget[]
  hidden: DashboardWidget[]
  sizes: Record<DashboardWidget, DashboardWidgetSize>
  schemaVersion?: number
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  order: [...DASHBOARD_WIDGETS],
  hidden: [],
  sizes: {
    'activity-stats': 'full',
    'weekly-summary': 'half',
    'weekly-goal': 'half',
    'weekly-chart': 'half',
    'routine-preview': 'half',
  },
  schemaVersion: 1,
}

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidget, string> = {
  'activity-stats': 'Activity stats',
  'weekly-summary': 'Weekly summary',
  'weekly-goal': 'Weekly goal',
  'weekly-chart': 'Seven-day practice chart',
  'routine-preview': 'Selected routine preview',
}

const isDashboardWidget = (value: unknown): value is DashboardWidget =>
  typeof value === 'string' && DASHBOARD_WIDGETS.some((widget) => widget === value)

export const isDashboardLayout = (value: unknown): value is DashboardLayout => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const layout = value as Record<string, unknown>
  if (
    !Array.isArray(layout.order) ||
    layout.order.length !== DASHBOARD_WIDGETS.length ||
    !layout.order.every(isDashboardWidget) ||
    new Set(layout.order).size !== DASHBOARD_WIDGETS.length ||
    !Array.isArray(layout.hidden) ||
    !layout.hidden.every(isDashboardWidget) ||
    new Set(layout.hidden).size !== layout.hidden.length ||
    !layout.sizes ||
    typeof layout.sizes !== 'object' ||
    Array.isArray(layout.sizes)
  ) {
    return false
  }

  const sizes = layout.sizes as Record<string, unknown>
  if (
    !DASHBOARD_WIDGETS.every((widget) => sizes[widget] === 'half' || sizes[widget] === 'full') ||
    Object.keys(sizes).length !== DASHBOARD_WIDGETS.length
  ) {
    return false
  }

  if (
    'schemaVersion' in layout &&
    layout.schemaVersion !== undefined &&
    (typeof layout.schemaVersion !== 'number' ||
      !Number.isSafeInteger(layout.schemaVersion) ||
      layout.schemaVersion < 1)
  ) {
    return false
  }

  return true
}

export const isDefaultDashboardLayout = (layout: DashboardLayout): boolean =>
  DASHBOARD_WIDGETS.every(
    (widget, index) =>
      layout.order[index] === DEFAULT_DASHBOARD_LAYOUT.order[index] &&
      layout.sizes[widget] === DEFAULT_DASHBOARD_LAYOUT.sizes[widget] &&
      !layout.hidden.includes(widget),
  )

export const migrateDashboardLayout = (layout: DashboardLayout): DashboardLayout => {
  if ((layout.schemaVersion ?? 0) >= 1) return layout

  const isPreviousDefault =
    layout.order.every((widget, index) => widget === DASHBOARD_WIDGETS[index]) &&
    layout.hidden.length === 0 &&
    DASHBOARD_WIDGETS.every((widget) => layout.sizes[widget] === 'full')

  return isPreviousDefault ? DEFAULT_DASHBOARD_LAYOUT : { ...layout, schemaVersion: 1 }
}

export const moveDashboardWidget = (
  order: DashboardWidget[],
  widget: DashboardWidget,
  targetIndex: number,
): DashboardWidget[] => {
  const fromIndex = order.indexOf(widget)
  if (fromIndex < 0 || targetIndex < 0 || targetIndex >= order.length || fromIndex === targetIndex) {
    return order
  }

  const nextOrder = [...order]
  nextOrder.splice(fromIndex, 1)
  nextOrder.splice(targetIndex, 0, widget)
  return nextOrder
}
