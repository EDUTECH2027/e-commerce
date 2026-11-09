import { useEffect, useState } from 'react'
import type { Category } from '../../shared/types'
import { api } from './api'

/** Visible categories for the storefront navigation. */
export function useCategories(): Category[] {
  const [cats, setCats] = useState<Category[]>([])
  useEffect(() => {
    api.get<Category[]>('/api/categories').then(setCats, () => {})
  }, [])
  return cats
}
