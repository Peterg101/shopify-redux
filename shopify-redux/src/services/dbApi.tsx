import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  OrderDetail,
  ClaimEvidence,
  ClaimStatusHistory,
  Dispute,
  FulfillerAddress,
  BasketInformationAndFile,
  ClaimOrder,
} from '../app/utility/interfaces';
import { authApi } from './authApi';

export const dbApi = createApi({
  reducerPath: 'dbApi',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.REACT_APP_DB_SERVICE,
    credentials: 'include',
  }),
  tagTypes: ['OrderDetail', 'ClaimEvidence', 'ClaimHistory', 'Dispute', 'FulfillerAddress'],
  endpoints: (builder) => ({
    // ── Queries ──────────────────────────────────────────────
    getOrderDetail: builder.query<OrderDetail, string>({
      query: (orderId) => `/orders/${orderId}/detail`,
      providesTags: (_result, _error, orderId) => [{ type: 'OrderDetail', id: orderId }],
    }),

    getClaimEvidence: builder.query<ClaimEvidence[], string>({
      query: (claimId) => `/claims/${claimId}/evidence`,
      providesTags: (_result, _error, claimId) => [{ type: 'ClaimEvidence', id: claimId }],
    }),

    getClaimHistory: builder.query<ClaimStatusHistory[], string>({
      query: (claimId) => `/claims/${claimId}/history`,
      providesTags: (_result, _error, claimId) => [{ type: 'ClaimHistory', id: claimId }],
    }),

    getDispute: builder.query<Dispute, string>({
      query: (claimId) => `/disputes/${claimId}`,
      providesTags: (_result, _error, claimId) => [{ type: 'Dispute', id: claimId }],
    }),

    getFulfillerAddress: builder.query<FulfillerAddress | null, string>({
      queryFn: async (userId, _queryApi, _extraOptions, baseQuery) => {
        const result = await baseQuery(`/users/${userId}/fulfiller_address`);
        if (result.error) {
          if (result.error.status === 404) return { data: null };
          return { error: result.error };
        }
        return { data: result.data as FulfillerAddress };
      },
      providesTags: (_result, _error, userId) => [{ type: 'FulfillerAddress', id: userId }],
    }),

    // ── Mutations ────────────────────────────────────────────
    uploadFile: builder.mutation<void, BasketInformationAndFile>({
      query: (body) => ({
        url: '/file_storage',
        method: 'POST',
        body,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(['sessionData']));
        } catch { /* mutation failed */ }
      },
    }),

    deleteBasketItem: builder.mutation<void, string>({
      query: (fileId) => ({
        url: `/file_storage/${fileId}`,
        method: 'DELETE',
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(['sessionData']));
        } catch { /* mutation failed */ }
      },
    }),

    claimOrder: builder.mutation<void, ClaimOrder>({
      query: (body) => ({
        url: '/claims/claim_order',
        method: 'POST',
        body,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(['sessionData']));
        } catch { /* mutation failed */ }
      },
    }),

    updateClaimStatus: builder.mutation<any, { claimId: string; status: string; reason?: string }>({
      query: ({ claimId, status, reason }) => ({
        url: `/claims/${claimId}/status`,
        method: 'PATCH',
        body: reason ? { status, reason } : { status },
      }),
      invalidatesTags: (_result, _error, { claimId }) => [
        { type: 'ClaimHistory', id: claimId },
        'OrderDetail',
      ],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(['sessionData']));
        } catch { /* mutation failed */ }
      },
    }),

    updateClaimQuantity: builder.mutation<any, { claimId: string; quantity: number }>({
      query: ({ claimId, quantity }) => ({
        url: `/claims/${claimId}/quantity`,
        method: 'PATCH',
        body: { quantity },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(['sessionData']));
        } catch { /* mutation failed */ }
      },
    }),

    uploadClaimEvidence: builder.mutation<any, { claimId: string; imageData: string; description?: string }>({
      query: ({ claimId, imageData, description }) => ({
        url: `/claims/${claimId}/evidence`,
        method: 'POST',
        body: { image_data: imageData, description },
      }),
      invalidatesTags: (_result, _error, { claimId }) => [{ type: 'ClaimEvidence', id: claimId }],
    }),

    toggleOrderVisibility: builder.mutation<any, string>({
      query: (orderId) => ({
        url: `/orders/${orderId}/visibility`,
        method: 'PATCH',
      }),
      invalidatesTags: (_result, _error, orderId) => [{ type: 'OrderDetail', id: orderId }],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(['sessionData']));
        } catch { /* mutation failed */ }
      },
    }),

    respondToDispute: builder.mutation<any, { disputeId: string; responseText: string }>({
      query: ({ disputeId, responseText }) => ({
        url: `/disputes/${disputeId}/respond`,
        method: 'POST',
        body: { response_text: responseText },
      }),
      invalidatesTags: (_result, _error, { disputeId }) => [
        { type: 'Dispute', id: disputeId },
        'OrderDetail',
      ],
    }),

    resolveDispute: builder.mutation<any, { disputeId: string; resolution: string; partialAmountCents?: number }>({
      query: ({ disputeId, resolution, partialAmountCents }) => ({
        url: `/disputes/${disputeId}/resolve`,
        method: 'POST',
        body: partialAmountCents !== undefined
          ? { resolution, partial_amount_cents: partialAmountCents }
          : { resolution },
      }),
      invalidatesTags: (_result, _error, { disputeId }) => [
        { type: 'Dispute', id: disputeId },
        'OrderDetail',
      ],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(['sessionData']));
        } catch { /* mutation failed */ }
      },
    }),

    uploadDisputeEvidence: builder.mutation<any, { disputeId: string; imageData: string; description?: string }>({
      query: ({ disputeId, imageData, description }) => ({
        url: `/disputes/${disputeId}/evidence`,
        method: 'POST',
        body: { image_data: imageData, description },
      }),
      invalidatesTags: (_result, _error, { disputeId }) => [{ type: 'Dispute', id: disputeId }],
    }),

    updateFulfillerAddress: builder.mutation<void, { userId: string; address: FulfillerAddress }>({
      query: ({ userId, address }) => ({
        url: `/users/${userId}/fulfiller_address`,
        method: 'PUT',
        body: address,
      }),
      invalidatesTags: (_result, _error, { userId }) => [{ type: 'FulfillerAddress', id: userId }],
    }),
  }),
});

export const {
  useGetOrderDetailQuery,
  useGetClaimEvidenceQuery,
  useGetClaimHistoryQuery,
  useGetDisputeQuery,
  useGetFulfillerAddressQuery,
  useUploadFileMutation,
  useDeleteBasketItemMutation,
  useClaimOrderMutation,
  useUpdateClaimStatusMutation,
  useUpdateClaimQuantityMutation,
  useUploadClaimEvidenceMutation,
  useToggleOrderVisibilityMutation,
  useRespondToDisputeMutation,
  useResolveDisputeMutation,
  useUploadDisputeEvidenceMutation,
  useUpdateFulfillerAddressMutation,
} = dbApi;
