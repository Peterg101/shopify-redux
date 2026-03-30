import { createApi } from '@reduxjs/toolkit/query/react';
import { createBaseQueryWithReauth } from './baseQueryWithReauth';
import {
  Part,
  PartCreate,
  PartUpdate,
  PartListResponse,
  PartOrderConfig,
} from '../app/utility/interfaces';
import { authApi } from './authApi';

interface ListPartsParams {
  q?: string;
  category?: string;
  file_type?: string;
  process?: string;
  page?: number;
  page_size?: number;
}

export const catalogApi = createApi({
  reducerPath: 'catalogApi',
  baseQuery: createBaseQueryWithReauth(process.env.REACT_APP_API_URL!),
  tagTypes: ['Parts', 'PartDetail'],
  endpoints: (builder) => ({
    getParts: builder.query<PartListResponse, ListPartsParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params) {
          if (params.q) searchParams.set('q', params.q);
          if (params.category) searchParams.set('category', params.category);
          if (params.file_type) searchParams.set('file_type', params.file_type);
          if (params.process) searchParams.set('process', params.process);
          if (params.page) searchParams.set('page', String(params.page));
          if (params.page_size) searchParams.set('page_size', String(params.page_size));
        }
        const qs = searchParams.toString();
        return `/parts${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['Parts'],
    }),

    getPartDetail: builder.query<Part, string>({
      query: (partId) => `/parts/${partId}`,
      providesTags: (_result, _error, partId) => [{ type: 'PartDetail', id: partId }],
    }),

    publishPart: builder.mutation<Part, PartCreate>({
      query: (body) => ({
        url: '/parts',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Parts'],
    }),

    updatePart: builder.mutation<Part, { partId: string; data: PartUpdate }>({
      query: ({ partId, data }) => ({
        url: `/parts/${partId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (_result, _error, { partId }) => [
        'Parts',
        { type: 'PartDetail', id: partId },
      ],
    }),

    deletePart: builder.mutation<void, string>({
      query: (partId) => ({
        url: `/parts/${partId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Parts'],
    }),

    orderFromPart: builder.mutation<{ message: string; part_id: string; basket_task_id: string }, { partId: string; config: PartOrderConfig }>({
      query: ({ partId, config }) => ({
        url: `/parts/${partId}/order`,
        method: 'POST',
        body: config,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(authApi.util.invalidateTags(['sessionData']));
        } catch { /* mutation failed */ }
      },
    }),
  }),
});

export const {
  useGetPartsQuery,
  useGetPartDetailQuery,
  usePublishPartMutation,
  useUpdatePartMutation,
  useDeletePartMutation,
  useOrderFromPartMutation,
} = catalogApi;
