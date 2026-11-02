"use client";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
const subscribe = () => () => {};
export function AppearanceMenu() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={mounted ? theme : undefined}
        onValueChange={setTheme}
      >
        <DropdownMenuRadioItem value="light">
          <Sun />
          Light
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">
          <Moon />
          Dark
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system">
          <Monitor />
          System
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}
