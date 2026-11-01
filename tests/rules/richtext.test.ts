import { describe, expect, it } from 'vitest';
import { fromHtml, toHtml } from '$lib/rules/richtext';

const back = (text: string) => {
  const el = document.createElement('div');
  el.innerHTML = toHtml(text);
  return fromHtml(el);
};
const from = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return fromHtml(el);
};

describe('toHtml', () => {
  it('shows the marks as formatting', () => {
    expect(toHtml('**b** *i* __u__ ~~s~~')).toBe('<div><strong>b</strong> <em>i</em> <u>u</u> <s>s</s></div>');
  });

  it('makes headings and lists', () => {
    expect(toHtml('## Title\n- one\n- two\n1. first\nplain')).toBe(
      '<h3>Title</h3><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol><div>plain</div>'
    );
  });

  it('keeps blank lines as blank lines', () => {
    expect(toHtml('a\n\nb')).toBe('<div>a</div><div><br></div><div>b</div>');
  });

  it('never lets HTML in the text through', () => {
    const html = toHtml('<img src=x onerror=alert(1)> **<b>x</b>**');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('<strong>&lt;b&gt;x&lt;/b&gt;</strong>');
  });

  it('does not take a lone asterisk in a sum for a mark', () => {
    expect(toHtml('2 * 3 * 4')).toBe('<div>2 * 3 * 4</div>');
  });

  it('reads plain writing from before formatting as it was', () => {
    expect(toHtml('Born in a river town.')).toBe('<div>Born in a river town.</div>');
  });
});

describe('fromHtml', () => {
  it('turns what the editor holds into marks', () => {
    expect(from('<div><b>b</b> <i>i</i> <u>u</u> <strike>s</strike></div>')).toBe('**b** *i* __u__ ~~s~~');
    expect(from('<h3>Title</h3><ul><li>one</li></ul><ol><li>a</li><li>b</li></ol>')).toBe('## Title\n- one\n1. a\n2. b');
  });

  it('reads the editor’s first line, which is not in a block, and its blank lines', () => {
    expect(from('first<div>second</div><div><br></div><div>fourth</div>')).toBe('first\nsecond\n\nfourth');
  });

  it('escapes what was typed so it is never read as a mark', () => {
    const text = from('<div>5 * 3 and a_b__c ~~ x</div><div>- not a list</div>');
    expect(toHtml(text)).toBe('<div>5 * 3 and a_b__c ~~ x</div><div>- not a list</div>');
  });

  it('drops a mark around nothing and keeps spaces outside it', () => {
    expect(from('<div>a<b> </b>b<b> bold </b>c</div>')).toBe('a b **bold** c');
  });

  it('round-trips every kind of formatting', () => {
    for (const text of [
      '**bold** and *italic* and __under__ and ~~gone~~',
      '## Heading\n\n- one\n- **two**\n\n1. first\n2. second',
      'Plain lines\nwith breaks\n\nand a gap',
      'escaped \\* star and \\_\\_ underscores',
      '\\- a line that starts like a list'
    ]) {
      expect(back(text)).toBe(text);
    }
  });
});

describe('what the browser leaves behind', () => {
  it('adds no blank line for an empty text node or emptied tag before the first line', () => {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode(''));
    el.insertAdjacentHTML('beforeend', '<b></b><div><b>First</b> line</div><div>Second</div>');
    expect(fromHtml(el)).toBe('**First** line\nSecond');
  });

  it('ignores a stray break between blocks and zero-width spaces', () => {
    expect(from('<div><b>Bold​</b></div><br><div>next</div>')).toBe('**Bold**\nnext');
  });

  it('still keeps a blank line the writer made', () => {
    expect(from('<div>a</div><div><br></div><div>b</div>')).toBe('a\n\nb');
  });
});
