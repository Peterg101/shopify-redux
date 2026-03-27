import { createApi } from '@reduxjs/toolkit/query/react';
import { createBaseQueryWithReauth } from './baseQueryWithReauth';
import { UserAndTasksAndBasketAndIncompleteAndOrders, SlimSession, BasketInformation, Order, Claim, TaskInformation } from '../app/utility/interfaces';


export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: createBaseQueryWithReauth(process.env.REACT_APP_AUTH_SERVICE!),
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ['sessionData', 'BasketItems', 'UserOrders', 'UserClaims', 'UserTasks', 'ClaimableOrders'],
  endpoints: (builder) => ({
    // Legacy endpoint — kept for backward compatibility during migration
    getSession: builder.query<UserAndTasksAndBasketAndIncompleteAndOrders, void>({
      query: () => ({
        url: '/get_session',
        method: 'GET',

      }),
      providesTags: ['sessionData', 'BasketItems', 'UserOrders', 'UserClaims', 'UserTasks'],
    }),
    // New granular endpoints
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
  }),
});

// Export hooks for the queries
export const {
  useGetSessionQuery,
  useGetSlimSessionQuery,
  useGetUserBasketQuery,
  useGetUserOrdersQuery,
  useGetUserClaimsQuery,
  useGetUserClaimableQuery,
  useGetUserTasksQuery,
  useLogOutMutation,
  useLoginMutation,
  useRegisterMutation,
} = authApi;