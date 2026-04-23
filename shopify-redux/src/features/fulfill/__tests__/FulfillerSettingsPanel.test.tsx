import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';
import { FulfillerSettingsPanel } from '../FulfillerSettingsPanel';
import { createMockUserInformation } from '../../../test-utils/mockData';
import { FulfillerProfile } from '../../../app/utility/interfaces';

// Mock child components to isolate the panel
jest.mock('../FulfillerCapabilityForm', () => ({
  FulfillerCapabilityForm: () => <div data-testid="capability-form">Capability Form</div>,
}));

jest.mock('../FulfillerCapabilityDisplay', () => ({
  FulfillerCapabilityDisplay: ({ profile }: { profile: any }) => (
    <div data-testid="capability-display">Display: {profile.business_name}</div>
  ),
}));

jest.mock('../FulfillerAddressForm', () => ({
  FulfillerAddressForm: () => <div data-testid="address-form">Address Form</div>,
}));

jest.mock('../../../services/fetchFileUtils', () => ({
  callStripeService: jest.fn(),
}));

// Default mock: no fulfiller profile
let mockFulfillerProfile: FulfillerProfile | null = null;
jest.mock('../../../services/dbApi', () => ({
  ...jest.requireActual('../../../services/dbApi'),
  useGetFulfillerProfileQuery: () => ({
    data: mockFulfillerProfile,
    isLoading: false,
  }),
}));

const baseUser = createMockUserInformation({ user_id: 'user-1', username: 'fulfiller1' });

function renderPanel({
  stripeOnboarded = false,
  profile = null as FulfillerProfile | null,
} = {}) {
  mockFulfillerProfile = profile;

  return renderWithProviders(<FulfillerSettingsPanel />, {
    preloadedState: {
      userInterfaceState: {
        userInformation: {
          user: baseUser,
          stripe_onboarded: stripeOnboarded,
          has_fulfiller_profile: !!profile,
          email_verified: true,
          incomplete_task: null,
          subscription_tier: 'free',
          subscription_status: 'active',
          available_credits: 5,
          credit_renewal_date: null,
        },
        leftDrawerOpen: false,
        selectedComponent: '',
        claimedOrder: {} as any,
        selectedClaim: null,
        fulfillMode: false,
        updateClaimMode: false,
      },
    },
  });
}

const mockProfile: FulfillerProfile = {
  id: 'fp-1',
  user_id: 'user-1',
  business_name: 'Test Manufacturing Co',
  is_active: true,
  capabilities: [
    {
      id: 'cap-1',
      process_id: 'proc-1',
      process: { id: 'proc-1', family: '3d_printing', name: 'FDM', display_name: 'FDM' },
      materials: ['mat-1'],
    },
  ],
};

describe('FulfillerSettingsPanel', () => {
  beforeEach(() => {
    mockFulfillerProfile = null;
  });

  it('renders the "Fulfilment Setup" header', () => {
    renderPanel();
    expect(screen.getByText('Fulfilment Setup')).toBeInTheDocument();
  });

  it('shows "Set Up Payments" button when stripe_onboarded is false', () => {
    renderPanel({ stripeOnboarded: false });
    expect(screen.getByText('Set Up Payments')).toBeInTheDocument();
    expect(screen.queryByText('Payments Active')).not.toBeInTheDocument();
  });

  it('shows "Payments Active" chip when stripe_onboarded is true', () => {
    renderPanel({ stripeOnboarded: true });
    expect(screen.getByText('Payments Active')).toBeInTheDocument();
    expect(screen.queryByText('Set Up Payments')).not.toBeInTheDocument();
  });

  it('shows "Set Up Manufacturing Profile" button when no fulfiller profile', () => {
    renderPanel({ profile: null });
    expect(screen.getByText('Set Up Manufacturing Profile')).toBeInTheDocument();
  });

  it('shows capability display when fulfiller profile exists', () => {
    renderPanel({ profile: mockProfile });
    expect(screen.getByTestId('capability-display')).toBeInTheDocument();
    expect(screen.getByText(/Display: Test Manufacturing Co/)).toBeInTheDocument();
    expect(screen.queryByText('Set Up Manufacturing Profile')).not.toBeInTheDocument();
  });

  it('shows "Edit" button when profile exists', () => {
    renderPanel({ profile: mockProfile });
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('shows address form section only when profile exists', () => {
    renderPanel({ profile: mockProfile });
    expect(screen.getByTestId('address-form')).toBeInTheDocument();
  });

  it('does NOT show address form when no profile', () => {
    renderPanel({ profile: null });
    expect(screen.queryByTestId('address-form')).not.toBeInTheDocument();
  });

  it('shows "Check Status" button when stripe is not onboarded', () => {
    renderPanel({ stripeOnboarded: false });
    expect(screen.getByText('Check Status')).toBeInTheDocument();
  });

  it('shows "Payments" section header', () => {
    renderPanel();
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });

  it('shows "Manufacturing Capabilities" section header', () => {
    renderPanel();
    expect(screen.getByText('Manufacturing Capabilities')).toBeInTheDocument();
  });

  it('renders onboarding checklist steps', () => {
    renderPanel({ stripeOnboarded: false, profile: null });
    expect(screen.getByText('Payment account connected')).toBeInTheDocument();
    expect(screen.getByText('Manufacturing profile created')).toBeInTheDocument();
    expect(screen.getByText('Shipping address configured')).toBeInTheDocument();
  });
});
