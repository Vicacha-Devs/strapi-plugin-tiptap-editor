import { describe, it, expect } from 'vitest';

import { PasteStripper } from '../../admin/src/extensions/PasteStripper';

describe('PasteStripper', () => {
  it('PasteStripper.name is "pasteStripper"', () => {
    expect(PasteStripper.name).toBe('pasteStripper');
  });

  it('strips double-quoted style attributes from span elements', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const input = '<span style="color: red">text</span>';
    const output = strip(input);
    expect(output).toBe('<span>text</span>');
  });

  it('strips style from div elements', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const input = '<div style="background: blue">content</div>';
    const output = strip(input);
    expect(output).toBe('<div>content</div>');
  });

  it('strips style from p elements', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const input = '<p style="font-size: 14px">paragraph</p>';
    const output = strip(input);
    expect(output).toBe('<p>paragraph</p>');
  });

  it('strips style from td elements', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const input = '<td style="border: 1px solid black">cell</td>';
    const output = strip(input);
    expect(output).toBe('<td>cell</td>');
  });

  it('preserves class attribute when stripping style', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const input = '<span class="highlight" style="color: red">text</span>';
    const output = strip(input);
    expect(output).toBe('<span class="highlight">text</span>');
  });

  it('preserves id attribute when stripping style', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const input = '<div id="main" style="margin: 0">content</div>';
    const output = strip(input);
    expect(output).toBe('<div id="main">content</div>');
  });

  it('returns unchanged HTML when no style attributes present', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const input = '<p class="intro">Hello <strong>world</strong></p>';
    const output = strip(input);
    expect(output).toBe('<p class="intro">Hello <strong>world</strong></p>');
  });

  it('strips multiple style attributes in one HTML string', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const input = '<div style="color: red"><p style="margin: 0">text</p></div>';
    const output = strip(input);
    expect(output).toBe('<div><p>text</p></div>');
  });

  it('handles empty string input', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    expect(strip('')).toBe('');
  });

  it('strips single-quoted, unquoted, and case-insensitive STYLE attributes on external paste', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    expect(strip("<span STYLE='color: red'>a</span>")).toBe('<span>a</span>');
    expect(strip('<span style=color:red>b</span>')).toBe('<span>b</span>');
    expect(strip('<p\n  Style="font-size: 20px">c</p>')).toBe('<p>c</p>');
  });

  it('preserves safe Tiptap styles on internal ProseMirror paste (data-pm-slice) while stripping dangerous CSS', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const internalHtml =
      '<div data-pm-slice="0 0 []"><p style="text-align: center; position: fixed; top: 0"><span style="color: #ff0000; font-size: 18px; line-height: 1.5; font-family: Georgia, serif; background-image: url(https://evil.example/track)">Styled</span><mark style=\'background-color: rgb(255, 230, 0); z-index: 9999\'>Hi</mark><span style="position: absolute">Plain</span></p></div>';
    const output = strip(internalHtml);
    expect(output).toBe(
      '<div data-pm-slice="0 0 []"><p style="text-align: center"><span style="color: #ff0000; font-size: 18px; line-height: 1.5; font-family: Georgia, serif">Styled</span><mark style="background-color: rgb(255, 230, 0)">Hi</mark><span>Plain</span></p></div>'
    );
  });

  it('processes large runs of non-matching whitespace in linear time without backtracking', () => {
    const strip = (PasteStripper.config as any).transformPastedHTML;
    const prefix = ' '.repeat(50_000);
    const start = performance.now();
    const output = strip(`${prefix}<p style="color: red">ok</p>`);
    const elapsedMs = performance.now() - start;

    expect(output).toBe(`${prefix}<p>ok</p>`);
    expect(elapsedMs).toBeLessThan(100);
  });
});
