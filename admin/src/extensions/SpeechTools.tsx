import React, { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/core';
import { Microphone, VolumeUp } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';

/**
 * Edifice IO Assistive Speech Tools:
 * 1. Speech-to-Text (Web Speech API SpeechRecognition / webkitSpeechRecognition)
 * 2. Text-to-Speech (window.speechSynthesis read-aloud toggle)
 */
export function useSpeechTools(
  editor: Editor | null,
  props: { disabled?: boolean } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSpeechToText = () => {
    if (!editor) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setLiveStatus('Dictation stopped.');
      return;
    }

    const w = typeof window !== 'undefined' ? (window as Record<string, any>) : null;
    const SpeechRecognitionCtor = w?.SpeechRecognition || w?.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setLiveStatus('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript && typeof transcript === 'string') {
          editor.chain().focus().insertContent(transcript + ' ').run();
          setLiveStatus(`Inserted dictated text: ${transcript}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setLiveStatus('Speech recognition encountered an error.');
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setLiveStatus('Listening for dictation...');
    } catch {
      setIsListening(false);
    }
  };

  const toggleTextToSpeech = () => {
    if (!editor || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setLiveStatus('Stopped reading aloud.');
      return;
    }

    const { from, to } = editor.state.selection;
    const selectedText =
      from !== to
        ? editor.state.doc.textBetween(from, to, ' ')
        : editor.getText();

    if (!selectedText.trim()) {
      setLiveStatus('No text to read aloud.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(selectedText);
    utterance.onend = () => {
      setIsSpeaking(false);
      setLiveStatus('Finished reading aloud.');
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setLiveStatus('Reading document aloud...');
  };

  return {
    speechToTextButton: (
      <ToolbarButton
        onClick={toggleSpeechToText}
        icon={<Microphone />}
        active={isListening}
        disabled={!editor || props.disabled}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.speechToText',
          defaultMessage: isListening ? 'Stop dictation' : 'Dictate text (Speech-to-Text)',
        })}
      />
    ),
    textToSpeechButton: (
      <ToolbarButton
        onClick={toggleTextToSpeech}
        icon={<VolumeUp />}
        active={isSpeaking}
        disabled={!editor || props.disabled}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.textToSpeech',
          defaultMessage: isSpeaking ? 'Stop reading aloud' : 'Read aloud (Text-to-Speech)',
        })}
      />
    ),
    speechLiveRegion: (
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {liveStatus}
      </span>
    ),
  };
}
