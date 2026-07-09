"use client"

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import * as React from "react"

import type { EntityOption } from "@/components/entity/types"
import { buttonVariants } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { rankEntityOptions } from "@/lib/entity-fuzzy-rank"
import { messages } from "@/lib/locale"
import { cn } from "@/lib/utils"

const EMPTY_COPY = messages.common.noMatchingResults

export type EntityMultiFuzzyPickerProps = {
  options: EntityOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  loading?: boolean
  disabled?: boolean
}

export function EntityMultiFuzzyPicker({
  options,
  value,
  onChange,
  placeholder = messages.forms.searchCharacters,
  loading = false,
  disabled = false,
}: EntityMultiFuzzyPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const ranked = React.useMemo(
    () => rankEntityOptions(search, options),
    [search, options]
  )

  const selectedSet = React.useMemo(() => new Set(value), [value])

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((x) => x !== id))
    } else {
      onChange([...value, id])
    }
  }

  const summary =
    value.length === 0
      ? "选择角色"
      : value.length === 1
        ? options.find((o) => o.id === value[0])?.label ?? value[0]
        : `已选 ${value.length} 个角色`

  const triggerDisabled = disabled || loading

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setSearch("")
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={triggerDisabled}
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "h-10 w-full max-w-md justify-between font-normal",
              value.length === 0 && !loading && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {loading ? messages.common.loading : summary}
            </span>
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-md p-0">
          {loading ? (
            <div
              className="flex min-h-48 items-center justify-center px-3 py-6 text-sm text-muted-foreground"
              aria-busy="true"
            >
              {messages.common.loading}
            </div>
          ) : (
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={placeholder}
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>{EMPTY_COPY}</CommandEmpty>
                <CommandGroup>
                  {ranked.map((opt) => {
                    const isOn = selectedSet.has(opt.id)
                    return (
                      <CommandItem
                        key={opt.id}
                        value={opt.id}
                        keywords={[
                          opt.label,
                          opt.id,
                          ...(opt.aliases ?? []),
                        ]}
                        onSelect={() => {
                          toggle(opt.id)
                        }}
                      >
                        <CheckIcon
                          className={cn(
                            "size-4 shrink-0",
                            isOn ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{opt.label}</span>
                        <span className="ml-auto font-mono text-xs text-muted-foreground">
                          {opt.id}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => {
            const label = options.find((o) => o.id === id)?.label ?? id
            return (
              <span
                key={id}
                className="bg-muted inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs"
              >
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  className="text-destructive hover:underline"
                  onClick={() => onChange(value.filter((x) => x !== id))}
                  aria-label={`移除 ${label}`}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
