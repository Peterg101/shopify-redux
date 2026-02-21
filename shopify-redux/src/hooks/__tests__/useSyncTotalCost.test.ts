import { renderHook } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import { makeStore } from '../../app/store'
import { useSyncTotalCost } from '../useSyncTotalCost'
import { setModelVolume, setTotalCost } from '../../services/dataSlice'

function createWrapper() {
  const store = makeStore()
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store }, children)
  return { store, wrapper }
}

describe('useSyncTotalCost', () => {
  it('does not cause infinite re-renders', () => {
    const { wrapper } = createWrapper()
    // If totalCost were in the dependency array, this would cause an infinite loop
    // and the test would time out. The fix ensures it completes.
    const { result } = renderHook(() => useSyncTotalCost(), { wrapper })
    expect(result.current).toBeUndefined() // hook returns void
  })

  it('dispatches totalCost when inputs change', () => {
    const { store, wrapper } = createWrapper()
    store.dispatch(setModelVolume({ modelVolume: 1000 }))

    renderHook(() => useSyncTotalCost(), { wrapper })

    const state = store.getState()
    // With modelVolume=1000, materialCost=0.00005, multiplierValue=1
    // result should be at least the base cost floor
    expect(state.dataState.totalCost).toBeGreaterThanOrEqual(10)
  })
})
