import { BasketInformation, Order, UserInformation } from './interfaces'

export function validateData(
  data: Record<string, any>,
  schema: Record<string, (value: any) => boolean>
): string[] {
  return Object.entries(schema)
    .filter(([key, isValid]) => !isValid(data[key]))
    .map(([key]) => key)
}

export function calculateTotalBasketValue(basketItems: BasketInformation[]): number {
  if (basketItems.length == 0) {
    return 0
  }
  const subtotal = basketItems.reduce((sum, item) => sum + item.quantity * item.price, 0)
  return subtotal
}

export function visibleOrders(user: UserInformation, claimable_orders: Order[]): Order[] {
  return claimable_orders.filter((order) => {
    if (order.quantity_claimed == order.quantity) {
      return false
    }
    const alreadyClaimedByUser = order.claims?.some(
      (claim) => claim.claimant_user_id === user.user_id
    )

    if (alreadyClaimedByUser) {
      return false
    }

    return true
  })
}
