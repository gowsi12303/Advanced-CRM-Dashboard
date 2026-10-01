"use client";

import {
  CopyIcon,
  EyeIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneCallIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Customer } from "../types";

/** Actions the parent view is responsible for (dialogs, drawers, mutations). */
export type CustomerRowAction = "view" | "edit" | "logContact" | "delete";

type CustomerRowActionsProps = {
  customer: Customer;
  onAction: (action: CustomerRowAction, customer: Customer) => void;
};

async function copyEmail(email: string) {
  try {
    await navigator.clipboard.writeText(email);
    toast.success("Email address copied");
  } catch {
    toast.error("Could not copy the email address");
  }
}

export function CustomerRowActions({
  customer,
  onAction,
}: CustomerRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontalIcon />
          <span className="sr-only">Actions for {customer.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => onAction("view", customer)}>
          <EyeIcon />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("edit", customer)}>
          <PencilIcon />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("logContact", customer)}>
          <PhoneCallIcon />
          Log contact
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => copyEmail(customer.email)}>
          <CopyIcon />
          Copy email
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`mailto:${customer.email}`}>
            <MailIcon />
            Send email
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => onAction("delete", customer)}
        >
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
