import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { BasketQuantityUpdate } from "../app/utility/interfaces";
import { authApi } from './authApi';

export const basketApi = createApi({
  reducerPath: 'basketApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'http://localhost:8000',
    credentials: 'include',
    
  }),
  tagTypes: ['sessionData'],
  endpoints: (builder) => ({
    updateBasketQuantity: builder.mutation<void, BasketQuantityUpdate>({
      query: ({ task_id, quantity }) => ({
        url: `/basket_item_quantity`,
        method: 'POST',
        body: { task_id, quantity },
        headers: {
          'Content-Type': 'application/json',
        }
      }),
      async onQueryStarted({ task_id, quantity }, { dispatch, queryFulfilled, getState }) {
        const patchResult = dispatch(
          authApi.util.updateQueryData('getSession', undefined, (draft: any) => {
            // Find and update the item in the session data
            const item = draft.userInformation?.basket_items.find((i: any) => i.task_id === task_id);
            if (item) {
              item.quantity = quantity;
            }
          })
        );

        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
      // Invalidate sessionData to trigger refetching of session data after the update
      invalidatesTags: ['sessionData'],
    }),

  }),
});

export const { useUpdateBasketQuantityMutation } = basketApi;