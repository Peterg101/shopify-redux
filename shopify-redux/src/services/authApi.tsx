import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { UUID } from "crypto";
import { UserAndTasks, FileResponse } from '../app/utility/interfaces';


export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'http://localhost:2468',
    credentials: 'include',
  }),
  tagTypes: ['sessionData', 'fileData'],
  endpoints: (builder) => ({
    getSession: builder.query<UserAndTasks, void>({
      query: () => ({
        url: '/get_session',
        method: 'GET',
        
      }),
      providesTags: ['sessionData'],
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