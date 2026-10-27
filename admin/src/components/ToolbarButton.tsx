import React, { ReactNode } from 'react';
import { IconButton } from '@strapi/design-system';

export type ToolbarButtonTint = 'green' | 'purple' | 'rose' | 'amber';

export interface ToolbarButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'style'> {
  icon: ReactNode;
  active?: boolean;
  toggle?: boolean;
  onClick: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  hidden?: boolean;
  tooltip: string;
  ariaLabel?: string;
  marginLeft?: number;
  tint?: ToolbarButtonTint;
  style?: React.CSSProperties;
}

const TINT_STYLES: Record<ToolbarButtonTint, React.CSSProperties> = {
  green: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: '#15803d',
    borderColor: 'rgba(34, 197, 94, 0.28)',
    borderRadius: '6px',
  },
  purple: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    color: '#7e22ce',
    borderColor: 'rgba(168, 85, 247, 0.28)',
    borderRadius: '6px',
  },
  rose: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    color: '#be123c',
    borderColor: 'rgba(244, 63, 94, 0.28)',
    borderRadius: '6px',
  },
  amber: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    color: '#b45309',
    borderColor: 'rgba(245, 158, 11, 0.32)',
    borderRadius: '6px',
  },
};

/**
 * Renders a toolbar icon button with tooltip, active state, optional pastel media tint, and WCAG `aria-pressed` toggle state.
 */
export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      icon,
      active,
      toggle,
      onClick,
      disabled,
      hidden,
      tooltip,
      ariaLabel,
      marginLeft,
      tint,
      style,
      ...rest
    },
    ref
  ) => (
    <IconButton
      {...rest}
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      variant={active ? 'secondary' : 'ghost'}
      marginLeft={marginLeft || 0}
      label={tooltip}
      aria-label={ariaLabel ?? tooltip}
      aria-pressed={toggle ? Boolean(active) : undefined}
      data-tint={tint}
      style={{
        ...(tint ? TINT_STYLES[tint] : {}),
        ...style,
        display: hidden ? 'none' : style?.display,
      }}
    >
      {icon}
    </IconButton>
  )
);

ToolbarButton.displayName = 'ToolbarButton';


