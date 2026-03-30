import React from 'react';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';
import { PartDetailPage } from '../PartDetailPage';
import { Part } from '../../../app/utility/interfaces';

// Mock heavy child components
jest.mock('../PartDetailViewer', () => ({
  __esModule: true,
  default: ({ taskId }: { taskId: string }) => (
    <div data-testid="mock-viewer">Viewer: {taskId}</div>
  ),
}));

jest.mock('../PartConfigSidebar', () => ({
  PartConfigSidebar: ({ part }: { part: Part }) => (
    <div data-testid="mock-sidebar">Sidebar: {part.name}</div>
  ),
}));

jest.mock('../../userInterface/headerBar', () => ({
  HeaderBar: () => <div data-testid="mock-header">Header</div>,
}));

jest.mock('../../userInterface/updatedUserInterface', () => ({
  UpdatedUserInterface: () => <div data-testid="mock-ui">UI</div>,
}));

// RTK Query mock — we control the return value per-test
let mockQueryResult: { data?: Part; isLoading: boolean; error?: any } = {
  isLoading: true,
};

jest.mock('../../../services/catalogApi', () => ({
  ...jest.requireActual('../../../services/catalogApi'),
  useGetPartDetailQuery: () => mockQueryResult,
}));

function mockPart(overrides: Partial<Part> = {}): Part {
  return {
    id: 'part-1',
    publisher_user_id: 'u1',
    name: 'Test Bracket',
    description: 'A sturdy bracket for mounting',
    category: 'hardware',
    tags: ['bracket', 'mount'],
    task_id: 'task-1',
    file_type: 'step',
    status: 'published',
    is_public: true,
    download_count: 42,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    recommended_process: 'FDM',
    recommended_material: 'PLA',
    ...overrides,
  };
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/catalog/:partId" element={<PartDetailPage />} />
    </Routes>,
    { route: '/catalog/part-1' }
  );
}

describe('PartDetailPage', () => {
  afterEach(() => {
    mockQueryResult = { isLoading: true };
  });

  it('renders loading skeletons while data is loading', () => {
    mockQueryResult = { isLoading: true };
    const { container } = renderPage();

    // MUI Skeleton renders spans with specific classes
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders "Part not found" on error', () => {
    mockQueryResult = { isLoading: false, error: { status: 404 } };
    renderPage();

    expect(screen.getByText('Part not found')).toBeInTheDocument();
    expect(screen.getByText('Back to Catalog')).toBeInTheDocument();
  });

  it('renders "Part not found" when data is undefined', () => {
    mockQueryResult = { isLoading: false, data: undefined };
    renderPage();

    expect(screen.getByText('Part not found')).toBeInTheDocument();
  });

  it('renders the part name when data is loaded', () => {
    mockQueryResult = { isLoading: false, data: mockPart() };
    renderPage();

    expect(screen.getByText('Test Bracket')).toBeInTheDocument();
  });

  it('renders the part description', () => {
    mockQueryResult = { isLoading: false, data: mockPart() };
    renderPage();

    expect(screen.getByText('A sturdy bracket for mounting')).toBeInTheDocument();
  });

  it('renders file type chip uppercased', () => {
    mockQueryResult = { isLoading: false, data: mockPart({ file_type: 'step' }) };
    renderPage();

    expect(screen.getByText('STEP')).toBeInTheDocument();
  });

  it('renders category chip', () => {
    mockQueryResult = { isLoading: false, data: mockPart({ category: 'hardware' }) };
    renderPage();

    expect(screen.getByText('hardware')).toBeInTheDocument();
  });

  it('renders recommended_process chip', () => {
    mockQueryResult = { isLoading: false, data: mockPart({ recommended_process: 'FDM' }) };
    renderPage();

    expect(screen.getByText('FDM')).toBeInTheDocument();
  });

  it('renders recommended_material chip', () => {
    mockQueryResult = { isLoading: false, data: mockPart({ recommended_material: 'PLA' }) };
    renderPage();

    expect(screen.getByText('PLA')).toBeInTheDocument();
  });

  it('renders tags', () => {
    mockQueryResult = { isLoading: false, data: mockPart({ tags: ['bracket', 'mount'] }) };
    renderPage();

    expect(screen.getByText('bracket')).toBeInTheDocument();
    expect(screen.getByText('mount')).toBeInTheDocument();
  });

  it('renders download count', () => {
    mockQueryResult = { isLoading: false, data: mockPart({ download_count: 42 }) };
    renderPage();

    expect(screen.getByText('42 orders')).toBeInTheDocument();
  });

  it('renders the 3D viewer with correct task_id', () => {
    mockQueryResult = { isLoading: false, data: mockPart({ task_id: 'task-abc' }) };
    renderPage();

    expect(screen.getByTestId('mock-viewer')).toBeInTheDocument();
    expect(screen.getByText('Viewer: task-abc')).toBeInTheDocument();
  });

  it('renders the config sidebar with the part', () => {
    mockQueryResult = { isLoading: false, data: mockPart({ name: 'My Part' }) };
    renderPage();

    expect(screen.getByTestId('mock-sidebar')).toBeInTheDocument();
    expect(screen.getByText('Sidebar: My Part')).toBeInTheDocument();
  });

  it('renders the header bar', () => {
    mockQueryResult = { isLoading: false, data: mockPart() };
    renderPage();

    expect(screen.getByTestId('mock-header')).toBeInTheDocument();
  });
});
