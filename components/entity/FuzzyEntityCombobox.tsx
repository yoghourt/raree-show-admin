"use client"

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import * as React from "react"

import type { EntityOption, FuzzyComboboxProps } from "@/components/entity/types"
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

export function FuzzyEntityCombobox({
  value,
  options,
  placeholder = messages.common.search,
  loading = false,
  disabled = false,
  onSelect,
}: FuzzyComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selected = React.useMemo(
    () => options.find((o) => o.id === value),
    [options, value]
  )

  const ranked = React.useMemo(
    () => rankEntityOptions(search, options),
    [search, options]
  )

  const triggerDisabled = disabled || loading

  return (
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
            !value && !loading && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {loading ? messages.common.loading : selected?.label ?? placeholder}
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
                {ranked.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.id}
                    keywords={[opt.label, opt.id, ...(opt.aliases ?? [])]}
                    onSelect={() => {
                      onSelect(opt)
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        value === opt.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {opt.id}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  )
}

export type { EntityOption }
