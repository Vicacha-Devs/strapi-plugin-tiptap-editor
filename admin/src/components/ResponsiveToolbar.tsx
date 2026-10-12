import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Flex, Popover, IconButton } from '@strapi/design-system';
import { More } from '@strapi/icons';
import { useIntl } from 'react-intl';
import styled from 'styled-components';

const MORE_BUTTON_WIDTH = 40;
const ITEM_GAP = 4;

const StyledPopoverContent = styled(Popover.Content)`
  /* Content Manager Header is 100 and left side menu is 200 */
  z-index: 200 !important;
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
}

/**
 * Responsive toolbar container that measures item widths via ResizeObserver and moves
 * overflowing items into a "More" popover menu.
 */
export const ResponsiveToolbar = ({ items }: { items: ToolbarItem[] }) => {
  const { formatMessage } = useIntl();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  const calculate = useCallback(() => {
    const toolbar = toolbarRef.current;
    const measure = measureRef.current;
    if (!toolbar || !measure) return;

    const availableWidth = toolbar.clientWidth;
    const children = Array.from(measure.children) as HTMLElement[];

    // Check if everything fits without the "More" button
    let totalWidth = 0;
    for (let i = 0; i < children.length; i++) {
      totalWidth += children[i].offsetWidth + (i > 0 ? ITEM_GAP : 0);
    }

    if (totalWidth <= availableWidth) {
      setVisibleCount(items.length);
      return;
    }

    // Reserve space for the "More" button and find how many items fit
    const maxWidth = availableWidth - MORE_BUTTON_WIDTH - ITEM_GAP;
    let usedWidth = 0;
    let count = 0;

    for (let i = 0; i < children.length; i++) {
      const itemWidth = children[i].offsetWidth + (i > 0 ? ITEM_GAP : 0);
      if (usedWidth + itemWidth > maxWidth) break;
      usedWidth += itemWidth;
      count++;
    }

    setVisibleCount(Math.max(0, count));
  }, [items]);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    calculate();

    const observer = new ResizeObserver(calculate);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [calculate]);

  const visibleItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);

  const filteredOverflowItems = overflowItems.filter((item) => !item.id.startsWith('spacer'));

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Hidden container to measure all item widths */}
      <MeasureContainer ref={measureRef} aria-hidden="true">
        {items.map((item) => (
          <div key={item.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {item.content}
          </div>
        ))}
      </MeasureContainer>

      {/* Visible toolbar */}
      <Flex ref={toolbarRef} gap={1} alignItems="center" width="100%">
        {visibleItems.map((item, idx) => {
          // Hide trailing spacer
          if (item.id.startsWith('spacer') && idx === visibleItems.length - 1) return null;
          return <React.Fragment key={item.id}>{item.content}</React.Fragment>;
        })}

        {filteredOverflowItems.length > 0 && (
          <Popover.Root>
            <Popover.Trigger>
              <IconButton
                label={formatMessage({ id: 'tiptap-editor.more', defaultMessage: 'More' })}
                variant="ghost"
                marginLeft="auto"
              >
                <More />
              </IconButton>
            </Popover.Trigger>
            <StyledPopoverContent side="bottom" align="end" sideOffset={6}>
              <Flex gap={1} padding={2} wrap="wrap" alignItems="center">
                {filteredOverflowItems.map((item) => (
                  <React.Fragment key={item.id}>{item.content}</React.Fragment>
                ))}
              </Flex>
            </StyledPopoverContent>
          </Popover.Root>
        )}
      </Flex>
    </div>
  );
};
