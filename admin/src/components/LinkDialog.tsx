import React from 'react';
import { Button, Dialog, Field, TextInput } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { isSafeUrl } from '../../../shared/src/urlSafety';

export type LinkDialogPayload = { url: string };

interface LinkDialogProps {
  open: boolean;
  url: string | undefined;
  mode: 'add' | 'edit';
  onClose: () => void;
  onSave: (payload: LinkDialogPayload) => void;
  onRemove?: () => void;
}

// Dialog for adding or editing/removing a link.
export const LinkDialog: React.FC<LinkDialogProps> = ({
  open,
  url,
  mode,
  onClose,
  onSave,
  onRemove,
}) => {
  const { formatMessage } = useIntl();
  const [value, setValue] = React.useState(url || '');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setValue(url || '');
      setError(null);
    }
  }, [open, url, mode]);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed === '') {
      if (mode === 'edit' && onRemove) {
        setError(null);
        onSave({ url: '' });
        return;
      }
      setError(
        formatMessage({
          id: 'tiptap-editor.link.invalidUrl',
          defaultMessage: 'Enter a valid, safe URL',
        })
      );
      return;
    }
    if (!isSafeUrl(trimmed)) {
      setError(
        formatMessage({
          id: 'tiptap-editor.link.invalidUrl',
          defaultMessage: 'Enter a valid, safe URL',
        })
      );
      return;
    }
    setError(null);
    onSave({ url: trimmed });
  };

  const isSaveDisabled = mode === 'add' || !onRemove ? value.trim() === '' : false; // allow empty to remove when editing

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v: boolean) => {
        if (!v) onClose();
      }}
    >
      {open && (
        <Dialog.Content>
          <Dialog.Header>{mode === 'add'
            ? formatMessage({ id: 'tiptap-editor.link.addLink', defaultMessage: 'Add link' })
            : formatMessage({ id: 'tiptap-editor.link.editLink', defaultMessage: 'Edit link' })
          }</Dialog.Header>
          <Dialog.Body>
            <Field.Root width="100%" name="link-url" error={error || undefined}>
              <Field.Label>{formatMessage({ id: 'tiptap-editor.link.urlLabel', defaultMessage: 'URL' })}</Field.Label>
              <TextInput
                name="link-url"
                placeholder={formatMessage({ id: 'tiptap-editor.link.urlPlaceholder', defaultMessage: 'https://example.com' })}
                value={value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
              />
              <Field.Error />
            </Field.Root>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary" fullWidth onClick={onClose}>
                {formatMessage({ id: 'tiptap-editor.link.cancel', defaultMessage: 'Cancel' })}
              </Button>
            </Dialog.Cancel>
            {mode === 'edit' && onRemove && (
              <Button variant="danger-light" fullWidth onClick={onRemove}>
                {formatMessage({ id: 'tiptap-editor.link.removeLink', defaultMessage: 'Remove link' })}
              </Button>
            )}
            <Button
              fullWidth
              variant="success-light"
              onClick={handleSave}
              disabled={isSaveDisabled}
            >
              {formatMessage({ id: 'tiptap-editor.link.save', defaultMessage: 'Save' })}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      )}
    </Dialog.Root>
  );
};

export default LinkDialog;
