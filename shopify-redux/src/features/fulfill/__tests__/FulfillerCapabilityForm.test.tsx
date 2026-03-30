import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';
import { FulfillerCapabilityForm } from '../FulfillerCapabilityForm';
import { FulfillerProfile, ManufacturingProcess, ManufacturingMaterial } from '../../../app/utility/interfaces';

// Mock data
const mockProcesses: ManufacturingProcess[] = [
  { id: 'proc-1', family: '3d_printing', name: 'FDM', display_name: 'FDM' },
  { id: 'proc-2', family: '3d_printing', name: 'SLA', display_name: 'SLA' },
  { id: 'proc-3', family: 'cnc', name: 'CNC Milling', display_name: 'CNC Milling' },
];

const mockMaterials: ManufacturingMaterial[] = [
  { id: 'mat-1', category: 'Plastic', name: 'PLA Basic', process_family: '3d_printing' },
  { id: 'mat-2', category: 'Plastic', name: 'ABS', process_family: '3d_printing' },
  { id: 'mat-3', category: 'Metal', name: 'Aluminum 6061', process_family: 'cnc' },
];

const mockCreateProfile = jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) });
const mockUpdateProfile = jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) });

jest.mock('../../../services/dbApi', () => ({
  ...jest.requireActual('../../../services/dbApi'),
  useGetManufacturingProcessesQuery: () => ({
    data: mockProcesses,
    isLoading: false,
  }),
  useGetManufacturingMaterialsQuery: () => ({
    data: mockMaterials,
    isLoading: false,
  }),
  useCreateFulfillerProfileMutation: () => [mockCreateProfile, { isLoading: false }],
  useUpdateFulfillerProfileMutation: () => [mockUpdateProfile, { isLoading: false }],
}));

const mockOnComplete = jest.fn();

const existingProfile: FulfillerProfile = {
  id: 'fp-1',
  user_id: 'user-1',
  business_name: 'Existing Manufacturing Co',
  description: 'We print things',
  is_active: true,
  max_build_volume_x: 300,
  max_build_volume_y: 300,
  max_build_volume_z: 400,
  min_tolerance_mm: 0.1,
  lead_time_days_min: 2,
  lead_time_days_max: 5,
  certifications: ['ISO 9001'],
  post_processing: ['Sanding'],
  capabilities: [
    {
      id: 'cap-1',
      process_id: 'proc-1',
      process: { id: 'proc-1', family: '3d_printing', name: 'FDM', display_name: 'FDM' },
      materials: ['mat-1'],
      notes: 'High quality FDM',
    },
  ],
};

describe('FulfillerCapabilityForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the stepper with all step labels', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    expect(screen.getByText('Business Info')).toBeInTheDocument();
    expect(screen.getByText('Processes')).toBeInTheDocument();
    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Equipment')).toBeInTheDocument();
    expect(screen.getByText('Finishing')).toBeInTheDocument();
  });

  it('renders Business Name and Description fields on step 0', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    expect(screen.getByLabelText(/Business Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
  });

  it('has Back button disabled on first step', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeDisabled();
  });

  it('has Next button on first step', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('Next button is disabled when business name is empty', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it('enables Next button when business name has content', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    const nameInput = screen.getByLabelText(/Business Name/i);
    fireEvent.change(nameInput, { target: { value: 'My Shop' } });

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it('navigates to Processes step and shows process checkboxes', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    // Fill business name and go to next step
    const nameInput = screen.getByLabelText(/Business Name/i);
    fireEvent.change(nameInput, { target: { value: 'My Shop' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Now on Processes step — should see process checkboxes
    expect(screen.getByText('FDM')).toBeInTheDocument();
    expect(screen.getByText('SLA')).toBeInTheDocument();
    expect(screen.getByText('CNC Milling')).toBeInTheDocument();
  });

  it('shows process family headers', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    // Navigate to Processes step
    const nameInput = screen.getByLabelText(/Business Name/i);
    fireEvent.change(nameInput, { target: { value: 'My Shop' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('3D Printing')).toBeInTheDocument();
    expect(screen.getByText('CNC Machining')).toBeInTheDocument();
  });

  it('pre-fills business name from existingProfile', () => {
    renderWithProviders(
      <FulfillerCapabilityForm
        existingProfile={existingProfile}
        onComplete={mockOnComplete}
      />
    );

    const nameInput = screen.getByLabelText(/Business Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Existing Manufacturing Co');
  });

  it('pre-fills description from existingProfile', () => {
    renderWithProviders(
      <FulfillerCapabilityForm
        existingProfile={existingProfile}
        onComplete={mockOnComplete}
      />
    );

    const descInput = screen.getByLabelText(/Description/i) as HTMLInputElement;
    expect(descInput.value).toBe('We print things');
  });

  it('shows "Create Profile" on last step for new profile', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    // Navigate through all steps to the last one
    const nameInput = screen.getByLabelText(/Business Name/i);
    fireEvent.change(nameInput, { target: { value: 'My Shop' } });

    // Step 0 -> 1
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 1 -> 2 (processes — next allowed even with 0 selected per canProceed default true for step 2+)
    // Actually step 1 requires at least 1 process. Let's check a checkbox first.
    const fdmCheckbox = screen.getByRole('checkbox', { name: /FDM/i });
    fireEvent.click(fdmCheckbox);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 2 -> 3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 3 -> 4
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Now on last step — should show "Create Profile" button
    expect(screen.getByRole('button', { name: /Create Profile/i })).toBeInTheDocument();
  });

  it('shows "Update Profile" on last step for existing profile', () => {
    renderWithProviders(
      <FulfillerCapabilityForm
        existingProfile={existingProfile}
        onComplete={mockOnComplete}
      />
    );

    // Navigate to last step
    // Step 0 -> 1
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 1 -> 2 (existing profile has a process selected)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 2 -> 3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 3 -> 4
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /Update Profile/i })).toBeInTheDocument();
  });

  it('renders certifications on the finishing step', () => {
    renderWithProviders(
      <FulfillerCapabilityForm
        existingProfile={existingProfile}
        onComplete={mockOnComplete}
      />
    );

    // Navigate to last step (step 4 — Finishing)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('ISO 9001')).toBeInTheDocument();
    expect(screen.getByText('AS9100')).toBeInTheDocument();
    expect(screen.getByText('ITAR')).toBeInTheDocument();
  });

  it('renders post-processing options on the finishing step', () => {
    renderWithProviders(
      <FulfillerCapabilityForm
        existingProfile={existingProfile}
        onComplete={mockOnComplete}
      />
    );

    // Navigate to finishing step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('Sanding')).toBeInTheDocument();
    expect(screen.getByText('Painting')).toBeInTheDocument();
    expect(screen.getByText('Anodizing')).toBeInTheDocument();
    expect(screen.getByText('Vapor Smoothing')).toBeInTheDocument();
  });

  it('can navigate back from step 1 to step 0', () => {
    renderWithProviders(
      <FulfillerCapabilityForm onComplete={mockOnComplete} />
    );

    // Go to step 1
    const nameInput = screen.getByLabelText(/Business Name/i);
    fireEvent.change(nameInput, { target: { value: 'My Shop' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Should be on processes step
    expect(screen.getByText('3D Printing')).toBeInTheDocument();

    // Go back
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    // Should see business name field again with the value preserved
    const nameInputAfterBack = screen.getByLabelText(/Business Name/i) as HTMLInputElement;
    expect(nameInputAfterBack.value).toBe('My Shop');
  });
});
