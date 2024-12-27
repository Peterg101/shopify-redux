import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { UUID } from "crypto";
import { UserAndTasks } from '../app/utility/interfaces';


export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'http://localhost:2468',
    credentials: 'include',
  }),
  endpoints: (builder) => ({
    getSession: builder.query<UserAndTasks, void>({
      query: () => ({
        url: '/get_session',
        method: 'GET',
      }),
    }),
    logOut: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/logout',
        method: 'GET',
      }),
    }),
  }),
});

// Export hooks for the queries
export const { useGetSessionQuery, useLogOutMutation } = authApi;