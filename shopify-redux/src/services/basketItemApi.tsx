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
        },
      }),
      async onQueryStarted({ task_id, quantity }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          authApi.util.updateQueryData('getSession', undefined, (draft: any) => {
            // Optimistically update the basket item's quantity in the session data
            const item = draft.userInformation?.basket_items.find((i: any) => i.task_id === task_id);
            if (item) {
              item.quantity = quantity;
            }
          })
        );

        try {
          await queryFulfilled;  // Wait for the API mutation to complete
          // Invalidate the session cache to trigger a refetch of the latest data
          dispatch(authApi.util.invalidateTags(['sessionData']));
        } catch {
          patchResult.undo();  // Rollback if the mutation fails
        }
      },
      // This triggers refetching of the session data to get the updated basket info
      invalidatesTags: ['sessionData'],
    }),
    generateTasksFromBasket: builder.mutation<{ message: string; task_ids: string[] }, void>({
    query: () => ({
      url: `/tasks/from_basket`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }),
    invalidatesTags: ['sessionData'],
}),




  }),
});

export const { 
  useUpdateBasketQuantityMutation,
  useGenerateTasksFromBasketMutation 
} = basketApi;
