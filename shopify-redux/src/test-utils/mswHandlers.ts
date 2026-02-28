import { http, HttpResponse } from 'msw'
import { createMockSessionData } from './mockData'

const AUTH_BASE = process.env.REACT_APP_AUTH_SERVICE || 'http://localhost:8000'
const DB_BASE = process.env.REACT_APP_DB_SERVICE || 'http://localhost:8001'
const MESHY_BASE = process.env.REACT_APP_MESHY_SERVICE || 'http://localhost:8002'

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

  // Claims
  http.post(`${DB_BASE}/claims/claim_order`, () => {
    return HttpResponse.json({ success: true })
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

  // Meshy
  http.post(`${MESHY_BASE}/start_task/`, () => {
    return HttpResponse.json({ task_id: 'meshy-task-1' })
  }),

  http.post(`${MESHY_BASE}/start_image_to_3d_task/`, () => {
    return HttpResponse.json({ task_id: 'meshy-img-task-1' })
  }),
]
