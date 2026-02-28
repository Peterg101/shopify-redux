import {
  Order,
  Claim,
  BasketInformation,
  BasketItem,
  UserInformation,
  UserAndTasksAndBasketAndIncompleteAndOrders,
  UUIDType,
  ClaimEvidence,
  ClaimStatusHistory,
} from '../app/utility/interfaces'

let counter = 0
const nextId = () => `test-id-${++counter}`

export function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    order_id: nextId(),
    user_id: 'user-1',
    task_id: 'task-1',
    name: 'Test Model',
    material: 'PLA Basic',
    technique: 'FDM',
    sizing: 1,
    colour: 'white',
    selectedFile: 'model.stl',
    selectedFileType: 'stl',
    price: 25.0,
    quantity: 2,
    quantity_claimed: 0,
    created_at: '2025-01-01T00:00:00Z',
    is_collaborative: true,
    status: 'open',
    qa_level: 'standard',
    claims: [],
    ...overrides,
  }
}

export function createMockClaim(overrides: Partial<Claim> = {}): Claim {
  const order = createMockOrder()
  return {
    id: nextId(),
    order_id: order.order_id,
    claimant_user_id: 'claimant-1',
    order,
    quantity: 1,
    status: 'pending',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockBasketItem(overrides: Partial<BasketItem> = {}): BasketItem {
  return {
    id: nextId() as UUIDType,
    name: 'Test Item',
    material: 'PLA Basic',
    technique: 'FDM',
    sizing: 1,
    colour: 'white',
    selectedFile: 'model.stl',
    selectedFileType: 'stl',
    ...overrides,
  }
}

export function createMockBasketInformation(overrides: Partial<BasketInformation> = {}): BasketInformation {
  return {
    task_id: nextId(),
    user_id: 'user-1',
    name: 'Test Item',
    material: 'PLA Basic',
    technique: 'FDM',
    sizing: 1,
    colour: 'white',
    selected_file: 'model.stl',
    quantity: 1,
    selectedFileType: 'stl',
    price: 25.0,
    ...overrides,
  }
}

export function createMockUserInformation(overrides: Partial<UserInformation> = {}): UserInformation {
  return {
    user_id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    ...overrides,
  }
}

export function createMockClaimEvidence(overrides: Partial<ClaimEvidence> = {}): ClaimEvidence {
  return {
    id: nextId(),
    claim_id: 'claim-1',
    file_path: '/uploads/evidence_test.jpg',
    uploaded_at: '2025-01-01T00:00:00Z',
    status_at_upload: 'printing',
    description: 'Test evidence',
    ...overrides,
  }
}

export function createMockClaimStatusHistory(overrides: Partial<ClaimStatusHistory> = {}): ClaimStatusHistory {
  return {
    id: nextId(),
    claim_id: 'claim-1',
    previous_status: 'pending',
    new_status: 'in_progress',
    changed_by: 'user-1',
    changed_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockSessionData(
  overrides: Partial<UserAndTasksAndBasketAndIncompleteAndOrders> = {}
): UserAndTasksAndBasketAndIncompleteAndOrders {
  return {
    user: createMockUserInformation(),
    tasks: [],
    basket_items: [],
    incomplete_task: null as any,
    orders: [],
    claimable_orders: [],
    claims: [],
    ...overrides,
  }
}
