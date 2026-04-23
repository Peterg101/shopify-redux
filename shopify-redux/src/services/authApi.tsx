import { createApi } from '@reduxjs/toolkit/query/react';
import { createBaseQueryWithReauth } from './baseQueryWithReauth';
import { SlimSession, BasketInformation, Order, Claim, TaskInformation, SubscriptionInfo, TransactionsResponse } from '../app/utility/interfaces';


export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: createBaseQueryWithReauth(process.env.REACT_APP_API_URL!),
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ['sessionData', 'BasketItems', 'UserOrders', 'UserClaims', 'UserTasks', 'ClaimableOrders'],
  endpoints: (builder) => ({
    getSlimSession: builder.query<SlimSession, void>({
      query: () => ({ url: '/session', method: 'GET' }),
      providesTags: ['sessionData'],
    }),
    getUserBasket: builder.query<BasketInformation[], void>({
      query: () => ({ url: '/user_basket', method: 'GET' }),
      providesTags: ['BasketItems'],
    }),
    getUserOrders: builder.query<Order[], void>({
      query: () => ({ url: '/user_orders', method: 'GET' }),
      providesTags: ['UserOrders'],
    }),
    getUserClaims: builder.query<Claim[], void>({
      query: () => ({ url: '/user_claims', method: 'GET' }),
      providesTags: ['UserClaims'],
    }),
    getUserClaimable: builder.query<Order[], void>({
      query: () => ({ url: '/user_claimable', method: 'GET' }),
      providesTags: ['ClaimableOrders'],
    }),
    getUserTasks: builder.query<TaskInformation[], void>({
      query: () => ({ url: '/user_tasks', method: 'GET' }),
      providesTags: ['UserTasks'],
    }),
    logOut: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/logout',
        method: 'GET',
      }),
    }),
    login: builder.mutation<any, { email: string; password: string }>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['sessionData'],
    }),
    register: builder.mutation<any, { username: string; email: string; password: string }>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['sessionData'],
    }),
    forgotPassword: builder.mutation<{ message: string }, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),
    resetPassword: builder.mutation<{ message: string }, { token: string; new_password: string }>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
    resendVerification: builder.mutation<{ message: string }, void>({
      query: () => ({ url: '/auth/resend-verification', method: 'POST' }),
      invalidatesTags: ['sessionData'],
    }),
    submitFeedback: builder.mutation<{ message: string; example_id?: string }, { taskId: string; rating: 'up' | 'down' }>({
      query: ({ taskId, rating }) => ({
        url: `/tasks/${taskId}/feedback`,
        method: 'POST',
        body: { rating },
      }),
    }),
    // ── Billing ──────────────────────────────────────────────
    createCheckout: builder.mutation<{ checkout_url: string }, { tier: 'pro' | 'enterprise' }>({
      query: (body) => ({ url: '/billing/create-checkout', method: 'POST', body }),
    }),
    createCreditCheckout: builder.mutation<{ checkout_url: string }, { pack: 'small' | 'large' }>({
      query: (body) => ({ url: '/billing/create-credit-checkout', method: 'POST', body }),
    }),
    manageBilling: builder.mutation<{ portal_url: string }, void>({
      query: () => ({ url: '/billing/manage', method: 'POST' }),
    }),
    getSubscription: builder.query<SubscriptionInfo, void>({
      query: () => ({ url: '/billing/subscription', method: 'GET' }),
      providesTags: ['sessionData'],
    }),
    getTransactions: builder.query<TransactionsResponse, { limit?: number; offset?: number }>({
      query: ({ limit = 20, offset = 0 }) => ({
        url: `/billing/transactions?limit=${limit}&offset=${offset}`,
        method: 'GET',
      }),
    }),
  }),
});

export const {
  useGetSlimSessionQuery,
  useGetUserBasketQuery,
  useGetUserOrdersQuery,
  useGetUserClaimsQuery,
  useGetUserClaimableQuery,
  useGetUserTasksQuery,
  useLogOutMutation,
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useResendVerificationMutation,
  useSubmitFeedbackMutation,
  useCreateCheckoutMutation,
  useCreateCreditCheckoutMutation,
  useManageBillingMutation,
  useGetSubscriptionQuery,
  useGetTransactionsQuery,
} = authApi;
