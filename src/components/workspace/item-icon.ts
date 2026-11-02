"use client";

import {
  BookOpen,
  ClipboardList,
  ExternalLink,
  FileText,
  Folder,
  MessageSquare,
} from "lucide-react";

import { isContainerType } from "@/lib/ilias/items";

export const iconFor = (type: string) =>
  type === "file"
    ? FileText
    : type === "exc"
      ? ClipboardList
      : type === "frm"
        ? MessageSquare
        : isContainerType(type)
          ? type === "crs"
            ? BookOpen
            : Folder
          : ExternalLink;
