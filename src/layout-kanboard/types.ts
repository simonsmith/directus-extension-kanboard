import {User} from '@directus/types'

export type LayoutOptions = {
  groupField: string
  groupTitle: string
  dateField: string
  tagsField?: string
  userField?: string
  titleField?: string
  textField?: string
  imageSource?: string
  crop: boolean
  showUngrouped: boolean
  showIndex: boolean
  enableInfiniteScroll: boolean
  groupByField?: string
  iconTemplate?: string
  headerTemplate?: string
  cardContentTemplate?: string
  sort?: string[]
}

export type LayoutQuery = {
  fields?: string[]
  sort?: string
  limit?: number
  page?: number
}

export type Group = {
  id: string | number | null
  title: string
  items: Item[]
  sort: number
}

export type Item = {
  id: string | number
  sort: number
  title?: string
  text?: string
  image?: string
  date?: string
  dateType?: string
  tags?: string
  item: Record<string, any>
  users: User[]
}

export type CardItem = {
  id: number
  status: string
  title: string
  size: string
  description: string
  user_assigned: string
  tags: Array[1]
  acceptance_criteria: string
  links: null
  sort: number
  user_created: string
  date_created: string
  user_updated: string
  date_updated: string
}

export type ChangeEvent<T> = {
  added?: {
    element: T
    newIndex: number
  }
  removed?: {
    element: T
    oldIndex: number
  }
  moved?: {
    element: T
    newIndex: number
    oldIndex: number
  }
}

export type LayoutQuery = Record<string, never>
