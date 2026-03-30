import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';
import { PartConfigSidebar } from '../PartConfigSidebar';
import { Part } from '../../../app/utility/interfaces';

jest.mock('../../../services/fetchFileUtils', () => ({
  ...jest.requireActual('../../../services/fetchFileUtils'),
  isCadFileType: (fileType: string) => fileType.toLowerCase() === 'step',
}));

jest.mock('../../../services/dbApi', () => ({
  ...jest.requireActual('../../../services/dbApi'),
  useGetManufacturingProcessesQuery: () => ({
    data: [
      { id: 'proc-1', family: '3d_printing', name: 'FDM', display_name: 'FDM' },
      { id: 'proc-2', family: 'cnc', name: 'CNC Milling', display_name: 'CNC Milling' },
    ],
  }),
  useGetManufacturingMaterialsQuery: () => ({
    data: [
      { id: 'mat-1', category: 'Plastic', name: 'PLA Basic', process_family: '3d_printing' },
      { id: 'mat-2', category: 'Metal', name: 'Aluminum 6061', process_family: 'cnc' },
    ],
  }),
}));

jest.mock('../../../services/catalogApi', () => ({
  ...jest.requireActual('../../../services/catalogApi'),
  useOrderFromPartMutation: () => [jest.fn(), { isLoading: false }],
}));

function mockPart(overrides: Partial<Part> = {}): Part {
  return {
    id: 'part-1',
    publisher_user_id: 'u1',
    name: 'Test Part',
    task_id: 't1',
    file_type: 'stl',
    status: 'published',
    is_public: true,
    download_count: 0,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    ...overrides,
  };
}

describe('PartConfigSidebar', () => {
  it('renders "Configure Order" header', () => {
    const part = mockPart();
    renderWithProviders(
      <PartConfigSidebar part={part} onColourChange={jest.fn()} />
    );
    expect(screen.getByText('Configure Order')).toBeInTheDocument();
  });

  it('renders "Add to Basket" button', () => {
    const part = mockPart();
    renderWithProviders(
      <PartConfigSidebar part={part} onColourChange={jest.fn()} />
    );
    expect(screen.getByRole('button', { name: /add to basket/i })).toBeInTheDocument();
  });

  it('renders "Process & Material" section', () => {
    const part = mockPart();
    renderWithProviders(
      <PartConfigSidebar part={part} onColourChange={jest.fn()} />
    );
    expect(screen.getByText('Process & Material')).toBeInTheDocument();
  });

  it('renders "Quantity" section (shows "Colour & Quantity" only for 3D printing)', () => {
    const part = mockPart();
    renderWithProviders(
      <PartConfigSidebar part={part} onColourChange={jest.fn()} />
    );
    expect(screen.getByText('Quantity')).toBeInTheDocument();
  });

  it('for STL file type, shows "3D printing only" chip', () => {
    const part = mockPart({ file_type: 'stl' });
    renderWithProviders(
      <PartConfigSidebar part={part} onColourChange={jest.fn()} />
    );
    expect(screen.getByText('3D printing only')).toBeInTheDocument();
  });

  it('for STEP file type, shows "CAD model" chip and "Manufacturing Specs" section', () => {
    const part = mockPart({ file_type: 'step' });
    renderWithProviders(
      <PartConfigSidebar part={part} onColourChange={jest.fn()} />
    );
    expect(
      screen.getByText('CAD model \u2014 all manufacturing techniques')
    ).toBeInTheDocument();
    expect(screen.getByText('Manufacturing Specs')).toBeInTheDocument();
  });

  it('quantity starts at 1', () => {
    const part = mockPart();
    renderWithProviders(
      <PartConfigSidebar part={part} onColourChange={jest.fn()} />
    );
    // The quantity value "1" is in a Typography sibling of the "Qty:" label
    // Navigate from "Qty:" up to the parent Box, then check its full text
    const qtyLabel = screen.getByText('Qty:');
    const parentBox = qtyLabel.parentElement!;
    expect(parentBox).toHaveTextContent('1');
  });
});
