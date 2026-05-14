export type EntityOption = {
  id: string
  label: string
  aliases?: string[]
}

export type FuzzyComboboxProps = {
  value?: string
  options: EntityOption[]
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  onSelect: (option: EntityOption) => void
}
