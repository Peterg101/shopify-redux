import {
  Order,
  Claim,
  BasketInformation,
  BasketItem,
  UserInformation,
  UserAndTasksAndBasketAndIncompleteAndOrders,
  SlimSession,
  UUIDType,
  ClaimEvidence,
  ClaimStatusHistory,
  Dispute,
  ClaimDetail,
  OrderDetail,
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
    selectedFile: 'model.stl',
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

export function createMockDispute(overrides: Partial<Dispute> = {}): Dispute {
  return {
    id: nextId(),
    claim_id: 'claim-1',
    opened_by: 'user-1',
    reason: 'Item damaged on arrival',
    status: 'open',
    fulfiller_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

export function createMockClaimDetail(overrides: Partial<ClaimDetail> = {}): ClaimDetail {
  return {
    id: nextId(),
    order_id: 'order-1',
    claimant_user_id: 'claimant-1',
    claimant_username: 'fulfilleruser',
    quantity: 1,
    status: 'pending',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    evidence: [],
    status_history: [],
    ...overrides,
  }
}

export function createMockOrderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    order_id: nextId(),
    task_id: 'task-1',
    user_id: 'user-1',
    owner_username: 'testuser',
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

export function createMockSlimSession(
  overrides: Partial<SlimSession> = {}
): SlimSession {
  return {
    user: createMockUserInformation(),
    stripe_onboarded: false,
    has_fulfiller_profile: false,
    incomplete_task: null,
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
