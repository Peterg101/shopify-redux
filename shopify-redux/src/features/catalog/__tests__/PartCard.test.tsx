import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';
import { PartCard } from '../PartCard';
import { Part } from '../../../app/utility/interfaces';

function mockPart(overrides: Partial<Part> = {}): Part {
  return {
    id: 'part-1',
    publisher_user_id: 'u1',
    name: 'Test Bracket',
    task_id: 't1',
    file_type: 'stl',
    status: 'published',
    is_public: true,
    download_count: 42,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    ...overrides,
  };
}

describe('PartCard', () => {
  it('renders part name', () => {
    const part = mockPart({ name: 'Mounting Bracket' });
    renderWithProviders(<PartCard part={part} onClick={jest.fn()} />);
    expect(screen.getByText('Mounting Bracket')).toBeInTheDocument();
  });

  it('renders file type chip uppercased', () => {
    const part = mockPart({ file_type: 'stl' });
    renderWithProviders(<PartCard part={part} onClick={jest.fn()} />);
    expect(screen.getByText('STL')).toBeInTheDocument();
  });

  it('renders description when present', () => {
    const part = mockPart({ description: 'A sturdy mounting bracket' });
    renderWithProviders(<PartCard part={part} onClick={jest.fn()} />);
    expect(screen.getByText('A sturdy mounting bracket')).toBeInTheDocument();
  });

  it('does NOT render description when absent', () => {
    const part = mockPart({ description: undefined });
    renderWithProviders(<PartCard part={part} onClick={jest.fn()} />);
    expect(screen.queryByText('A sturdy mounting bracket')).not.toBeInTheDocument();
  });

  it('renders "3D" placeholder when no thumbnail_url', () => {
    const part = mockPart({ thumbnail_url: undefined });
    renderWithProviders(<PartCard part={part} onClick={jest.fn()} />);
    expect(screen.getByText('3D')).toBeInTheDocument();
  });

  it('renders thumbnail image when thumbnail_url provided', () => {
    const part = mockPart({
      thumbnail_url: 'https://example.com/thumb.png',
      name: 'Thumb Part',
    });
    renderWithProviders(<PartCard part={part} onClick={jest.fn()} />);
    const img = screen.getByRole('img', { name: 'Thumb Part' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.png');
    // Should NOT show the placeholder
    expect(screen.queryByText('3D')).not.toBeInTheDocument();
  });

  it('renders download count', () => {
    const part = mockPart({ download_count: 42 });
    renderWithProviders(<PartCard part={part} onClick={jest.fn()} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders category chip when provided', () => {
    const part = mockPart({ category: 'hardware' });
    renderWithProviders(<PartCard part={part} onClick={jest.fn()} />);
    expect(screen.getByText('hardware')).toBeInTheDocument();
  });

  it('renders recommended_process chip when provided', () => {
    const part = mockPart({ recommended_process: 'FDM' });
    renderWithProviders(<PartCard part={part} onClick={jest.fn()} />);
    expect(screen.getByText('FDM')).toBeInTheDocument();
  });

  it('calls onClick with part.id when card is clicked', () => {
    const handleClick = jest.fn();
    const part = mockPart({ id: 'part-xyz' });
    renderWithProviders(<PartCard part={part} onClick={handleClick} />);
    fireEvent.click(screen.getByText(part.name));
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith('part-xyz');
  });
});
