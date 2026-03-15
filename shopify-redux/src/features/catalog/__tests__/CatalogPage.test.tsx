import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';
import { CatalogPage } from '../CatalogPage';
import { Routes, Route } from 'react-router-dom';
import { Part } from '../../../app/utility/interfaces';

// Mock the catalogApi hook
const mockParts: Part[] = [
  {
    id: 'p1',
    publisher_user_id: 'u1',
    name: 'Bracket',
    description: 'A mounting bracket',
    category: 'hardware',
    tags: [],
    task_id: 't1',
    file_type: 'step',
    status: 'published',
    is_public: true,
    download_count: 5,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  },
  {
    id: 'p2',
    publisher_user_id: 'u1',
    name: 'Gear',
    file_type: 'stl',
    status: 'published',
    is_public: true,
    download_count: 12,
    task_id: 't2',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  },
];

let mockGetPartsReturn: any = {
  data: { parts: mockParts, total: 2, page: 1, page_size: 12 },
  isLoading: false,
};

jest.mock('../../../services/catalogApi', () => ({
  ...jest.requireActual('../../../services/catalogApi'),
  useGetPartsQuery: () => mockGetPartsReturn,
}));

const CatalogPageWithRoutes = () => (
  <Routes>
    <Route path="/catalog" element={<CatalogPage />} />
  </Routes>
);

describe('CatalogPage', () => {
  beforeEach(() => {
    mockGetPartsReturn = {
      data: { parts: mockParts, total: 2, page: 1, page_size: 12 },
      isLoading: false,
    };
  });

  it('renders "Parts Catalog" heading', () => {
    renderWithProviders(<CatalogPageWithRoutes />, { route: '/catalog' });
    expect(screen.getByText('Parts Catalog')).toBeInTheDocument();
  });

  it('renders search input with placeholder "Search parts..."', () => {
    renderWithProviders(<CatalogPageWithRoutes />, { route: '/catalog' });
    expect(screen.getByPlaceholderText('Search parts...')).toBeInTheDocument();
  });

  it('renders File Type filter dropdown', () => {
    renderWithProviders(<CatalogPageWithRoutes />, { route: '/catalog' });
    expect(screen.getByLabelText('File Type')).toBeInTheDocument();
  });

  it('renders Category filter field', () => {
    renderWithProviders(<CatalogPageWithRoutes />, { route: '/catalog' });
    expect(screen.getByPlaceholderText('e.g. hardware')).toBeInTheDocument();
  });

  it('shows part cards when data is loaded', () => {
    renderWithProviders(<CatalogPageWithRoutes />, { route: '/catalog' });
    expect(screen.getByText('Bracket')).toBeInTheDocument();
    expect(screen.getByText('Gear')).toBeInTheDocument();
  });

  it('shows "No parts found" when API returns empty parts array', () => {
    mockGetPartsReturn = {
      data: { parts: [], total: 0, page: 1, page_size: 12 },
      isLoading: false,
    };
    renderWithProviders(<CatalogPageWithRoutes />, { route: '/catalog' });
    expect(screen.getByText('No parts found')).toBeInTheDocument();
  });
});
