import { http, HttpResponse } from 'msw'
import { createMockSessionData, createMockDispute, createMockOrderDetail, createMockClaimDetail } from './mockData'

const AUTH_BASE = process.env.REACT_APP_AUTH_SERVICE || 'http://localhost:8000'
const DB_BASE = process.env.REACT_APP_DB_SERVICE || 'http://localhost:8001'
const MESHY_BASE = process.env.REACT_APP_MESHY_SERVICE || 'http://localhost:8002'
const STRIPE_BASE = process.env.REACT_APP_STRIPE_SERVICE || 'http://localhost:100'

export const handlers = [
  // Auth
  http.get(`${AUTH_BASE}/get_session`, () => {
    return HttpResponse.json(createMockSessionData())
  }),

  http.get(`${AUTH_BASE}/logout`, () => {
    return HttpResponse.json({ message: 'Logged out' })
  }),

  http.post(`${AUTH_BASE}/auth/register`, () => {
    return HttpResponse.json({ message: 'Registration successful', user_id: 'new-user-1' })
  }),

  http.post(`${AUTH_BASE}/auth/login`, () => {
    return HttpResponse.json({ message: 'Login successful', user_id: 'user-1' })
  }),

  // File storage
  http.get(`${DB_BASE}/file_storage/:fileId`, () => {
    return HttpResponse.json({
      file_id: 'test-file-id',
      file_data: btoa('test-file-content'),
    })
  }),

  http.post(`${DB_BASE}/file_storage`, () => {
    return HttpResponse.json({ success: true })
  }),

  http.delete(`${DB_BASE}/file_storage/:fileId`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Basket
  http.post(`${DB_BASE}/basket_item_quantity`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Orders
  http.get(`${DB_BASE}/orders/:orderId/detail`, () => {
    return HttpResponse.json(createMockOrderDetail({
      order_id: 'order-1',
      claims: [createMockClaimDetail({ id: 'claim-1', order_id: 'order-1' })],
    }))
  }),

  http.patch(`${DB_BASE}/orders/:orderId/visibility`, () => {
    return HttpResponse.json({ order_id: 'order-1', is_collaborative: true })
  }),

  // Claims
  http.post(`${DB_BASE}/claims/claim_order`, () => {
    return HttpResponse.json({ success: true })
  }),

  http.patch(`${DB_BASE}/claims/:claimId/quantity`, () => {
    return HttpResponse.json({ message: 'Claim quantity updated', claim_id: 'claim-1', new_quantity: 2 })
  }),

  http.patch(`${DB_BASE}/claims/:claimId/status`, () => {
    return HttpResponse.json({ message: 'Claim status updated' })
  }),

  http.post(`${DB_BASE}/claims/:claimId/evidence`, () => {
    return HttpResponse.json({ id: 'evidence-1', claim_id: 'claim-1' })
  }),

  http.get(`${DB_BASE}/claims/:claimId/evidence`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${DB_BASE}/claims/:claimId/history`, () => {
    return HttpResponse.json([])
  }),

  // Disputes
  http.get(`${DB_BASE}/disputes/:claimId`, () => {
    return HttpResponse.json(createMockDispute())
  }),

  http.post(`${DB_BASE}/disputes/:disputeId/respond`, () => {
    return HttpResponse.json({ message: 'Response recorded', dispute_id: 'dispute-1', status: 'responded' })
  }),

  http.post(`${DB_BASE}/disputes/:disputeId/resolve`, () => {
    return HttpResponse.json({ message: 'Dispute resolved', dispute_id: 'dispute-1', resolution: 'accepted' })
  }),

  http.post(`${DB_BASE}/disputes/:disputeId/evidence`, () => {
    return HttpResponse.json({ id: 'evidence-2', claim_id: 'claim-1' })
  }),

  // Shipping
  http.post(`${STRIPE_BASE}/shipping/create_label/:claimId`, () => {
    return HttpResponse.json({
      label_url: 'https://api.shipengine.com/v1/labels/mock-label.pdf',
      tracking_number: 'MOCK123456',
      carrier_code: 'evri',
    })
  }),

  http.put(`${DB_BASE}/users/:userId/fulfiller_address`, () => {
    return HttpResponse.json({ message: 'Address updated' })
  }),

  http.get(`${DB_BASE}/users/:userId/fulfiller_address`, () => {
    return HttpResponse.json({
      name: 'Test Fulfiller',
      line1: '123 Print St',
      city: 'London',
      postal_code: 'E1 6AN',
      country: 'GB',
    })
  }),

  // Stripe checkout
  http.post(`${STRIPE_BASE}/stripe/checkout`, () => {
    return HttpResponse.json({ checkout_url: 'https://checkout.stripe.com/pay/cs_test_mock' })
  }),

  // Meshy
  http.post(`${MESHY_BASE}/start_task/`, () => {
    return HttpResponse.json({ task_id: 'meshy-task-1' })
  }),

  http.post(`${MESHY_BASE}/start_image_to_3d_task/`, () => {
    return HttpResponse.json({ task_id: 'meshy-img-task-1' })
  }),
]
