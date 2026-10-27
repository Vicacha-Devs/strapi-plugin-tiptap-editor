import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Flex, Popover } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import styled from 'styled-components';
import { Spacer } from './Spacer';

const MORE_BUTTON_WIDTH = 76;
const ITEM_GAP = 4;

const StyledPopoverContent = styled(Popover.Content)`
  /* Above CM header (100), left menu (200) and fullscreen editor (250); below DS overlays (300) */
  z-index: 260 !important;
  max-width: min(560px, 92vw);
`;

const MeasureContainer = styled.div`
  position: absolute;
  visibility: hidden;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: ${ITEM_GAP}px;
  white-space: nowrap;
`;

export interface ToolbarItem {
  id: string;
  content: React.ReactNode;
  /** Lightweight measurement node rendered in MeasureContainer instead of content */
  measureContent?: React.ReactNode;
  /** Portaled dialogs/popovers rendered once, outside measurement and overflow */
  overlay?: React.ReactNode;
  /** Keep this item inside the "Plus ▾" overflow menu even when horizontal space is available */
  overflowOnly?: boolean;
}

/**
 * Responsive Edifice-style toolbar container that keeps primary tools on the main bar
 * and groups secondary or overflowing tools inside the "Plus ▾" popover menu.
 */
export const ResponsiveToolbar = ({ items }: { items: ToolbarItem[] }) => {
  const { formatMessage } = useIntl();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const primaryItems = useMemo(() => items.filter((item) => !item.overflowOnly), [items]);
  const secondaryItems = useMemo(() => items.filter((item) => item.overflowOnly), [items]);
  const hasSecondaryItems = secondaryItems.some((item) => !item.id.toLowerCase().includes('spacer'));

  const [visibleCount, setVisibleCount] = useState(primaryItems.length);

  const primaryIdsKey = primaryItems.map((item) => item.id).join('\0');

  const calculate = useCallback(() => {
    const toolbar = toolbarRef.current;
    const measure = measureRef.current;
    if (!toolbar || !measure) return;

    const availableWidth = toolbar.clientWidth;
    const children = Array.from(measure.children) as HTMLElement[];

    // Check if everything fits without the "Plus" button when there are no secondary items
    let totalWidth = 0;
    for (let i = 0; i < children.length; i++) {
      totalWidth += children[i].offsetWidth + (i > 0 ? ITEM_GAP : 0);
    }

    if (!hasSecondaryItems && totalWidth <= availableWidth) {
      setVisibleCount(primaryItems.length);
      return;
    }

    // Reserve space for the "Plus ▾" button and find how many primary items fit
    const maxWidth = availableWidth - MORE_BUTTON_WIDTH - ITEM_GAP;
    if (totalWidth <= maxWidth) {
      setVisibleCount(primaryItems.length);
      return;
    }

    let usedWidth = 0;
    let count = 0;

    for (let i = 0; i < children.length; i++) {
      const itemWidth = children[i].offsetWidth + (i > 0 ? ITEM_GAP : 0);
      if (usedWidth + itemWidth > maxWidth) break;
      usedWidth += itemWidth;
      count++;
    }

    setVisibleCount(Math.max(0, count));
  }, [primaryItems.length, primaryIdsKey, hasSecondaryItems]);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    const measure = measureRef.current;
    if (!toolbar) return;

    calculate();

    const observer = new ResizeObserver(calculate);
    observer.observe(toolbar);
    if (measure) {
      observer.observe(measure);
      for (const child of Array.from(measure.children)) {
        observer.observe(child);
      }
    }
    return () => observer.disconnect();
  }, [calculate]);

  const rawVisibleItems = primaryItems.slice(0, visibleCount);
  // Strip trailing spacers from visible items
  let visibleEndIdx = rawVisibleItems.length - 1;
  while (
    visibleEndIdx >= 0 &&
    rawVisibleItems[visibleEndIdx].id.toLowerCase().includes('spacer')
  ) {
    visibleEndIdx--;
  }
  const visibleItems = rawVisibleItems.slice(0, visibleEndIdx + 1);

  const overflowItems = [...primaryItems.slice(visibleCount), ...secondaryItems];

  // Strip leading and trailing spacers from overflow, then collapse any consecutive spacers
  let startIdx = 0;
  while (
    startIdx < overflowItems.length &&
    overflowItems[startIdx].id.toLowerCase().includes('spacer')
  ) {
    startIdx++;
  }
  let endIdx = overflowItems.length - 1;
  while (
    endIdx >= startIdx &&
    overflowItems[endIdx].id.toLowerCase().includes('spacer')
  ) {
    endIdx--;
  }
  const trimmedOverflow = overflowItems.slice(startIdx, endIdx + 1);
  const filteredOverflowItems = trimmedOverflow.filter((item, idx, arr) => {
    const isSpacer = item.id.toLowerCase().includes('spacer');
    if (!isSpacer) return true;
    const prevIsSpacer = idx > 0 && arr[idx - 1].id.toLowerCase().includes('spacer');
    return !prevIsSpacer;
  });

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Hidden container to measure primary item widths */}
      <MeasureContainer
        ref={measureRef}
        aria-hidden="true"
        data-measure="true"
        {...({ inert: '' } as Record<string, string>)}
      >
        {primaryItems.map((item) => (
          <div key={item.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {item.measureContent ?? item.content}
          </div>
        ))}
      </MeasureContainer>
      {items.map((item) =>
        item.overlay ? (
          <React.Fragment key={`${item.id}-overlay`}>{item.overlay}</React.Fragment>
        ) : null
      )}

      {/* Visible Edifice toolbar */}
      <Flex ref={toolbarRef} gap={1} alignItems="center" width="100%">
        {visibleItems.map((item) => (
          <React.Fragment key={item.id}>{item.content}</React.Fragment>
        ))}

        {filteredOverflowItems.length > 0 && (
          <>
            {visibleItems.length > 0 && <Spacer margin={1} />}
            <Popover.Root>
              <Popover.Trigger>
                <button
                  type="button"
                  aria-label={formatMessage({ id: 'tiptap-editor.more', defaultMessage: 'Plus' })}
                  title={formatMessage({ id: 'tiptap-editor.more', defaultMessage: 'More tools' })}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '4px',
                    border: '1px solid transparent',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: '1.3rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{formatMessage({ id: 'tiptap-editor.more', defaultMessage: 'Plus' })}</span>
                  <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                    <path
                      d="M3 4.5L6 7.5L9 4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </Popover.Trigger>
              <StyledPopoverContent side="bottom" align="end" sideOffset={6}>
                <Flex gap={1} padding={2} wrap="wrap" alignItems="center">
                  {filteredOverflowItems.map((item) => (
                    <React.Fragment key={item.id}>{item.content}</React.Fragment>
                  ))}
                </Flex>
              </StyledPopoverContent>
            </Popover.Root>
          </>
        )}
      </Flex>
    </div>
  );
};

