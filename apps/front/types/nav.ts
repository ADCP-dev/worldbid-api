export interface NavMenuItem {
  title: string
  icon?: string
  link?: string
  children?: NavMenuItem[]
  new?: boolean
  order?: number
}

export interface NavLink extends NavMenuItem {}

export interface NavGroup extends NavMenuItem {}

export interface NavSectionTitle {
  title: string
  order?: number
}

export type NavMenuItems = NavMenuItem[]

export interface NavMenu {
  heading?: string
  items: NavMenuItem[]
  order?: number
}