import type React from 'react';
import type { AnyExtension, Editor } from '@tiptap/core';
import { isFeatureEnabled, type TiptapPresetConfig } from '../../../shared/types';

export interface CustomExtensionToolbarProps {
  editor: Editor | null;
  disabled?: boolean;
  config: TiptapPresetConfig;
  isDialogOpen: boolean;
  onOpenDialog: () => void;
  onCloseDialog: () => void;
}

export interface CustomExtensionDialogProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
  config: TiptapPresetConfig;
}

export interface TiptapCustomExtensionRegistration {
  /** Unique identifier for this custom extension (e.g. `'scriptureEmbed'`, `'beforeAfterImage'`). */
  id: string;
  /**
   * Optional feature key in `TiptapPresetConfig`. Defaults to `id`.
   */
  featureKey?: string;
  /**
   * Whether the extension is enabled by default unless `config[featureKey] === false`.
   * Defaults to `true`.
   */
  defaultEnabled?: boolean;
  /** Human-readable label shown in Strapi Admin Settings and tooltips. */
  label?: string;
  /**
   * One or more Tiptap `Node`, `Mark`, or `Extension` instances, or a factory function receiving
   * `{ config, enableContentCheck }`.
   */
  extensions:
    | AnyExtension
    | AnyExtension[]
    | ((context: {
        config: TiptapPresetConfig;
        enableContentCheck: boolean;
      }) => AnyExtension | AnyExtension[]);
  /**
   * Optional React component rendered as the toolbar button trigger.
   */
  ToolbarComponent?: React.ComponentType<CustomExtensionToolbarProps>;
  /**
   * Optional declarative toolbar button configuration used when `ToolbarComponent` is not provided.
   */
  toolbarButton?: {
    label: string;
    tooltip?: string;
    icon: React.ReactNode;
    isActive?: (editor: Editor | null) => boolean;
    onClick?: (editor: Editor | null, helpers: { openDialog: () => void }) => void;
  };
  /**
   * Optional modal/dialog React component rendered in the top-level toolbar overlay
   * (outside the overflow Popover so it stays mounted when the overflow menu closes).
   */
  DialogComponent?: React.ComponentType<CustomExtensionDialogProps>;
}

const customExtensionsMap = new Map<string, TiptapCustomExtensionRegistration>();

/**
 * Registers a custom Tiptap extension (Node, Mark, or Extension) along with optional
 * toolbar UI and modal dialog.
 * Calling `registerTiptapExtension` with an existing `id` replaces the previous registration.
 */
export function registerTiptapExtension(
  registration: TiptapCustomExtensionRegistration
): () => void {
  if (!registration || typeof registration.id !== 'string' || !registration.id.trim()) {
    throw new Error('[tiptap-editor] registerTiptapExtension requires a non-empty string `id`.');
  }
  const normalizedId = registration.id.trim();
  customExtensionsMap.set(normalizedId, {
    ...registration,
    id: normalizedId,
  });

  return () => {
    unregisterTiptapExtension(normalizedId);
  };
}

/**
 * Removes a previously registered custom Tiptap extension by `id`.
 */
export function unregisterTiptapExtension(id: string): boolean {
  return customExtensionsMap.delete(id.trim());
}

/**
 * Returns a single registered custom Tiptap extension by `id`, or `undefined` if not found.
 */
export function getRegisteredTiptapExtension(
  id: string
): TiptapCustomExtensionRegistration | undefined {
  return customExtensionsMap.get(id.trim());
}

/**
 * Returns all currently registered custom Tiptap extensions in registration order.
 */
export function getRegisteredTiptapExtensions(): TiptapCustomExtensionRegistration[] {
  return Array.from(customExtensionsMap.values());
}

/**
 * Clears all registered custom Tiptap extensions (primarily for unit testing).
 */
export function clearRegisteredTiptapExtensions(): void {
  customExtensionsMap.clear();
}

/**
 * Determines whether a registered custom extension is active for the given preset configuration.
 */
export function isCustomExtensionEnabledForPreset(
  registration: TiptapCustomExtensionRegistration,
  config: TiptapPresetConfig
): boolean {
  const key = registration.featureKey || registration.id;
  const customMapValue = config?.customExtensions?.[key];
  const rawValue = customMapValue !== undefined ? customMapValue : config?.[key];
  if (rawValue === undefined) {
    return registration.defaultEnabled !== false;
  }
  return isFeatureEnabled(rawValue);
}
