import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { UUID } from "crypto";


export const autApi = createApi({
    reducerPath: 'authApi',
    baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:1234' }),
    endpoints: (builder) => ({
      meshyGenerateTask: builder.mutation<MeshyTaskGeneratedResponse, MeshyPayload>({
        query: (payload) => ({
          url: '/auth/google',
          method: 'GET',
          body: payload,
        }),
      }),
    }),
  });