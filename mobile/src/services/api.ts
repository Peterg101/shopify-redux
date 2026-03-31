import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { API_URL } from './config';
import { getToken, getRefreshToken, setTokens, clearTokens } from './auth';

const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: async (headers) => {
    const token = await getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

// Wrapper that handles 401 → refresh → retry
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      const refreshResult = await baseQuery(
        { url: '/auth/mobile/refresh', method: 'POST', body: { refresh_token: refreshToken } },
        api,
        extraOptions
      );
      if (refreshResult.data) {
        const data = refreshResult.data as { token: string };
        await setTokens(data.token, refreshToken);
        result = await baseQuery(args, api, extraOptions);
      } else {
        await clearTokens();
      }
    }
  }

  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Session',
    'BasketItems',
    'UserOrders',
    'UserClaims',
    'UserTasks',
    'ClaimableOrders',
    'OrderDetail',
    'ClaimEvidence',
    'ClaimHistory',
    'Dispute',
    'FulfillerAddress',
    'FulfillerProfile',
    'ManufacturingProcesses',
    'ManufacturingMaterials',
    'Parts',
    'PartDetail',
  ],
  endpoints: (builder) => ({
    // Auth
    getSession: builder.query({ query: () => '/session', providesTags: ['Session'] }),
    getUserBasket: builder.query({ query: () => '/user_basket', providesTags: ['BasketItems'] }),
    getUserOrders: builder.query({ query: () => '/user_orders', providesTags: ['UserOrders'] }),
    getUserClaims: builder.query({ query: () => '/user_claims', providesTags: ['UserClaims'] }),
    getUserClaimable: builder.query({ query: () => '/user_claimable', providesTags: ['ClaimableOrders'] }),
    getUserTasks: builder.query({ query: () => '/user_tasks', providesTags: ['UserTasks'] }),

    // Orders
    getOrderDetail: builder.query({
      query: (orderId: string) => `/orders/${orderId}/detail`,
      providesTags: (_r, _e, id) => [{ type: 'OrderDetail', id }],
    }),
    toggleOrderVisibility: builder.mutation({
      query: ({ orderId, is_collaborative }: { orderId: string; is_collaborative: boolean }) => ({
        url: `/orders/${orderId}/visibility`,
        method: 'PATCH',
        body: { is_collaborative },
      }),
      invalidatesTags: (_r, _e, { orderId }) => [{ type: 'OrderDetail', id: orderId }, 'UserOrders'],
    }),

    // Claims
    claimOrder: builder.mutation({
      query: (body: { order_id: string; quantity: number }) => ({
        url: '/claims/claim_order',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ClaimableOrders', 'UserClaims'],
    }),
    updateClaimStatus: builder.mutation({
      query: ({ claimId, status, reason }: { claimId: string; status: string; reason?: string }) => ({
        url: `/claims/${claimId}/status`,
        method: 'PATCH',
        body: { status, reason },
      }),
      invalidatesTags: ['UserClaims'],
    }),
    updateClaimQuantity: builder.mutation({
      query: ({ claimId, quantity }: { claimId: string; quantity: number }) => ({
        url: `/claims/${claimId}/quantity`,
        method: 'PATCH',
        body: { quantity },
      }),
      invalidatesTags: ['UserClaims', 'ClaimableOrders'],
    }),
    getClaimEvidence: builder.query({
      query: (claimId: string) => `/claims/${claimId}/evidence`,
      providesTags: (_r, _e, id) => [{ type: 'ClaimEvidence', id }],
    }),
    getClaimHistory: builder.query({
      query: (claimId: string) => `/claims/${claimId}/history`,
      providesTags: (_r, _e, id) => [{ type: 'ClaimHistory', id }],
    }),

    // Disputes
    getDispute: builder.query({
      query: (claimId: string) => `/disputes/${claimId}`,
      providesTags: (_r, _e, id) => [{ type: 'Dispute', id }],
    }),

    // Fulfiller
    getFulfillerProfile: builder.query({
      query: (userId: string) => `/fulfiller_profile/${userId}`,
      providesTags: ['FulfillerProfile'],
    }),
    getFulfillerAddress: builder.query({
      query: (userId: string) => `/users/${userId}/fulfiller_address`,
      providesTags: ['FulfillerAddress'],
    }),
    getManufacturingProcesses: builder.query({
      query: () => '/manufacturing/processes',
      providesTags: ['ManufacturingProcesses'],
    }),
    getManufacturingMaterials: builder.query({
      query: () => '/manufacturing/materials',
      providesTags: ['ManufacturingMaterials'],
    }),

    // Catalog
    getParts: builder.query({
      query: (params: { page?: number; search?: string; file_type?: string; category?: string }) => ({
        url: '/parts',
        params,
      }),
      providesTags: ['Parts'],
    }),
    getPartDetail: builder.query({
      query: (partId: string) => `/parts/${partId}`,
      providesTags: (_r, _e, id) => [{ type: 'PartDetail', id }],
    }),
    orderFromPart: builder.mutation({
      query: (body: { part_id: string; quantity: number; material?: string; technique?: string; colour?: string; sizing?: number }) => ({
        url: `/parts/${body.part_id}/order`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BasketItems'],
    }),

    // Basket
    updateBasketQuantity: builder.mutation({
      query: (body: { basket_item_id: string; quantity: number }) => ({
        url: '/basket_item_quantity',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BasketItems'],
    }),

    // Fulfiller Address
    updateFulfillerAddress: builder.mutation({
      query: ({ userId, address }: { userId: string; address: any }) => ({
        url: `/users/${userId}/fulfiller_address`,
        method: 'PUT',
        body: address,
      }),
      invalidatesTags: ['FulfillerAddress'],
    }),
  }),
});
