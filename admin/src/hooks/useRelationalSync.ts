import { useCallback, useEffect, useRef } from 'react';
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
  /**
   * Initial document value used to seed the relation signature so the first unchanged
   * update after mount does not mark the form as dirty.
   */
  initialDocument?: unknown;
  enabled?: boolean;
}

/**
 * Computes a deterministic JSON signature for extracted media and internal link relations.
 */
function buildRelationSignature(doc: unknown): string {
  let normalized = doc;
  if (typeof doc === 'string' && doc.trim().startsWith('{')) {
    try {
      normalized = JSON.parse(doc);
    } catch {
      normalized = null;
    }
  }
  const extracted = extractRelationsFromJSON(normalized);
  const validMediaAssets = extracted.mediaAssets.filter((asset) => asset.assetId !== null);
  return JSON.stringify({
    mediaIds: validMediaAssets.map((a) => a.assetId),
    mediaDocumentIds: extracted.mediaDocumentIds,
    links: extracted.linksByCollection,
  });
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
  const { onSyncField, availableFields, initialDocument, enabled = true } = options;
  const lastSignatureRef = useRef<string>(buildRelationSignature(initialDocument));
  const hasSyncedUpdateRef = useRef<boolean>(false);
  const onSyncFieldRef = useRef(onSyncField);
  const availableFieldsRef = useRef(availableFields);

  useEffect(() => {
    onSyncFieldRef.current = onSyncField;
    availableFieldsRef.current = availableFields;
  }, [onSyncField, availableFields]);

  useEffect(() => {
    if (!hasSyncedUpdateRef.current) {
      lastSignatureRef.current = buildRelationSignature(initialDocument);
    }
  }, [initialDocument]);

  const syncRelationsFromDoc = useCallback(
    (doc: unknown): ExtractedRelationsResult => {
      const extracted = extractRelationsFromJSON(doc);
      const syncHandler = onSyncFieldRef.current;
      if (!enabled || !syncHandler || !fieldName) {
        return extracted;
      }

      const validMediaAssets = extracted.mediaAssets.filter((asset) => asset.assetId !== null);

      const signature = JSON.stringify({
        mediaIds: validMediaAssets.map((a) => a.assetId),
        mediaDocumentIds: extracted.mediaDocumentIds,
        links: extracted.linksByCollection,
      });

      // Zero side effects: do not trigger form updates if relations have not changed
      if (signature === lastSignatureRef.current) {
        return extracted;
      }
      hasSyncedUpdateRef.current = true;
      lastSignatureRef.current = signature;

      const mediaFieldName = `${fieldName}Media`;
      const linksFieldName = `${fieldName}Links`;

      const currentAvailableFields = availableFieldsRef.current;
      const canSyncMedia =
        !currentAvailableFields || currentAvailableFields.includes(mediaFieldName);
      const canSyncLinks =
        !currentAvailableFields || currentAvailableFields.includes(linksFieldName);

      if (canSyncMedia) {
        const mediaPayload = validMediaAssets.map((asset) => ({
          id: asset.assetId,
          documentId: asset.documentId,
          url: asset.src,
          type: asset.nodeType,
        }));
        syncHandler(mediaFieldName, mediaPayload);
      }

      if (canSyncLinks) {
        const linksPayload: Record<string, { set: Array<{ documentId: string }> }> = {};
        for (const [collectionUid, items] of Object.entries(extracted.linksByCollection)) {
          linksPayload[collectionUid] = {
            set: items.map((item) => ({ documentId: item.documentId })),
          };
        }
        syncHandler(linksFieldName, linksPayload);
      }

      return extracted;
    },
    [enabled, fieldName]
  );

  return {
    syncRelationsFromDoc,
  };
}
