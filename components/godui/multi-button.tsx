"use client";

import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

export type MultiButtonVariant = "default" | "outline" | "secondary" | "ghost";
export type MultiButtonSize = "sm" | "md" | "lg";

export type MultiButtonItem = {
  id: string;
  icon: React.ElementType<{ className?: string }>;
  label: React.ReactNode;
  ariaLabel?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  hoverClassName?: string;
};

export type MultiButtonGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

type MultiButtonRootProps = React.HTMLAttributes<HTMLDivElement>;

type MultiButtonSharedProps = MultiButtonRootProps & {
  items: MultiButtonItem[];
  selectedId?: string;
  syncWidthTo?: MultiButtonItem[];
  highlightColor?: string;
  gooey?: boolean;
  variant?: MultiButtonVariant;
  size?: MultiButtonSize;
  fillWidth?: number;
  enable3d?: boolean;
  edgeColor?: string;
  isDark?: boolean;
  inset?: boolean;
  cardFill?: string;
};

export type MultiButtonProps = MultiButtonSharedProps;

export type CompactMultiButtonProps = MultiButtonSharedProps & {
  selectedId: string;
  iconOnly?: boolean;
  restIcon?: MultiButtonItem["icon"];
  restAriaLabel?: string;
};

const SIZE_CONFIG: Record<
  MultiButtonSize,
  { cell: number; icon: string; minHeight: string; text: string }
> = {
  sm: { cell: 40, icon: "size-3.5", minHeight: "h-10", text: "text-xs" },
  md: { cell: 40, icon: "size-4", minHeight: "h-10", text: "text-sm" },
  lg: { cell: 40, icon: "size-[18px]", minHeight: "h-10", text: "text-sm" },
};

const VARIANT_CLASSES: Record<MultiButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20",
  outline: "bg-background text-foreground shadow-xs ring-1 ring-inset ring-border/80",
  secondary: "bg-secondary text-secondary-foreground shadow-xs",
  ghost: "bg-muted/50 text-foreground ring-1 ring-border/60",
};

const ITEM_HOVER_CLASSES: Record<MultiButtonVariant, string> = {
  default: "hover:bg-primary-foreground/10 active:bg-primary-foreground/20",
  outline: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
  secondary: "hover:bg-secondary-foreground/10 active:bg-secondary-foreground/20",
  ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
};

const GOOEY_TEXT_CLASSES: Record<MultiButtonVariant, string> = {
  default: "text-primary-foreground",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-foreground",
};

function labelText(label: React.ReactNode) {
  return typeof label === "string" || typeof label === "number"
    ? label.toString()
    : "";
}

function itemAriaLabel(item: MultiButtonItem) {
  return item.ariaLabel ?? (labelText(item.label) || item.id);
}

type MultiButtonLabelProps = {
  item: MultiButtonItem;
  textClass: string;
  highlightColor?: string;
  active?: boolean;
};

const MultiButtonLabel = React.forwardRef<
  HTMLSpanElement,
  MultiButtonLabelProps
>(({ item, textClass, highlightColor, active }, ref) => (
  <motion.span
    ref={ref}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.15 }}
    style={{
      color: active && highlightColor ? highlightColor : undefined,
    }}
    className={`relative z-10 -ml-1 min-w-0 truncate pr-2 font-semibold leading-none transition-all duration-200 ${
      active ? "scale-[1.06] font-bold" : ""
    } ${textClass}`}
  >
    {item.label}
  </motion.span>
));
MultiButtonLabel.displayName = "MultiButtonLabel";

type MultiButtonItemButtonProps = {
  item: MultiButtonItem;
  active: boolean;
  accessible?: boolean;
  ariaLabel?: string;
  disabled: boolean;
  highlighted: boolean;
  highlightColor?: string;
  gooey?: boolean;
  transparent?: boolean;
  size: MultiButtonSize;
  variant: MultiButtonVariant;
  width: number;
  iconOffset: number;
  restIcon?: MultiButtonItem["icon"];
  showRestIcon?: boolean;
  visible?: boolean;
  onTouchAction: (
    event: React.PointerEvent<HTMLButtonElement>,
    id: string,
  ) => void;
  onHover: (id: string | null) => void;
  onAction?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function MultiButtonItemButton({
  item,
  active,
  accessible = true,
  ariaLabel,
  disabled,
  highlighted,
  highlightColor,
  size,
  variant,
  width,
  iconOffset,
  restIcon,
  showRestIcon = false,
  visible = true,
  onTouchAction,
  onHover,
  onAction,
}: MultiButtonItemButtonProps) {
  const cfg = SIZE_CONFIG[size];
  const Icon = item.icon;
  const RestIcon = restIcon;

  return (
    <motion.button
      type="button"
      data-state={active ? "open" : "closed"}
      data-multi-button-item-id={item.id}
      aria-label={ariaLabel ?? itemAriaLabel(item)}
      aria-hidden={accessible ? undefined : true}
      tabIndex={accessible ? undefined : -1}
      disabled={disabled}
      onClick={(event) => {
        if (item.disabled) return;
        item.onClick?.(event);
        onAction?.(event);
      }}
      onPointerDown={(event) => onTouchAction(event, item.id)}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(item.id)}
      onBlur={() => onHover(null)}
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.8,
      }}
      transition={{ duration: 0.15 }}
      style={{ maxWidth: active ? `${width + 600}px` : `${width}px` }}
      className={`relative isolate flex shrink-0 cursor-pointer items-center justify-start overflow-hidden ${cfg.minHeight} focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.96] transition-all duration-150 ${
        accessible ? "" : "pointer-events-none"
      } ${ITEM_HOVER_CLASSES[variant]} ${item.hoverClassName ?? ""} ${item.className ?? ""}`}
    >
      <span
        data-slot="multi-button-highlight"
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-0 bg-[var(--multi-button-highlight)] transition-opacity duration-150 ${
          highlighted ? "opacity-[0.14]" : "opacity-0"
        }`}
      />
      <span
        data-slot="multi-button-icon"
        className={`relative z-10 flex h-full shrink-0 items-center justify-center transition-all duration-200 ${
          active ? "scale-110" : "scale-100"
        }`}
        style={{
          width: `${cfg.cell}px`,
          transform: `translateX(${iconOffset}px)${active ? " scale(1.15)" : ""}`,
          color: active && highlightColor ? highlightColor : undefined,
        }}
        aria-hidden="true"
      >
        {RestIcon ? (
          <>
            <span
              data-slot="multi-button-action-icon"
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
                showRestIcon ? "opacity-0" : "opacity-100"
              }`}
            >
              <Icon className={cfg.icon} />
            </span>
            <span
              data-slot="multi-button-rest-icon"
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
                showRestIcon ? "opacity-100" : "opacity-0"
              }`}
            >
              <RestIcon className={cfg.icon} />
            </span>
          </>
        ) : (
          <Icon className={cfg.icon} />
        )}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        {active && (
          <MultiButtonLabel
            key={item.id}
            item={item}
            active={active}
            highlightColor={highlightColor}
            textClass={cfg.text}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function MultiButtonDivider({
  activeId,
  variant,
}: {
  activeId: string | null;
  variant: MultiButtonVariant;
}) {
  return (
    <span
      aria-hidden="true"
      className={`my-2 w-px shrink-0 transition-opacity duration-150 ${
        variant === "default"
          ? "bg-primary-foreground/20"
          : variant === "outline"
          ? "bg-border/70"
          : variant === "secondary"
          ? "bg-secondary-foreground/15"
          : "bg-border/70"
      } ${activeId ? "opacity-0" : "opacity-100"}`}
    />
  );
}

const MultiButton = React.forwardRef<HTMLDivElement, MultiButtonProps>(
  (
    {
      items,
      selectedId,
      highlightColor,
      variant = "default",
      size = "md",
      className,
      style,
      gooey,
      ...props
    },
    ref,
  ) => {
    const cfg = SIZE_CONFIG[size];
    const [hoveredId, setHoveredId] = React.useState<string | null>(null);

    const activeId = hoveredId ?? selectedId ?? null;

    const textClass = GOOEY_TEXT_CLASSES[variant];

    return (
      <div
        ref={ref}
        data-slot="multi-button"
        role="group"
        className={`relative inline-flex items-stretch rounded-full ${cfg.minHeight} overflow-hidden gooey ${
          variant === "default"
            ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
            : variant === "outline"
            ? "bg-background text-foreground shadow-xs ring-1 ring-inset ring-border/80"
            : variant === "secondary"
            ? "bg-secondary text-secondary-foreground shadow-xs"
            : "bg-muted/50 text-foreground ring-1 ring-border/60"
        } ${className ?? ""}`}
        style={style}
        {...props}
      >
        {items.map((item, index) => {
          const active = activeId === item.id;
          const width = cfg.cell;

          return (
            <React.Fragment key={item.id}>
              {index > 0 && (
                <MultiButtonDivider activeId={activeId} variant={variant} />
              )}
              <MultiButtonItemButton
                item={item}
                active={active}
                disabled={Boolean(item.disabled)}
                highlighted={Boolean(highlightColor) && active}
                highlightColor={highlightColor}
                size={size}
                variant={variant}
                width={width}
                iconOffset={0}
                onHover={setHoveredId}
                onTouchAction={(e, id) => {
                  if (e.pointerType !== "touch") return;
                  item.onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement>);
                }}
                onAction={item.onClick}
              />
            </React.Fragment>
          );
        })}
      </div>
    );
  },
);
MultiButton.displayName = "MultiButton";

const CompactMultiButton = React.forwardRef<
  HTMLDivElement,
  CompactMultiButtonProps
>(
  (
    {
      items,
      selectedId,
      iconOnly = false,
      restIcon,
      restAriaLabel,
      highlightColor,
      variant = "default",
      size = "md",
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const cfg = SIZE_CONFIG[size];
    const [hoveredId, setHoveredId] = React.useState<string | null>(null);
    const [expanded, setExpanded] = React.useState(false);

    const selectedItem = items.find((item) => item.id === selectedId) ?? items[0];
    const activeId = expanded ? (hoveredId ?? null) : null;

    const textClass = GOOEY_TEXT_CLASSES[variant];

    return (
      <div
        ref={ref}
        data-slot="compact-multi-button"
        role="group"
        className={`relative inline-flex items-stretch rounded-full ${cfg.minHeight} overflow-hidden transition-all duration-200 ${
          variant === "default"
            ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
            : variant === "outline"
            ? "bg-background text-foreground shadow-xs ring-1 ring-inset ring-border/80"
            : variant === "secondary"
            ? "bg-secondary text-secondary-foreground shadow-xs"
            : "bg-muted/50 text-foreground ring-1 ring-border/60"
        } ${className ?? ""}`}
        style={{
          width: expanded ? undefined : `${cfg.cell}px`,
          ...style,
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => {
          setExpanded(false);
          setHoveredId(null);
        }}
        {...props}
      >
        {items.map((item, index) => {
          const active = activeId === item.id;
          const selected = selectedId === item.id;
          const visible = expanded || selected;

          return (
            <React.Fragment key={item.id}>
              {index > 0 && expanded && (
                <MultiButtonDivider activeId={activeId} variant={variant} />
              )}
              <MultiButtonItemButton
                item={item}
                active={active}
                accessible={expanded || selected}
                disabled={Boolean(item.disabled)}
                highlighted={Boolean(highlightColor) && active}
                highlightColor={highlightColor}
                size={size}
                variant={variant}
                width={expanded ? cfg.cell + 40 : cfg.cell}
                iconOffset={0}
                visible={visible}
                restIcon={restIcon && selected && !expanded ? restIcon : undefined}
                showRestIcon={selected && !expanded && Boolean(restIcon)}
                onHover={setHoveredId}
                onTouchAction={(e, id) => {
                  if (e.pointerType && e.pointerType !== "touch") return;
                  item.onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement>);
                }}
                onAction={() => setExpanded(false)}
              />
            </React.Fragment>
          );
        })}
      </div>
    );
  },
);
CompactMultiButton.displayName = "CompactMultiButton";

const MultiButtonGroup = React.forwardRef<
  HTMLDivElement,
  MultiButtonGroupProps
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="multi-button-group"
      className={`contents ${className ?? ""}`}
      {...props}
    >
      {children}
    </div>
  );
});
MultiButtonGroup.displayName = "MultiButtonGroup";

export { CompactMultiButton, MultiButton, MultiButtonGroup };
