/**
 * Skeleton Component Snapshots
 * 优化项 494: Snapshot Testing - UI快照
 *
 * 骨架屏组件的快照测试
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  SkeletonBlock,
  SkeletonCircle,
  SkeletonText,
  SkeletonCard,
  SkeletonList,
  SkeletonTable,
  SkeletonForm,
  SkeletonStats,
  SkeletonChart,
  SkeletonPage,
} from '@/components/ui/Skeleton'

// ============================================================
// 基础骨架屏组件
// ============================================================

describe('SkeletonBlock', () => {
  it('renders with default props', () => {
    render(<SkeletonBlock />)
    const block = screen.getByRole('presentation')
    expect(block).toBeInTheDocument()
    expect(block).toMatchSnapshot()
  })

  it('renders with custom width and height', () => {
    render(<SkeletonBlock width={200} height={50} />)
    const block = screen.getByRole('presentation')
    expect(block).toMatchSnapshot()
  })

  it('renders with custom borderRadius', () => {
    render(<SkeletonBlock borderRadius="1rem" />)
    const block = screen.getByRole('presentation')
    expect(block).toMatchSnapshot()
  })

  it('renders with custom className', () => {
    render(<SkeletonBlock className="my-custom-class" />)
    const block = screen.getByRole('presentation')
    expect(block).toMatchSnapshot()
  })
})

describe('SkeletonCircle', () => {
  it('renders with default props', () => {
    render(<SkeletonCircle />)
    const circle = screen.getByRole('presentation')
    expect(circle).toBeInTheDocument()
    expect(circle).toMatchSnapshot()
  })

  it('renders with custom size', () => {
    render(<SkeletonCircle size={80} />)
    const circle = screen.getByRole('presentation')
    expect(circle).toMatchSnapshot()
  })

  it('renders with custom className', () => {
    render(<SkeletonCircle className="my-custom-class" />)
    const circle = screen.getByRole('presentation')
    expect(circle).toMatchSnapshot()
  })
})

describe('SkeletonText', () => {
  it('renders with default props (3 lines)', () => {
    render(<SkeletonText />)
    const container = screen.getByRole('presentation').parentElement
    expect(container).toMatchSnapshot()
  })

  it('renders with custom line count', () => {
    render(<SkeletonText lines={5} />)
    const container = screen.getByRole('presentation').parentElement
    expect(container).toMatchSnapshot()
  })

  it('renders with custom last line width', () => {
    render(<SkeletonText lastLineWidth="40%" />)
    const container = screen.getByRole('presentation').parentElement
    expect(container).toMatchSnapshot()
  })
})

// ============================================================
// 复合骨架屏组件
// ============================================================

describe('SkeletonCard', () => {
  it('renders with all sections visible (default)', () => {
    render(<SkeletonCard />)
    const card = screen.getByRole('presentation').parentElement
    expect(card).toMatchSnapshot()
  })

  it('renders without image', () => {
    render(<SkeletonCard showImage={false} />)
    const card = screen.getByRole('presentation').parentElement
    expect(card).toMatchSnapshot()
  })

  it('renders without badge', () => {
    render(<SkeletonCard showBadge={false} />)
    const card = screen.getByRole('presentation').parentElement
    expect(card).toMatchSnapshot()
  })

  it('renders without actions', () => {
    render(<SkeletonCard showActions={false} />)
    const card = screen.getByRole('presentation').parentElement
    expect(card).toMatchSnapshot()
  })

  it('renders with custom image height', () => {
    render(<SkeletonCard imageHeight={200} />)
    const card = screen.getByRole('presentation').parentElement
    expect(card).toMatchSnapshot()
  })
})

describe('SkeletonList', () => {
  it('renders with default props', () => {
    render(<SkeletonList />)
    const list = screen.getByRole('presentation').parentElement
    expect(list).toMatchSnapshot()
  })

  it('renders with custom row count', () => {
    render(<SkeletonList rows={3} />)
    const list = screen.getByRole('presentation').parentElement
    expect(list).toMatchSnapshot()
  })

  it('renders with thumbnail instead of avatar', () => {
    render(<SkeletonList showAvatar={false} showThumbnail={true} />)
    const list = screen.getByRole('presentation').parentElement
    expect(list).toMatchSnapshot()
  })

  it('renders without action column', () => {
    render(<SkeletonList showAction={false} />)
    const list = screen.getByRole('presentation').parentElement
    expect(list).toMatchSnapshot()
  })

  it('renders with custom avatar size', () => {
    render(<SkeletonList avatarSize={60} />)
    const list = screen.getByRole('presentation').parentElement
    expect(list).toMatchSnapshot()
  })
})

describe('SkeletonTable', () => {
  it('renders with default props (4 columns, 5 rows)', () => {
    render(<SkeletonTable />)
    const table = screen.getByRole('presentation').parentElement
    expect(table).toMatchSnapshot()
  })

  it('renders with custom column count', () => {
    render(<SkeletonTable columns={6} />)
    const table = screen.getByRole('presentation').parentElement
    expect(table).toMatchSnapshot()
  })

  it('renders with custom row count', () => {
    render(<SkeletonTable rows={10} />)
    const table = screen.getByRole('presentation').parentElement
    expect(table).toMatchSnapshot()
  })

  it('renders with checkbox column', () => {
    render(<SkeletonTable showCheckbox={true} />)
    const table = screen.getByRole('presentation').parentElement
    expect(table).toMatchSnapshot()
  })

  it('renders with custom column widths', () => {
    render(<SkeletonTable columnWidths={[50, 100, 150, 200]} />)
    const table = screen.getByRole('presentation').parentElement
    expect(table).toMatchSnapshot()
  })
})

describe('SkeletonForm', () => {
  it('renders with all sections visible (default)', () => {
    render(<SkeletonForm />)
    const form = screen.getByRole('presentation').parentElement
    expect(form).toMatchSnapshot()
  })

  it('renders with custom field groups', () => {
    render(<SkeletonForm groups={4} />)
    const form = screen.getByRole('presentation').parentElement
    expect(form).toMatchSnapshot()
  })

  it('renders with custom fields per group', () => {
    render(<SkeletonForm fieldsPerGroup={3} />)
    const form = screen.getByRole('presentation').parentElement
    expect(form).toMatchSnapshot()
  })

  it('renders without submit button', () => {
    render(<SkeletonForm showSubmit={false} />)
    const form = screen.getByRole('presentation').parentElement
    expect(form).toMatchSnapshot()
  })
})

describe('SkeletonStats', () => {
  it('renders with default props (4 cards)', () => {
    render(<SkeletonStats />)
    const stats = screen.getByRole('presentation').parentElement
    expect(stats).toMatchSnapshot()
  })

  it('renders with custom card count', () => {
    render(<SkeletonStats cards={6} />)
    const stats = screen.getByRole('presentation').parentElement
    expect(stats).toMatchSnapshot()
  })

  it('renders without trend indicators', () => {
    render(<SkeletonStats showTrend={false} />)
    const stats = screen.getByRole('presentation').parentElement
    expect(stats).toMatchSnapshot()
  })
})

describe('SkeletonChart', () => {
  it('renders bar chart (default)', () => {
    render(<SkeletonChart type="bar" />)
    const chart = screen.getByRole('presentation').parentElement
    expect(chart).toMatchSnapshot()
  })

  it('renders line chart', () => {
    render(<SkeletonChart type="line" />)
    const chart = screen.getByRole('presentation').parentElement
    expect(chart).toMatchSnapshot()
  })

  it('renders area chart', () => {
    render(<SkeletonChart type="area" />)
    const chart = screen.getByRole('presentation').parentElement
    expect(chart).toMatchSnapshot()
  })

  it('renders pie chart (uses bars as placeholder)', () => {
    render(<SkeletonChart type="pie" />)
    const chart = screen.getByRole('presentation').parentElement
    expect(chart).toMatchSnapshot()
  })

  it('renders with custom data points', () => {
    render(<SkeletonChart dataPoints={24} />)
    const chart = screen.getByRole('presentation').parentElement
    expect(chart).toMatchSnapshot()
  })

  it('renders with custom height', () => {
    render(<SkeletonChart height={300} />)
    const chart = screen.getByRole('presentation').parentElement
    expect(chart).toMatchSnapshot()
  })
})

// ============================================================
// 页面级骨架屏
// ============================================================

describe('SkeletonPage', () => {
  it('renders dashboard type (default)', () => {
    render(<SkeletonPage type="dashboard" />)
    const page = screen.getByRole('presentation').parentElement
    expect(page).toMatchSnapshot()
  })

  it('renders list type', () => {
    render(<SkeletonPage type="list" />)
    const page = screen.getByRole('presentation').parentElement
    expect(page).toMatchSnapshot()
  })

  it('renders detail type', () => {
    render(<SkeletonPage type="detail" />)
    const page = screen.getByRole('presentation').parentElement
    expect(page).toMatchSnapshot()
  })

  it('renders form type', () => {
    render(<SkeletonPage type="form" />)
    const page = screen.getByRole('presentation').parentElement
    expect(page).toMatchSnapshot()
  })

  it('renders profile type', () => {
    render(<SkeletonPage type="profile" />)
    const page = screen.getByRole('presentation').parentElement
    expect(page).toMatchSnapshot()
  })
})
