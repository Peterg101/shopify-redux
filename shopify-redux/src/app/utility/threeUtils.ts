import * as THREE from 'three'
import { DataState } from './interfaces'

export function calculateThreeVolume(mesh: THREE.Mesh<any, any, any>, precision: boolean): number {
  let volumen = 0
  const vertices = mesh.geometry.attributes.position.array
  let indices = mesh.geometry.index ? mesh.geometry.index.array : null

  function volumenTriangular(p1: any, p2: any, p3: any) {
    const v321 = p3.x * p2.y * p1.z
    const v231 = p2.x * p3.y * p1.z
    const v312 = p3.x * p1.y * p2.z
    const v132 = p2.x * p1.y * p3.z
    const v213 = p1.x * p3.y * p2.z
    const v123 = p1.x * p2.y * p3.z
    return (1.0 / 6.0) * (-v321 + v231 + v312 - v132 - v213 + v123)
  }

  if (!indices) {
    indices = Array.from({ length: vertices.length / 3 }, (_, i) => i)
  }

  for (let i = 0; i < indices.length; i += 3) {
    const a = new THREE.Vector3().fromArray(vertices, indices[i] * 3)
    const b = new THREE.Vector3().fromArray(vertices, indices[i + 1] * 3)
    const c = new THREE.Vector3().fromArray(vertices, indices[i + 2] * 3)
    volumen += volumenTriangular(a, b, c)
  }

  if (precision) {
    return Math.abs(volumen / 10)
  } else {
    return Math.abs(volumen / 1000)
  }
}

export function calculateSize(mesh: any) {
  const boundingBox = new THREE.Box3().setFromObject(mesh)
  const size = new THREE.Vector3()
  const boundingBoxSize = boundingBox.getSize(size)
  return boundingBoxSize
}

export function getLongestAxis(vector: THREE.Vector3): number {
  const { x, y, z } = vector
  return Math.max(x, y, z)
}

export function getShortestAxis(vector: THREE.Vector3): number {
  const { x, y, z } = vector
  return Math.min(x, y, z)
}

export function calculateMaxScaling(initialModelDimensions: THREE.Vector3): number {
  const axisLength = 250
  const longestAxis = getLongestAxis(initialModelDimensions)
  return Number((axisLength / longestAxis).toFixed(2))
}

export function calculateMinScaling(initialModelDimensions: THREE.Vector3): number {
  const axisLength = 0.5
  const shortestAxis = getShortestAxis(initialModelDimensions)
  return Number((axisLength / shortestAxis).toFixed(2))
}

export function getModelDimensions(dataState: DataState): THREE.Vector3 {
  const { x, y, z } = dataState.modelDimensions.position
  return new THREE.Vector3(x, y, z)
}

export function getMidPoint(minValue: number, maxValue: number): number {
  return (minValue + maxValue) / 2
}

export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}
