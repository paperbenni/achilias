"use client";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectForm } from "./connect-form";

export function ConnectDialog({
  open,
  onOpenChange,
  instance,
  passwordAvailable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: string;
  passwordAvailable: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <DialogTitle>Sign in to ILIAS</DialogTitle>
          <DialogDescription>Use your university account.</DialogDescription>
        </DialogHeader>
        <ConnectForm
          instance={instance}
          passwordAvailable={passwordAvailable}
        />
      </DialogContent>
    </Dialog>
  );
}
