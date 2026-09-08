"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  /** Alias kept for callers that want a per-action hover treatment. */
  hoverClassName?: string;
};

export type MultiButtonGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

type MultiButtonRootProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onClick"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
>;

type MultiButtonSharedProps = MultiButtonRootProps & {
  items: MultiButtonItem[];
  /** Optional active/selected item id to control active state (e.g. scroll sync or preset). */
  selectedId?: string;
  /** Optional items used to reserve the same expanded label width as another row. */
  syncWidthTo?: MultiButtonItem[];
  /** Optional CSS color or token reference used for a faint active-item tint. */
  highlightColor?: string;
  /** Use the more expressive SVG metaball treatment instead of the default pill morph. */
  gooey?: boolean;
  variant?: MultiButtonVariant;
  size?: MultiButtonSize;
  /** Optional fill width override in pixels. */
  fillWidth?: number;
  /** Enable 3D edge and shadow layers matching Input3D */
  enable3d?: boolean;
  /** Accent edge color for the 3D extrusion gradient (defaults to highlightColor) */
  edgeColor?: string;
  /** Theme state to tune shadow & inset contrast */
  isDark?: boolean;
  /** Apply authentic SVG inset inner-shadow directly on the fluid gooey blob */
  inset?: boolean;
  /** Custom base fill for the fluid gooey card */
  cardFill?: string;
};

export type MultiButtonProps = MultiButtonSharedProps;

export type CompactMultiButtonProps = MultiButtonSharedProps & {
  selectedId: string;
  /** Keep the compact control icon-only when it opens. */
  iconOnly?: boolean;
  /** Optional independent icon shown while the compact control is at rest. */
  restIcon?: MultiButtonItem["icon"];
  /** Accessible label for the optional rest trigger. Defaults to "Open actions". */
  restAriaLabel?: string;
};

type MultiButtonGroupContextValue = {
  register: (id: string, labelWidth: number) => void;
  unregister: (id: string) => void;
  sharedLabelWidth: number;
};

const MultiButtonGroupContext = React.createContext<
  MultiButtonGroupContextValue | undefined
>(undefined);

const SIZE_CONFIG: Record<
  MultiButtonSize,
  { cell: number; icon: string; minHeight: string; text: string }
> = {
  sm: { cell: 40, icon: "size-3.5", minHeight: "h-10", text: "text-xs" },
  md: { cell: 40, icon: "size-4", minHeight: "h-10", text: "text-sm" },
  lg: {
    cell: 40,
    icon: "size-[18px]",
    minHeight: "h-10",
    text: "text-sm",
  },
};

const VARIANT_CLASSES: Record<MultiButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20",
  outline:
    "bg-background text-foreground shadow-xs ring-1 ring-inset ring-border/80",
  secondary: "bg-secondary text-secondary-foreground shadow-xs",
  ghost: "bg-muted/50 text-foreground ring-1 ring-border/60",
};

const ITEM_HOVER_CLASSES: Record<MultiButtonVariant, string> = {
  default: "hover:bg-primary-foreground/10 active:bg-primary-foreground/20",
  outline: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
  secondary:
    "hover:bg-secondary-foreground/10 active:bg-secondary-foreground/20",
  ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
};

const DIVIDER_CLASSES: Record<MultiButtonVariant, string> = {
  default: "bg-primary-foreground/20",
  outline: "bg-border/70",
  secondary: "bg-secondary-foreground/15",
  ghost: "bg-border/70",
};

const GOOEY_BLOB_FILLS: Record<MultiButtonVariant, string> = {
  default: "var(--primary)",
  outline: "var(--background)",
  secondary: "var(--secondary)",
  ghost: "color-mix(in oklab, var(--muted) 50%, transparent)",
};

const GOOEY_TEXT_CLASSES: Record<MultiButtonVariant, string> = {
  default: "text-primary-foreground",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-foreground",
};

const LABEL_SPRING = {
  type: "spring",
  stiffness: 520,
  damping: 32,
} as const;

const CONTEXTUAL_ICON_TRANSITION = {
  type: "spring",
  duration: 0.3,
  bounce: 0,
} as const;

const COMPACT_EXPAND_DURATION_MS = 200;
const GOOEY_BOUNCE_DURATION_MS = 300;
const GOOEY_BOUNCE_TRANSITION = {
  duration: GOOEY_BOUNCE_DURATION_MS / 1000,
  ease: [0.3, 0.7, 0.4, 1.5],
} as const;
const GOOEY_CLOSE_TRANSITION = {
  duration: COMPACT_EXPAND_DURATION_MS / 1000,
  ease: [0.3, 0.7, 0.4, 1],
} as const;

const GOOEY_RAIL_TRANSITION_CLASSES = {
  expanded: "[transition:width_300ms_cubic-bezier(0.3,0.7,0.4,1.5)]",
  collapsed: "[transition:width_200ms_cubic-bezier(0.3,0.7,0.4,1)]",
} as const;

const GOOEY_ITEM_TRANSITION_CLASSES = {
  expanded:
    "[transition:width_300ms_cubic-bezier(0.3,0.7,0.4,1.5),background-color_150ms_ease,color_150ms_ease,scale_120ms_ease]",
  collapsed:
    "[transition:width_200ms_cubic-bezier(0.3,0.7,0.4,1),background-color_150ms_ease,color_150ms_ease,scale_120ms_ease]",
} as const;

const GOOEY_ICON_TRANSITION_CLASSES = {
  expanded: "[transition:transform_300ms_cubic-bezier(0.3,0.7,0.4,1.5)]",
  collapsed: "[transition:transform_200ms_cubic-bezier(0.3,0.7,0.4,1)]",
} as const;

const GOOEY_DIVIDER_TRANSITION_CLASSES = {
  expanded:
    "[transition:width_300ms_cubic-bezier(0.3,0.7,0.4,1.5),opacity_150ms_ease]",
  collapsed:
    "[transition:width_200ms_cubic-bezier(0.3,0.7,0.4,1),opacity_150ms_ease]",
} as const;

function gooeyPhase(expanded: boolean) {
  return expanded ? "expanded" : "collapsed";
}

function gooeyMotionTransition(reduceMotion: boolean, expanded: boolean) {
  if (reduceMotion) return { duration: 0 } as const;
  return expanded ? GOOEY_BOUNCE_TRANSITION : GOOEY_CLOSE_TRANSITION;
}

function railClassName({
  className,
  compact,
  expanded,
  gooey,
  minHeight,
  variant,
}: {
  className?: string;
  compact: boolean;
  expanded: boolean;
  gooey: boolean;
  minHeight: string;
  variant: MultiButtonVariant;
}) {
  const phase = gooeyPhase(expanded);
  const surface = gooey
    ? `overflow-visible ${GOOEY_TEXT_CLASSES[variant]}`
    : `overflow-hidden ${VARIANT_CLASSES[variant]}`;
  const widthTransition = compact
    ? gooey
      ? GOOEY_RAIL_TRANSITION_CLASSES[phase]
      : "[transition:width_200ms_ease-out]"
    : "";

  return `relative inline-flex items-stretch rounded-full ${minHeight} ${surface} ${widthTransition} motion-reduce:[transition:none] ${className ?? ""}`;
}

function useMultiButtonInteractions() {
  const reduceMotion = Boolean(useReducedMotion());
  const filterId = React.useId().replace(/:/g, "");
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [touchExpandedId, setTouchExpandedId] = React.useState<string | null>(
    null,
  );
  const containerRef = React.useRef<HTMLDivElement>(null);

  return {
    containerRef,
    filterId,
    hoveredId,
    reduceMotion,
    setHoveredId,
    setTouchExpandedId,
    touchExpandedId,
  };
}

function useOutsidePointerDown(
  active: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onOutside: () => void,
) {
  React.useEffect(() => {
    if (!active) return;
    // The rail may be portaled into a preview iframe, whose document is
    // different from the page document running this component.
    const ownerDocument = containerRef.current?.ownerDocument ?? document;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onOutside();
    };
    ownerDocument.addEventListener("pointerdown", handlePointerDown);
    return () =>
      ownerDocument.removeEventListener("pointerdown", handlePointerDown);
  }, [active, containerRef, onOutside]);
}

function labelText(label: React.ReactNode) {
  return typeof label === "string" || typeof label === "number"
    ? label.toString()
    : "";
}

function estimateLabelWidth(label: React.ReactNode, size: MultiButtonSize) {
  const textWidth = labelText(label).length * (size === "sm" ? 6.5 : 7.5);
  return Math.ceil(textWidth) + (size === "lg" ? 10 : size === "md" ? 8 : 6);
}

function maxLabelWidth(items: MultiButtonItem[], size: MultiButtonSize) {
  return items.reduce(
    (max, item) => Math.max(max, estimateLabelWidth(item.label, size)),
    0,
  );
}

function estimatedLabelWidths(items: MultiButtonItem[], size: MultiButtonSize) {
  return Object.fromEntries(
    items.map((item) => [item.id, estimateLabelWidth(item.label, size)]),
  );
}

function equalLabelWidths(
  current: Record<string, number>,
  next: Record<string, number>,
) {
  const currentIds = Object.keys(current);
  const nextIds = Object.keys(next);
  return (
    currentIds.length === nextIds.length &&
    nextIds.every((id) => current[id] === next[id])
  );
}

function measuredLabelWidth(
  element: HTMLElement | undefined,
  fallback: number,
) {
  if (!element) return fallback;
  const style = getComputedStyle(element);
  const marginLeft = Number.parseFloat(style.marginLeft) || 0;
  const marginRight = Number.parseFloat(style.marginRight) || 0;
  const measured = Math.ceil(
    element.getBoundingClientRect().width + marginLeft + marginRight,
  );
  return measured > 0 ? measured : fallback;
}

function itemAriaLabel(item: MultiButtonItem) {
  return item.ariaLabel ?? (labelText(item.label) || item.id);
}

function useLabelWidths(
  items: MultiButtonItem[],
  syncWidthTo: MultiButtonItem[] | undefined,
  size: MultiButtonSize,
) {
  const group = React.useContext(MultiButtonGroupContext);
  const instanceId = React.useId();
  const reserveItems = syncWidthTo ?? items;
  const itemEstimates = React.useMemo(
    () => estimatedLabelWidths(items, size),
    [items, size],
  );
  const estimatedReserveWidth = React.useMemo(
    () => maxLabelWidth(reserveItems, size),
    [reserveItems, size],
  );
  const [labelWidths, setLabelWidths] =
    React.useState<Record<string, number>>(itemEstimates);
  const [ownReservedWidth, setOwnReservedWidth] = React.useState(
    estimatedReserveWidth,
  );
  const measurementRef = React.useRef<HTMLDivElement>(null);
  const register = group?.register;
  const unregister = group?.unregister;

  const measureLabels = React.useCallback(() => {
    const itemLabels = measurementRef.current?.querySelectorAll<HTMLElement>(
      '[data-slot="multi-button-item-label-measure"]',
    );
    const nextLabelWidths = Object.fromEntries(
      items.map((item, index) => [
        item.id,
        measuredLabelWidth(itemLabels?.[index], itemEstimates[item.id] ?? 0),
      ]),
    );
    setLabelWidths((current) =>
      equalLabelWidths(current, nextLabelWidths) ? current : nextLabelWidths,
    );

    const reserveLabels = measurementRef.current?.querySelectorAll<HTMLElement>(
      '[data-slot="multi-button-reserve-label-measure"]',
    );
    const measuredReserveWidth = reserveItems.reduce(
      (largest, item, index) =>
        Math.max(
          largest,
          measuredLabelWidth(
            reserveLabels?.[index],
            estimateLabelWidth(item.label, size),
          ),
        ),
      0,
    );
    setOwnReservedWidth((current) =>
      current === measuredReserveWidth ? current : measuredReserveWidth,
    );
  }, [itemEstimates, items, reserveItems, size]);

  React.useLayoutEffect(() => {
    const measurementNode = measurementRef.current;
    if (!measurementNode) return;

    let active = true;
    const measure = () => {
      if (active) measureLabels();
    };
    measure();

    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    const labels = measurementNode.querySelectorAll<HTMLElement>(
      '[data-slot$="-label-measure"]',
    );
    labels.forEach((label) => {
      observer?.observe(label);
    });

    void document.fonts?.ready.then(measure);

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [measureLabels]);

  React.useLayoutEffect(() => {
    if (!register || !unregister) return;
    register(instanceId, ownReservedWidth);
    return () => unregister(instanceId);
  }, [instanceId, ownReservedWidth, register, unregister]);

  return {
    labelWidths,
    reservedLabelWidth: group
      ? Math.max(group.sharedLabelWidth, ownReservedWidth)
      : ownReservedWidth,
    measurementRef,
    reserveItems,
  };
}

function MultiButtonLabelMeasurement({
  items,
  reserveItems,
  measurementRef,
  size,
}: {
  items: MultiButtonItem[];
  reserveItems: MultiButtonItem[];
  measurementRef: React.RefObject<HTMLDivElement | null>;
  size: MultiButtonSize;
}) {
  return (
    <div
      ref={measurementRef}
      aria-hidden="true"
      className="pointer-events-none invisible absolute top-0 left-0 flex h-0 w-0 overflow-hidden"
    >
      {items.map((item) => (
        <span
          key={`item-${item.id}`}
          data-slot="multi-button-item-label-measure"
          className={`-ml-1 shrink-0 whitespace-nowrap pr-2 font-medium leading-none ${SIZE_CONFIG[size].text}`}
        >
          {item.label}
        </span>
      ))}
      {reserveItems.map((item) => (
        <span
          key={`reserve-${item.id}`}
          data-slot="multi-button-reserve-label-measure"
          className={`-ml-1 shrink-0 whitespace-nowrap pr-2 font-medium leading-none ${SIZE_CONFIG[size].text}`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

function actionWidth(
  item: MultiButtonItem,
  activeId: string | null,
  itemCount: number,
  cellWidth: number,
  labelWidths: Record<string, number>,
  reservedLabelWidth: number,
) {
  if (activeId === null) {
    return itemCount > 0
      ? cellWidth + reservedLabelWidth / itemCount
      : cellWidth;
  }

  const activeLabelWidth = labelWidths[activeId] ?? reservedLabelWidth;
  if (item.id === activeId) return cellWidth + activeLabelWidth;

  const remainingLabelSpace = Math.max(
    0,
    reservedLabelWidth - activeLabelWidth,
  );
  return itemCount > 1
    ? cellWidth + remainingLabelSpace / (itemCount - 1)
    : cellWidth;
}

type MultiButtonBlobGeometry = {
  item: MultiButtonItem;
  width: number;
  x: number;
};

function useMultiButtonLayout({
  activeId,
  items,
  reserveLabelSpace = true,
  size,
  syncWidthTo,
}: {
  activeId: string | null;
  items: MultiButtonItem[];
  reserveLabelSpace?: boolean;
  size: MultiButtonSize;
  syncWidthTo?: MultiButtonItem[];
}) {
  const cfg = SIZE_CONFIG[size];
  const { labelWidths, reservedLabelWidth, measurementRef, reserveItems } =
    useLabelWidths(items, syncWidthTo, size);
  const effectiveLabelWidth = reserveLabelSpace ? reservedLabelWidth : 0;
  const dividerWidth = Math.max(0, items.length - 1);
  const expandedWidth =
    items.length > 0
      ? items.length * cfg.cell + effectiveLabelWidth + dividerWidth
      : cfg.cell;
  const itemWidths = items.map((item) =>
    actionWidth(
      item,
      activeId,
      items.length,
      cfg.cell,
      labelWidths,
      effectiveLabelWidth,
    ),
  );
  const blobGeometries = React.useMemo(() => {
    return items.reduce<MultiButtonBlobGeometry[]>((acc, item, index) => {
      const width = itemWidths[index] ?? cfg.cell;
      const prev = acc[index - 1];
      const x = prev ? prev.x + prev.width + 1 : 0;
      acc.push({ item, width, x });
      return acc;
    }, []);
  }, [items, itemWidths, cfg.cell]);

  return {
    blobGeometries,
    cfg,
    expandedWidth,
    itemWidths,
    measurementRef,
    reserveItems,
  };
}

function MultiButtonBlobLayer({
  activeId,
  cellWidth,
  expanded,
  filterId,
  geometries,
  highlightColor,
  reduceMotion,
  selectedId,
  variant,
  enable3d = false,
  edgeColor,
  isDark = false,
  inset = false,
  cardFill,
}: {
  activeId: string | null;
  cellWidth: number;
  expanded: boolean;
  filterId: string;
  geometries: MultiButtonBlobGeometry[];
  highlightColor?: string;
  reduceMotion: boolean;
  selectedId: string | undefined;
  variant: MultiButtonVariant;
  enable3d?: boolean;
  edgeColor?: string;
  isDark?: boolean;
  inset?: boolean;
  cardFill?: string;
}) {
  const baseFill = cardFill ?? GOOEY_BLOB_FILLS[variant];
  const actualEdgeColor =
    edgeColor ?? highlightColor ?? (isDark ? "#9CB386" : "#5A5A40");

  const renderBlobRects = (overrideFill?: string) =>
    geometries.map(({ item, width, x }) => {
      const selected = item.id === selectedId;
      const active = item.id === activeId;
      const fill =
        overrideFill ??
        (cardFill
          ? active && highlightColor
            ? `color-mix(in oklch, ${cardFill} 86%, ${highlightColor})`
            : cardFill
          : active && highlightColor
            ? `color-mix(in oklch, ${baseFill} 86%, ${highlightColor})`
            : baseFill);

      return (
        <motion.rect
          key={item.id}
          x={0}
          y={0}
          height={cellWidth}
          rx={cellWidth / 2}
          fill={fill}
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
          }}
          initial={false}
          animate={
            expanded
              ? { x, width, scale: 1, opacity: 1 }
              : selected
                ? { x: 0, width: cellWidth, scale: 1, opacity: 1 }
                : {
                    x: 0,
                    width: cellWidth,
                    scale: 0.2,
                    opacity: 0,
                  }
          }
          transition={gooeyMotionTransition(reduceMotion, expanded)}
        />
      );
    });

  return (
    <svg
      data-slot="multi-button-blob"
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 left-0 z-base ${
        enable3d ? "" : "drop-shadow-sm"
      }`}
      style={{ overflow: "visible" }}
      width="100%"
      height={cellWidth}
    >
      <defs>
        {enable3d && (
          <>
            {/* SHADOW LAYER GRADIENT — matching Select3D inset shadow */}
            <linearGradient
              id={`${filterId}-shadow-grad`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop
                offset="0%"
                stopColor="#000000"
                stopOpacity={isDark ? "0.35" : "0.15"}
              />
              <stop
                offset="100%"
                stopColor="#000000"
                stopOpacity={isDark ? "0.18" : "0.08"}
              />
            </linearGradient>

            {/* SHADOW LAYER FILTER — matching Select3D blur(4px) inner shadow */}
            <filter
              id={`${filterId}-shadow`}
              x="-100%"
              y="-400%"
              width="300%"
              height="900%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
                result="metaballs"
              />
              <feGaussianBlur in="metaballs" stdDeviation="4" />
            </filter>

            {/* EDGE LAYER GRADIENT — matching Select3D inset edge formula */}
            <linearGradient
              id={`${filterId}-edge-grad`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={actualEdgeColor} stopOpacity="0.533" />
              <stop offset="50%" stopColor={actualEdgeColor} stopOpacity="0.333" />
              <stop offset="100%" stopColor={actualEdgeColor} stopOpacity="0.467" />
            </linearGradient>

            {/* EDGE LAYER METABALL FILTER */}
            <filter
              id={`${filterId}-edge`}
              x="-100%"
              y="-400%"
              width="300%"
              height="900%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
              />
            </filter>
          </>
        )}

        {/* FRONT FACE FILTER with authentic SVG INSET inner-shadow and 1px border matching Select3D */}
        <filter
          id={filterId}
          x="-100%"
          y="-400%"
          width="300%"
          height="900%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
            result="gooeyBlob"
          />
          {inset ? (
            <>
              {/* Extract Alpha of fluid blob */}
              <feColorMatrix
                in="gooeyBlob"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                result="blobAlpha"
              />

              {/* 1px Inset Border matching Select3D border-[#2C3328] / border-[#E5E2D9] */}
              <feMorphology in="blobAlpha" operator="erode" radius="1" result="erodedAlpha" />
              <feComposite in="blobAlpha" in2="erodedAlpha" operator="out" result="strokeMask" />
              <feFlood
                floodColor={isDark ? "#2C3328" : "#E5E2D9"}
                floodOpacity="0.95"
                result="strokeFlood"
              />
              <feComposite in="strokeFlood" in2="strokeMask" operator="in" result="strokeLayer" />

              {/* Inset Shadow (carved top rim) */}
              <feOffset in="blobAlpha" dx="0" dy="1.6" result="offsetAlphaDown" />
              <feComposite in="blobAlpha" in2="offsetAlphaDown" operator="out" result="topInnerRim" />
              <feGaussianBlur in="topInnerRim" stdDeviation="1.3" result="blurredTopRim" />
              <feFlood
                floodColor="#000000"
                floodOpacity={isDark ? "0.65" : "0.3"}
                result="shadowColor"
              />
              <feComposite in="shadowColor" in2="blurredTopRim" operator="in" result="innerShadow" />
              <feComposite in="innerShadow" in2="blobAlpha" operator="in" result="clippedInnerShadow" />

              {/* Inset Highlight (crisp bottom edge reflection) */}
              <feOffset in="blobAlpha" dx="0" dy="-1.0" result="offsetAlphaUp" />
              <feComposite in="blobAlpha" in2="offsetAlphaUp" operator="out" result="bottomInnerRim" />
              <feGaussianBlur in="bottomInnerRim" stdDeviation="0.8" result="blurredBottomRim" />
              <feFlood
                floodColor="#ffffff"
                floodOpacity={isDark ? "0.15" : "0.4"}
                result="highlightColor"
              />
              <feComposite in="highlightColor" in2="blurredBottomRim" operator="in" result="innerHighlight" />
              <feComposite in="innerHighlight" in2="blobAlpha" operator="in" result="clippedInnerHighlight" />

              {/* Composite all together into fluid gooey card */}
              <feMerge>
                <feMergeNode in="gooeyBlob" />
                <feMergeNode in="clippedInnerShadow" />
                <feMergeNode in="clippedInnerHighlight" />
                <feMergeNode in="strokeLayer" />
              </feMerge>
            </>
          ) : null}
        </filter>
      </defs>

      {enable3d && (
        <>
          {/* SHADOW LAYER — inset: inner shadow at top (-1px, blur 4px) */}
          <g
            transform="translate(0, -1)"
            filter={reduceMotion ? undefined : `url(#${filterId}-shadow)`}
          >
            {renderBlobRects(`url(#${filterId}-shadow-grad)`)}
          </g>

          {/* EDGE LAYER — inset: subtle top edge (-0.5px, accent gradient) */}
          <g
            transform="translate(0, -0.5)"
            filter={reduceMotion ? undefined : `url(#${filterId}-edge)`}
          >
            {renderBlobRects(`url(#${filterId}-edge-grad)`)}
          </g>
        </>
      )}

      {/* FRONT FACE LAYER — pressed into surface (+0.5px) */}
      <g
        transform={enable3d ? "translate(0, 0.5)" : undefined}
        filter={reduceMotion ? undefined : `url(#${filterId})`}
      >
        {renderBlobRects()}
      </g>
    </svg>
  );
}

function labelMotion(reduceMotion: boolean) {
  return {
    initial: reduceMotion
      ? false
      : { opacity: 0, scale: 0.25, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: reduceMotion
      ? undefined
      : { opacity: 0, scale: 0.25, filter: "blur(4px)" },
    transition: reduceMotion
      ? { duration: 0 }
      : {
          opacity: LABEL_SPRING,
          scale: LABEL_SPRING,
          filter: { duration: 0.15, ease: "easeOut" },
        },
  } as const;
}

type MultiButtonLabelProps = {
  item: MultiButtonItem;
  reduceMotion: boolean;
  textClass: string;
  highlightColor?: string;
  active?: boolean;
};

const MultiButtonLabel = React.forwardRef<
  HTMLSpanElement,
  MultiButtonLabelProps
>(({ item, reduceMotion, textClass, highlightColor, active }, ref) => (
  <motion.span
    ref={ref}
    {...labelMotion(reduceMotion)}
    style={{
      color: active && highlightColor ? highlightColor : undefined,
    }}
    className={`relative z-raised -ml-1 shrink-0 whitespace-nowrap pr-2 font-semibold leading-none transition-all duration-200 ${
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
  disclosureExpanded?: boolean;
  disabled: boolean;
  highlighted: boolean;
  highlightColor?: string;
  gooey?: boolean;
  gooeyExpanded?: boolean;
  transparent?: boolean;
  size: MultiButtonSize;
  variant: MultiButtonVariant;
  width: number;
  iconOffset: number;
  reduceMotion: boolean;
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

type MultiButtonItemIconProps = {
  actionIcon: MultiButtonItem["icon"];
  active?: boolean;
  highlightColor?: string;
  gooey: boolean;
  gooeyExpanded: boolean;
  iconClassName: string;
  iconOffset: number;
  laneWidth: number;
  reduceMotion: boolean;
  restIcon?: MultiButtonItem["icon"];
  showRestIcon: boolean;
};

function MultiButtonItemIcon({
  actionIcon: ActionIcon,
  active,
  highlightColor,
  gooey,
  gooeyExpanded,
  iconClassName,
  iconOffset,
  laneWidth,
  reduceMotion,
  restIcon: RestIcon,
  showRestIcon,
}: MultiButtonItemIconProps) {
  const phase = gooeyPhase(gooeyExpanded);
  const iconTransition = reduceMotion
    ? ({ duration: 0 } as const)
    : CONTEXTUAL_ICON_TRANSITION;
  const visibleState = { opacity: 1, scale: active ? 1.15 : 1, filter: "blur(0px)" };
  const hiddenState = { opacity: 0, scale: 0.25, filter: "blur(4px)" };

  return (
    <span
      data-slot="multi-button-icon"
      className={`relative z-raised flex h-full shrink-0 items-center justify-center motion-reduce:[transition:none] transition-all duration-200 ${
        active ? "scale-110" : "scale-100"
      } ${gooey ? GOOEY_ICON_TRANSITION_CLASSES[phase] : "[transition:transform_200ms_ease-out]"}`}
      style={{
        width: `${laneWidth}px`,
        transform: `translateX(${iconOffset}px)${active ? " scale(1.15)" : ""}`,
        color: active && highlightColor ? highlightColor : undefined,
      }}
      aria-hidden="true"
    >
      {RestIcon ? (
        <>
          <motion.span
            data-slot="multi-button-action-icon"
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={showRestIcon ? hiddenState : visibleState}
            transition={iconTransition}
          >
            <ActionIcon className={iconClassName} />
          </motion.span>
          <motion.span
            data-slot="multi-button-rest-icon"
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={showRestIcon ? visibleState : hiddenState}
            transition={iconTransition}
          >
            <RestIcon className={iconClassName} />
          </motion.span>
        </>
      ) : (
        <ActionIcon className={iconClassName} />
      )}
    </span>
  );
}

function MultiButtonItemButton({
  item,
  active,
  accessible = true,
  ariaLabel,
  disclosureExpanded,
  disabled,
  highlighted,
  highlightColor,
  gooey = false,
  gooeyExpanded = true,
  transparent = false,
  size,
  variant,
  width,
  iconOffset,
  reduceMotion,
  restIcon,
  showRestIcon = false,
  visible = true,
  onTouchAction,
  onHover,
  onAction,
}: MultiButtonItemButtonProps) {
  const cfg = SIZE_CONFIG[size];
  const phase = gooeyPhase(gooeyExpanded);

  return (
    <motion.button
      type="button"
      data-state={active ? "open" : "closed"}
      data-multi-button-item-id={item.id}
      aria-label={ariaLabel ?? itemAriaLabel(item)}
      aria-expanded={disclosureExpanded}
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
      animate={
        gooey
          ? {
              opacity: visible ? 1 : 0,
              scale: visible ? 1 : 0.4,
            }
          : undefined
      }
      transition={
        gooey ? gooeyMotionTransition(reduceMotion, gooeyExpanded) : undefined
      }
      style={{ width: `${width}px` }}
      className={`relative isolate flex shrink-0 cursor-pointer items-center justify-start overflow-hidden ${cfg.minHeight} focus:outline-none focus-visible:z-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:[transition:none] ${accessible ? "" : "pointer-events-none"} ${gooey ? GOOEY_ITEM_TRANSITION_CLASSES[phase] : "[transition:width_200ms_ease-out,background-color_150ms_ease,color_150ms_ease,scale_120ms_ease]"} ${reduceMotion ? "" : "active:scale-[0.96]"} ${transparent ? "" : ITEM_HOVER_CLASSES[variant]} ${item.hoverClassName ?? ""} ${item.className ?? ""}`}
    >
      <span
        data-slot="multi-button-highlight"
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-base bg-[var(--multi-button-highlight)] [transition:opacity_150ms_ease] motion-reduce:[transition:none] ${highlighted ? "opacity-[0.14]" : "opacity-0"}`}
      />
      <MultiButtonItemIcon
        actionIcon={item.icon}
        active={active}
        highlightColor={highlightColor}
        gooey={gooey}
        gooeyExpanded={gooeyExpanded}
        iconClassName={cfg.icon}
        iconOffset={iconOffset}
        laneWidth={cfg.cell}
        reduceMotion={reduceMotion}
        restIcon={restIcon}
        showRestIcon={showRestIcon}
      />
      <AnimatePresence initial={false} mode="popLayout">
        {active && (
          <MultiButtonLabel
            key={item.id}
            item={item}
            active={active}
            highlightColor={highlightColor}
            reduceMotion={reduceMotion}
            textClass={cfg.text}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function MultiButtonDivider({
  activeId,
  compact,
  expanded,
  gooey,
  variant,
}: {
  activeId: string | null;
  compact: boolean;
  expanded: boolean;
  gooey: boolean;
  variant: MultiButtonVariant;
}) {
  if (!compact) {
    return (
      <span
        aria-hidden="true"
        className={`my-2 w-px shrink-0 transition-opacity duration-150 motion-reduce:[transition:none] ${DIVIDER_CLASSES[variant]} ${activeId ? "opacity-0" : "opacity-100"}`}
      />
    );
  }

  const phase = gooeyPhase(expanded);

  return (
    <span
      aria-hidden="true"
      style={{
        width: `${expanded ? 1 : 0}px`,
        opacity: expanded && activeId === null ? 1 : 0,
      }}
      className={`my-2 shrink-0 motion-reduce:[transition:none] ${gooey ? GOOEY_DIVIDER_TRANSITION_CLASSES[phase] : "[transition:width_200ms_ease-out,opacity_200ms_ease-out]"} ${DIVIDER_CLASSES[variant]}`}
    />
  );
}

type MultiButtonItemsProps = {
  activeId: string | null;
  compact: boolean;
  expanded: boolean;
  gooey: boolean;
  highlightColor?: string;
  itemWidths: number[];
  interactionReady: boolean;
  items: MultiButtonItem[];
  onAction?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onHover: (id: string | null) => void;
  onTouchAction: (
    event: React.PointerEvent<HTMLButtonElement>,
    id: string,
  ) => void;
  reduceMotion: boolean;
  restAriaLabel?: string;
  restIcon?: MultiButtonItem["icon"];
  selectedId?: string;
  size: MultiButtonSize;
  variant: MultiButtonVariant;
};

function MultiButtonItems({
  activeId,
  compact,
  expanded,
  gooey,
  highlightColor,
  itemWidths,
  interactionReady,
  items,
  onAction,
  onHover,
  onTouchAction,
  reduceMotion,
  restAriaLabel,
  restIcon,
  selectedId,
  size,
  variant,
}: MultiButtonItemsProps) {
  const cfg = SIZE_CONFIG[size];

  return items.map((item, index) => {
    const active = activeId === item.id;
    const selected = selectedId === item.id;
    const collapsedSelectedTrigger = compact && selected && !expanded;
    const width =
      compact && !expanded
        ? selected
          ? cfg.cell
          : 0
        : (itemWidths[index] ?? cfg.cell);
    const iconOffset =
      compact && !expanded
        ? 0
        : active
          ? 0
          : Math.max(0, (width - cfg.cell) / 2);

    return (
      <React.Fragment key={item.id}>
        {index > 0 && (
          <MultiButtonDivider
            activeId={activeId}
            compact={compact}
            expanded={expanded}
            gooey={gooey}
            variant={variant}
          />
        )}
        <MultiButtonItemButton
          item={item}
          active={active}
          accessible={!compact || interactionReady || selected}
          ariaLabel={
            collapsedSelectedTrigger
              ? (restAriaLabel ?? (restIcon ? "Open actions" : undefined))
              : undefined
          }
          disclosureExpanded={compact && selected ? expanded : undefined}
          disabled={Boolean(item.disabled && !collapsedSelectedTrigger)}
          highlighted={!gooey && Boolean(highlightColor) && active}
          highlightColor={highlightColor}
          gooey={gooey}
          gooeyExpanded={expanded}
          transparent={gooey}
          size={size}
          variant={variant}
          width={width}
          iconOffset={iconOffset}
          reduceMotion={reduceMotion}
          restIcon={compact && selected ? restIcon : undefined}
          showRestIcon={compact && selected && Boolean(restIcon) && !expanded}
          visible={!compact || expanded || selected}
          onTouchAction={onTouchAction}
          onHover={onHover}
          onAction={onAction}
        />
      </React.Fragment>
    );
  });
}

type MultiButtonRailContentProps = MultiButtonItemsProps & {
  blobGeometries: MultiButtonBlobGeometry[];
  cellWidth: number;
  expandedWidth: number;
  filterId: string;
  measurementRef: React.RefObject<HTMLDivElement | null>;
  reserveItems: MultiButtonItem[];
  enable3d?: boolean;
  edgeColor?: string;
  isDark?: boolean;
  inset?: boolean;
  cardFill?: string;
};

function MultiButtonRailContent({
  activeId,
  blobGeometries,
  cellWidth,
  compact,
  expanded,
  filterId,
  gooey,
  highlightColor,
  itemWidths,
  interactionReady,
  items,
  measurementRef,
  onAction,
  onHover,
  onTouchAction,
  reduceMotion,
  restAriaLabel,
  restIcon,
  reserveItems,
  selectedId,
  size,
  variant,
  enable3d,
  edgeColor,
  isDark,
  inset,
  cardFill,
}: MultiButtonRailContentProps) {
  return (
    <>
      {gooey && (
        <MultiButtonBlobLayer
          activeId={activeId}
          cellWidth={cellWidth}
          expanded={expanded}
          filterId={filterId}
          geometries={blobGeometries}
          highlightColor={highlightColor}
          reduceMotion={reduceMotion}
          selectedId={selectedId}
          variant={variant}
          enable3d={enable3d}
          edgeColor={edgeColor}
          isDark={isDark}
          inset={inset}
          cardFill={cardFill}
        />
      )}
      <MultiButtonLabelMeasurement
        items={items}
        reserveItems={reserveItems}
        measurementRef={measurementRef}
        size={size}
      />
      <MultiButtonItems
        activeId={activeId}
        compact={compact}
        expanded={expanded}
        gooey={gooey}
        highlightColor={highlightColor}
        itemWidths={itemWidths}
        interactionReady={interactionReady}
        items={items}
        onAction={onAction}
        onHover={onHover}
        onTouchAction={onTouchAction}
        reduceMotion={reduceMotion}
        restAriaLabel={restAriaLabel}
        restIcon={restIcon}
        selectedId={selectedId}
        size={size}
        variant={variant}
      />
    </>
  );
}

type MultiButtonRailProps = MultiButtonRailContentProps & {
  className?: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  containerWidth: number;
  forwardedRef: React.ForwardedRef<HTMLDivElement>;
  rootProps: MultiButtonRootProps;
  slot: "multi-button" | "compact-multi-button";
  style?: React.CSSProperties;
};

function MultiButtonRail({
  className,
  compact,
  containerRef,
  containerWidth,
  expanded,
  forwardedRef,
  gooey,
  highlightColor,
  rootProps,
  size,
  slot,
  style,
  variant,
  ...contentProps
}: MultiButtonRailProps) {
  const cfg = SIZE_CONFIG[size];

  React.useImperativeHandle(forwardedRef, () => containerRef.current as HTMLDivElement);

  return (
    <motion.div
      ref={containerRef}
      data-slot={slot}
      role="group"
      style={
        {
          ...style,
          width: `${containerWidth}px`,
          "--multi-button-highlight": highlightColor,
        } as React.CSSProperties
      }
      className={railClassName({
        className,
        compact,
        expanded,
        gooey,
        minHeight: cfg.minHeight,
        variant,
      })}
      {...rootProps}
    >
      <MultiButtonRailContent
        {...contentProps}
        compact={compact}
        expanded={expanded}
        gooey={gooey}
        highlightColor={highlightColor}
        size={size}
        variant={variant}
      />
    </motion.div>
  );
}

const MultiButtonGroup = React.forwardRef<
  HTMLDivElement,
  MultiButtonGroupProps
>(({ children, className, ...props }, ref) => {
  const [registry, setRegistry] = React.useState<Record<string, number>>({});

  const register = React.useCallback((id: string, width: number) => {
    setRegistry((current) =>
      current[id] === width ? current : { ...current, [id]: width },
    );
  }, []);

  const unregister = React.useCallback((id: string) => {
    setRegistry((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const sharedLabelWidth = Math.max(0, ...Object.values(registry));
  const context = React.useMemo(
    () => ({ register, unregister, sharedLabelWidth }),
    [register, unregister, sharedLabelWidth],
  );

  return (
    <MultiButtonGroupContext.Provider value={context}>
      <div
        ref={ref}
        data-slot="multi-button-group"
        className={`contents ${className ?? ""}`}
        {...props}
      >
        {children}
      </div>
    </MultiButtonGroupContext.Provider>
  );
});
MultiButtonGroup.displayName = "MultiButtonGroup";

const MultiButton = React.forwardRef<HTMLDivElement, MultiButtonProps>(
  (
    {
      items,
      selectedId,
      syncWidthTo,
      highlightColor,
      gooey = false,
      variant = "default",
      size = "md",
      fillWidth,
      enable3d,
      edgeColor,
      isDark,
      inset,
      cardFill,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const {
      containerRef,
      filterId,
      hoveredId,
      reduceMotion,
      setHoveredId,
      setTouchExpandedId,
      touchExpandedId,
    } = useMultiButtonInteractions();
    const activeId = hoveredId ?? touchExpandedId ?? selectedId ?? null;
    const {
      blobGeometries,
      cfg,
      expandedWidth,
      itemWidths,
      measurementRef,
      reserveItems,
    } = useMultiButtonLayout({ activeId, items, size, syncWidthTo });

    const collapseTouchAction = React.useCallback(
      () => setTouchExpandedId(null),
      [setTouchExpandedId],
    );
    useOutsidePointerDown(
      Boolean(touchExpandedId),
      containerRef,
      collapseTouchAction,
    );

    const onTouchAction = (
      event: React.PointerEvent<HTMLButtonElement>,
      id: string,
    ) => {
      if (event.pointerType !== "touch") return;
      if (touchExpandedId !== id) {
        setTouchExpandedId(id);
      }
    };

    const finalWidth = fillWidth && fillWidth > 0 ? fillWidth : expandedWidth;

    return (
      <MultiButtonRail
        activeId={activeId}
        selectedId={selectedId}
        blobGeometries={blobGeometries}
        cellWidth={cfg.cell}
        className={className}
        compact={false}
        containerRef={containerRef}
        containerWidth={finalWidth}
        expanded
        expandedWidth={expandedWidth}
        filterId={filterId}
        forwardedRef={ref}
        gooey={gooey}
        highlightColor={highlightColor}
        itemWidths={itemWidths}
        interactionReady
        items={items}
        measurementRef={measurementRef}
        onHover={setHoveredId}
        onTouchAction={onTouchAction}
        reduceMotion={reduceMotion}
        reserveItems={reserveItems}
        rootProps={props}
        size={size}
        slot="multi-button"
        style={style}
        variant={variant}
        enable3d={enable3d}
        edgeColor={edgeColor}
        isDark={isDark}
        inset={inset}
        cardFill={cardFill}
      />
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
      syncWidthTo,
      highlightColor,
      gooey = false,
      variant = "default",
      size = "md",
      fillWidth,
      enable3d,
      edgeColor,
      isDark,
      inset,
      cardFill,
      className,
      style,
      onMouseEnter: onMouseEnterProp,
      onMouseLeave: onMouseLeaveProp,
      onFocusCapture: onFocusCaptureProp,
      onBlurCapture: onBlurCaptureProp,
      onTransitionEnd: onTransitionEndProp,
      ...rootProps
    },
    ref,
  ) => {
    const {
      containerRef,
      filterId,
      hoveredId,
      reduceMotion,
      setHoveredId,
      setTouchExpandedId,
      touchExpandedId,
    } = useMultiButtonInteractions();
    const [mouseExpanded, setMouseExpanded] = React.useState(false);
    const [touchExpanded, setTouchExpanded] = React.useState(false);
    const [focusExpanded, setFocusExpanded] = React.useState(false);
    const [compactRailReady, setCompactRailReady] = React.useState(false);
    const focusRestoreFrameRef = React.useRef<number | null>(null);
    const suppressFocusExpansionRef = React.useRef(false);
    const selectedItem =
      items.find((item) => item.id === selectedId) ?? items[0];
    const isExpanded = mouseExpanded || touchExpanded || focusExpanded;
    const activeId =
      iconOnly || !isExpanded || !compactRailReady
        ? null
        : (hoveredId ?? touchExpandedId);
    const {
      blobGeometries,
      cfg,
      expandedWidth,
      itemWidths,
      measurementRef,
      reserveItems,
    } = useMultiButtonLayout({
      activeId,
      items,
      reserveLabelSpace: !iconOnly,
      size,
      syncWidthTo,
    });
    const containerWidth = isExpanded ? expandedWidth : cfg.cell;
    const expansionStateRef = React.useRef({
      expanded: isExpanded,
      expandedWidth,
    });

    React.useEffect(() => {
      expansionStateRef.current = { expanded: isExpanded, expandedWidth };
      const raf = requestAnimationFrame(() => {
        if (!isExpanded) {
          setCompactRailReady(false);
        } else if (reduceMotion) {
          setCompactRailReady(true);
        } else {
          setCompactRailReady(expandedWidth === cfg.cell);
        }
      });
      return () => cancelAnimationFrame(raf);
    }, [cfg.cell, expandedWidth, isExpanded, reduceMotion]);

    React.useEffect(
      () => () => {
        if (focusRestoreFrameRef.current !== null) {
          cancelAnimationFrame(focusRestoreFrameRef.current);
        }
      },
      [],
    );

    const handleRailTransitionEnd = React.useCallback(
      (event: React.TransitionEvent<HTMLDivElement>) => {
        if (
          event.target !== event.currentTarget ||
          (event.propertyName && event.propertyName !== "width") ||
          reduceMotion
        ) {
          return;
        }

        const expected = expansionStateRef.current;
        const inlineWidth = Number.parseFloat(event.currentTarget.style.width);
        const renderedWidth = event.currentTarget.getBoundingClientRect().width;
        if (
          !expected.expanded ||
          Math.abs(inlineWidth - expected.expandedWidth) > 0.5 ||
          (renderedWidth > 0 &&
            Math.abs(renderedWidth - expected.expandedWidth) > 1)
        ) {
          return;
        }

        setCompactRailReady(true);
      },
      [reduceMotion],
    );

    const collapseTouchAction = React.useCallback(() => {
      setTouchExpanded(false);
      setTouchExpandedId(null);
    }, [setTouchExpandedId]);
    useOutsidePointerDown(touchExpanded, containerRef, collapseTouchAction);

    const onTouchAction = (
      event: React.PointerEvent<HTMLButtonElement>,
      id: string,
    ) => {
      if (event.pointerType && event.pointerType !== "touch") return;
      if (!touchExpanded) {
        event.preventDefault();
        setTouchExpanded(true);
        setTouchExpandedId(id);
      } else {
        setTouchExpandedId(id);
      }
    };

    const collapseAfterAction = (
      event: React.MouseEvent<HTMLButtonElement>,
    ) => {
      if (event.currentTarget.dataset.multiButtonItemId !== selectedItem?.id) {
        const selectedButton = Array.from(
          containerRef.current?.querySelectorAll<HTMLButtonElement>(
            "button[data-multi-button-item-id]",
          ) ?? [],
        ).find(
          (button) => button.dataset.multiButtonItemId === selectedItem?.id,
        );
        selectedButton?.focus({ preventScroll: true });

        if (focusRestoreFrameRef.current !== null) {
          cancelAnimationFrame(focusRestoreFrameRef.current);
        }
        focusRestoreFrameRef.current = requestAnimationFrame(() => {
          focusRestoreFrameRef.current = null;
          const visibleButton = Array.from(
            containerRef.current?.querySelectorAll<HTMLButtonElement>(
              "button[data-multi-button-item-id]",
            ) ?? [],
          ).find((button) => !button.hasAttribute("aria-hidden"));

          if (visibleButton && document.activeElement !== visibleButton) {
            suppressFocusExpansionRef.current = true;
            visibleButton.focus({ preventScroll: true });
          }
        });
      }

      setMouseExpanded(false);
      setTouchExpanded(false);
      setFocusExpanded(false);
      setCompactRailReady(false);
      setHoveredId(null);
      setTouchExpandedId(null);
    };

    return (
      <MultiButtonRail
        activeId={activeId}
        blobGeometries={blobGeometries}
        cellWidth={cfg.cell}
        className={className}
        compact
        containerRef={containerRef}
        containerWidth={containerWidth}
        expanded={isExpanded}
        expandedWidth={expandedWidth}
        filterId={filterId}
        forwardedRef={ref}
        gooey={gooey}
        highlightColor={highlightColor}
        itemWidths={itemWidths}
        interactionReady={compactRailReady}
        items={items}
        measurementRef={measurementRef}
        onAction={collapseAfterAction}
        onHover={setHoveredId}
        onTouchAction={onTouchAction}
        reduceMotion={reduceMotion}
        restAriaLabel={restAriaLabel}
        restIcon={restIcon}
        reserveItems={reserveItems}
        rootProps={{
          ...rootProps,
          onMouseEnter: (event) => {
            setMouseExpanded(true);
            onMouseEnterProp?.(event);
          },
          onMouseLeave: (event) => {
            setMouseExpanded(false);
            setHoveredId(null);
            onMouseLeaveProp?.(event);
          },
          onFocusCapture: (event) => {
            if (suppressFocusExpansionRef.current) {
              suppressFocusExpansionRef.current = false;
            } else {
              setFocusExpanded(true);
            }
            onFocusCaptureProp?.(event);
          },
          onBlurCapture: (event) => {
            if (
              !event.relatedTarget ||
              !event.currentTarget.contains(event.relatedTarget as Node)
            ) {
              setFocusExpanded(false);
              setHoveredId(null);
            }
            onBlurCaptureProp?.(event);
          },
          onTransitionEnd: (event) => {
            handleRailTransitionEnd(event);
            onTransitionEndProp?.(event);
          },
        }}
        selectedId={selectedItem?.id}
        size={size}
        slot="compact-multi-button"
        style={style}
        variant={variant}
        enable3d={enable3d}
        edgeColor={edgeColor}
        isDark={isDark}
        inset={inset}
        cardFill={cardFill}
      />
    );
  },
);
CompactMultiButton.displayName = "CompactMultiButton";

export { CompactMultiButton, MultiButton, MultiButtonGroup };
