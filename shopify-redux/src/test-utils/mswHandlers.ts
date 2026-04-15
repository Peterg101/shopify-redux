import { http, HttpResponse } from 'msw'
import { createMockSlimSession, createMockDispute, createMockOrderDetail, createMockClaimDetail } from './mockData'

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000'
const GENERATION_BASE = process.env.REACT_APP_GENERATION_URL || 'http://localhost:1234'

export const handlers = [
  http.get(`${API_BASE}/session`, () => {
    return HttpResponse.json(createMockSlimSession())
  }),

  http.get(`${API_BASE}/user_basket`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_BASE}/user_orders`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_BASE}/user_claims`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_BASE}/user_claimable`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_BASE}/user_tasks`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_BASE}/logout`, () => {
    return HttpResponse.json({ message: 'Logged out' })
  }),

  http.post(`${API_BASE}/auth/register`, () => {
    return HttpResponse.json({ message: 'Registration successful', user_id: 'new-user-1' })
  }),

  http.post(`${API_BASE}/auth/login`, () => {
    return HttpResponse.json({ message: 'Login successful', user_id: 'user-1' })
  }),

  // File storage
  http.get(`${API_BASE}/file_storage/:fileId`, () => {
    return HttpResponse.json({
      file_id: 'test-file-id',
      file_data: btoa('test-file-content'),
    })
  }),

  http.post(`${API_BASE}/file_storage`, () => {
    return HttpResponse.json({ success: true })
  }),

  http.delete(`${API_BASE}/file_storage/:fileId`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Basket
  http.post(`${API_BASE}/basket_item_quantity`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Orders
  http.get(`${API_BASE}/orders/:orderId/detail`, () => {
    return HttpResponse.json(createMockOrderDetail({
      order_id: 'order-1',
      claims: [createMockClaimDetail({ id: 'claim-1', order_id: 'order-1' })],
    }))
  }),

  http.patch(`${API_BASE}/orders/:orderId/visibility`, () => {
    return HttpResponse.json({ order_id: 'order-1', is_collaborative: true })
  }),

  // Claims
  http.post(`${API_BASE}/claims/claim_order`, () => {
    return HttpResponse.json({ success: true })
  }),

  http.patch(`${API_BASE}/claims/:claimId/quantity`, () => {
    return HttpResponse.json({ message: 'Claim quantity updated', claim_id: 'claim-1', new_quantity: 2 })
  }),

  http.patch(`${API_BASE}/claims/:claimId/status`, () => {
    return HttpResponse.json({ message: 'Claim status updated' })
  }),

  http.post(`${API_BASE}/claims/:claimId/evidence`, () => {
    return HttpResponse.json({ id: 'evidence-1', claim_id: 'claim-1' })
  }),

  http.get(`${API_BASE}/claims/:claimId/evidence`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_BASE}/claims/:claimId/history`, () => {
    return HttpResponse.json([])
  }),

  // Disputes
  http.get(`${API_BASE}/disputes/:claimId`, () => {
    return HttpResponse.json(createMockDispute())
  }),

  http.post(`${API_BASE}/disputes/:disputeId/respond`, () => {
    return HttpResponse.json({ message: 'Response recorded', dispute_id: 'dispute-1', status: 'responded' })
  }),

  http.post(`${API_BASE}/disputes/:disputeId/resolve`, () => {
    return HttpResponse.json({ message: 'Dispute resolved', dispute_id: 'dispute-1', resolution: 'accepted' })
  }),

  http.post(`${API_BASE}/disputes/:disputeId/evidence`, () => {
    return HttpResponse.json({ id: 'evidence-2', claim_id: 'claim-1' })
  }),

  // Shipping
  http.post(`${API_BASE}/shipping/create_label/:claimId`, () => {
    return HttpResponse.json({
      label_url: 'https://api.shipengine.com/v1/labels/mock-label.pdf',
      tracking_number: 'MOCK123456',
      carrier_code: 'evri',
    })
  }),

  http.put(`${API_BASE}/users/:userId/fulfiller_address`, () => {
    return HttpResponse.json({ message: 'Address updated' })
  }),

  http.get(`${API_BASE}/users/:userId/fulfiller_address`, () => {
    return HttpResponse.json({
      name: 'Test Fulfiller',
      line1: '123 Print St',
      city: 'London',
      postal_code: 'E1 6AN',
      country: 'GB',
    })
  }),

  // Stripe checkout
  http.post(`${API_BASE}/stripe/checkout`, () => {
    return HttpResponse.json({ checkout_url: 'https://checkout.stripe.com/pay/cs_test_mock' })
  }),

  // Auth - forgot/reset/verify
  http.post(`${API_BASE}/auth/forgot-password`, () => {
    return HttpResponse.json({ message: 'Reset link sent' })
  }),

  http.post(`${API_BASE}/auth/reset-password`, () => {
    return HttpResponse.json({ message: 'Password reset successful' })
  }),

  http.get(`${API_BASE}/auth/verify-email`, () => {
    return HttpResponse.json({ message: 'Email verified' })
  }),

  http.post(`${API_BASE}/auth/resend-verification`, () => {
    return HttpResponse.json({ message: 'Verification email sent' })
  }),

  // Messaging
  http.get(`${API_BASE}/claims/:claimId/messages`, () => {
    return HttpResponse.json([
      {
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_user_id: 'other-user-id',
        body: 'Hello, I have a question about the specs.',
        created_at: '2026-03-30T10:00:00Z',
      },
      {
        id: 'msg-2',
        conversation_id: 'conv-1',
        sender_user_id: 'user-1',
        body: 'Sure, what would you like to know?',
        created_at: '2026-03-30T10:01:00Z',
      },
    ])
  }),

  http.post(`${API_BASE}/claims/:claimId/messages`, async ({ request }) => {
    const body = await request.json() as { body: string }
    return HttpResponse.json({
      id: 'msg-new',
      conversation_id: 'conv-1',
      sender_user_id: 'user-1',
      body: (body as any).body,
      created_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.patch(`${API_BASE}/claims/:claimId/messages/read`, () => {
    return HttpResponse.json({ message: 'Messages marked as read' })
  }),

  http.get(`${API_BASE}/conversations`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_BASE}/messages/unread_count`, () => {
    return HttpResponse.json({ total_unread: 0 })
  }),
]
