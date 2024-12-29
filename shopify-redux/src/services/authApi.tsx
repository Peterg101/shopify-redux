import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { UUID } from "crypto";
import { UserAndTasks, FileResponse } from '../app/utility/interfaces';


export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'http://localhost:2468',
    credentials: 'include',
  }),
  tagTypes: ['sessionData'],
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
        url: `/file_storage/${fileId}`, // API endpoint
        method: 'GET',
      }),
      async onQueryStarted(fileId, { dispatch, queryFulfilled }) {
        try {
          const { data: response } = await queryFulfilled;
          // Extract and process Base64-encoded data
          const byteCharacters = atob(response.file_data);
          const byteNumbers = new Array(byteCharacters.length).fill(0).map((_, i) => byteCharacters.charCodeAt(i));
          const byteArray = new Uint8Array(byteNumbers);
    
          // Create a Blob
          const fileBlob = new Blob([byteArray]);
    
          // Use the Blob immediately (e.g., download or display)
          console.log("File Blob ready", fileBlob);
    
          // Optional: Save or process the fileBlob here
        } catch (error) {
          console.error("Error retrieving file:", error);
        }
      },
    }),
  }),
});

// Export hooks for the queries
export const { useGetSessionQuery, useLogOutMutation, useLazyGetFileQuery } = authApi;