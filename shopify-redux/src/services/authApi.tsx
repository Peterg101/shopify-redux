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
    getFile: builder.query<FileResponse, string>({
      query: (fileId) => ({
        url: `/file_storage/${fileId}`,
        method: 'GET',
      }),
      providesTags: ['fileData'],
      keepUnusedDataFor: 0,
      async onQueryStarted(fileId, { dispatch, queryFulfilled }) {
        try {
            // Invalidate previous cache if necessary
            dispatch(authApi.util.invalidateTags([{ type: 'fileData', id: fileId }]));

            const { data: response } = await queryFulfilled;

            // Decode Base64 to byte array
            const byteCharacters = atob(response.file_data);
            const byteNumbers = Array.from(byteCharacters, char => char.charCodeAt(0));
            let byteArray = new Uint8Array(byteNumbers); // Fresh instance

            // Process the byte array
            console.log("Fresh Byte Array:", byteArray);

        } catch (error) {
            console.error("Error retrieving file:", error);
        }
    },
    }),
  }),
});

// Export hooks for the queries
export const { useGetSessionQuery, useLogOutMutation, useLazyGetFileQuery } = authApi;