"use client";

import { createElement, useEffect, useRef, useState, type ElementType, type KeyboardEvent } from "react";
import styles from "./InlineEditableText.module.css";

interface Props {
  as?: ElementType;
  value: string;
  editing?: boolean;
  multiline?: boolean;
  className?: string;
  ariaLabel?: string;
  onCommit?: (value: string) => void;
}

/**
 * Keeps the template's real text element in place. In edit mode, tapping it
 * makes that same element editable; no replacement form field or editor panel.
 */
export function InlineEditableText({
  as = "span",
  value,
  editing = false,
  multiline = false,
  className = "",
  ariaLabel = "Edit website text",
  onCommit,
}: Props) {
  const [active, setActive] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const element = elementRef.current;
    if (!element) return;
    element.textContent = value;
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [active, value]);

  const finish = (commit: boolean) => {
    const element = elementRef.current;
    const nextValue = (element?.innerText ?? value).replace(/\r\n/g, "\n");
    setActive(false);
    if (commit && nextValue !== value) onCommit?.(nextValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (elementRef.current) elementRef.current.textContent = value;
      finish(false);
      return;
    }
    if (event.key === "Enter" && !multiline) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  const Tag = as;
  const classes = [className, editing ? styles.editableText : ""].filter(Boolean).join(" ");

  return createElement(
    Tag,
    {
      ref: elementRef,
      className: classes || undefined,
      contentEditable: editing && active,
      suppressContentEditableWarning: true,
      tabIndex: editing ? 0 : undefined,
      role: editing ? "textbox" : undefined,
      "aria-label": editing ? ariaLabel : undefined,
      "aria-multiline": editing ? multiline : undefined,
      title: editing && !active ? "Tap to edit" : undefined,
      onClick: editing
        ? (event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            if (!active) setActive(true);
          }
        : undefined,
      onInput: editing && active
        ? (event: React.FormEvent<HTMLElement>) => {
            // Keep typing inside the DOM until blur so the caret never jumps.
            void event.currentTarget.innerText;
          }
        : undefined,
      onBlur: editing && active ? () => finish(true) : undefined,
      onKeyDown: editing && active ? handleKeyDown : undefined,
    },
    value,
  );
}
