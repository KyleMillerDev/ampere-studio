export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface NavItem {
  title: string
  href: string
  description?: string
  icon?: string
  children?: NavItem[]
}
