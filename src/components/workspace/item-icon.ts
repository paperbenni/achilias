"use client";

import {
  BookOpen,
  ExternalLink,
  FileText,
  Folder,
  MessageSquare,
} from "lucide-react";

import { isContainerType } from "@/lib/ilias/items";

export const iconFor = (type: string) =>
  type === "file"
    ? FileText
    : type === "frm"
      ? MessageSquare
      : isContainerType(type)
        ? type === "crs"
          ? BookOpen
          : Folder
        : ExternalLink;
