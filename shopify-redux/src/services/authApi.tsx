import { createApi } from '@reduxjs/toolkit/query/react';
import { createBaseQueryWithReauth } from './baseQueryWithReauth';
import { UserAndTasksAndBasketAndIncompleteAndOrders } from '../app/utility/interfaces';


export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: createBaseQueryWithReauth(process.env.REACT_APP_AUTH_SERVICE!),
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ['sessionData', 'BasketItems', 'UserOrders', 'UserClaims', 'UserTasks'],
  endpoints: (builder) => ({
    getSession: builder.query<UserAndTasksAndBasketAndIncompleteAndOrders, void>({
      query: () => ({
        url: '/get_session',
        method: 'GET',
        
      }),
      providesTags: ['sessionData', 'BasketItems', 'UserOrders', 'UserClaims', 'UserTasks'],
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
export const { useGetSessionQuery, useLogOutMutation, useLoginMutation, useRegisterMutation } = authApi;