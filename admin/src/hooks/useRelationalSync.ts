import { useCallback, useRef } from 'react';
import { extractRelationsFromJSON, ExtractedRelationsResult } from '../../../shared/relations';

export interface RelationalSyncCallbacks {
  /**
   * Optional callback or Strapi form onChange handler:
   * onChange(fieldName, value)
   */
  onSyncField?: (fieldName: string, value: unknown) => void;
  /**
   * Available field names on the current Content-Type form (if known).
   * When provided, sync only dispatches for companion fields that exist on the schema.
   */
  availableFields?: string[];
  enabled?: boolean;
}

/**
 * Synchronizes embedded media assets (Image, Video, Audio, Attachment) with `<FieldName>Media`
 * and internal links (`strapi://collectionName/documentId`) with `<FieldName>Links`
 * following the Hashbite Lexical relational sync pattern, expanded for all Edifice IO media types.
 */
export function useRelationalSync(
  fieldName: string,
  options: RelationalSyncCallbacks = {}
) {
  const { onSyncField, availableFields, enabled = true } = options;
  const lastSignatureRef = useRef<string>('');

  const syncRelationsFromDoc = useCallback(
    (doc: unknown): ExtractedRelationsResult => {
      const extracted = extractRelationsFromJSON(doc);
      if (!enabled || !onSyncField || !fieldName) {
        return extracted;
      }

      const signature = JSON.stringify({
        mediaIds: extracted.mediaIds,
        mediaDocumentIds: extracted.mediaDocumentIds,
        links: extracted.linksByCollection,
      });

      // Zero side effects: do not trigger form updates if relations have not changed
      if (signature === lastSignatureRef.current) {
        return extracted;
      }
      lastSignatureRef.current = signature;

      const mediaFieldName = `${fieldName}Media`;
      const linksFieldName = `${fieldName}Links`;

      const canSyncMedia =
        !availableFields || availableFields.includes(mediaFieldName);
      const canSyncLinks =
        !availableFields || availableFields.includes(linksFieldName);

      if (canSyncMedia && (extracted.mediaIds.length > 0 || extracted.mediaDocumentIds.length > 0)) {
        const mediaPayload = extracted.mediaAssets.map((asset) => ({
          id: asset.assetId,
          documentId: asset.documentId,
          url: asset.src,
          type: asset.nodeType,
        }));
        onSyncField(mediaFieldName, mediaPayload);
      }

      if (canSyncLinks && Object.keys(extracted.linksByCollection).length > 0) {
        const linksPayload: Record<string, { connect: Array<{ documentId: string }> }> = {};
        for (const [collectionUid, items] of Object.entries(extracted.linksByCollection)) {
          const shortName = collectionUid.includes('.')
            ? collectionUid.split('.')[1]
            : collectionUid;
          linksPayload[shortName] = {
            connect: items.map((item) => ({ documentId: item.documentId })),
          };
        }
        onSyncField(linksFieldName, linksPayload);
      }

      return extracted;
    },
    [enabled, fieldName, onSyncField, availableFields]
  );

  return {
    syncRelationsFromDoc,
  };
}
