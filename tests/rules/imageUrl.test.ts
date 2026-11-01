import { describe, expect, it } from 'vitest';
import { pinterestSearchUrl, pinterestTerms, resolveImageUrl } from '$lib/rules/imageUrl';

describe('resolveImageUrl', () => {
  it('says nothing for nothing', () => {
    expect(resolveImageUrl('')).toMatchObject({ url: '', source: 'none', note: null });
    expect(resolveImageUrl('   ')).toMatchObject({ url: '', source: 'none' });
    expect(resolveImageUrl(undefined)).toMatchObject({ url: '', source: 'none' });
  });

  it('passes an ordinary image address through untouched', () => {
    const r = resolveImageUrl('https://example.test/art/loka.png?v=2');
    expect(r).toEqual({ url: 'https://example.test/art/loka.png?v=2', source: 'direct', note: null });
  });

  it('adds https when someone left it off', () => {
    expect(resolveImageUrl('example.test/a.png').url).toBe('https://example.test/a.png');
  });

  it('refuses anything that is not a web address', () => {
    for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'file:///etc/passwd', 'not a url at all']) {
      const r = resolveImageUrl(bad);
      expect(r.url, bad).toBe('');
      expect(r.source, bad).toBe('invalid');
    }
  });

  describe('Google Drive', () => {
    const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    const direct = `https://lh3.googleusercontent.com/d/${ID}`;

    it('reads the id from a file link', () => {
      expect(resolveImageUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`).url).toBe(direct);
      expect(resolveImageUrl(`https://drive.google.com/file/u/0/d/${ID}/view`).url).toBe(direct);
    });

    it('reads the id from the open, uc and thumbnail forms', () => {
      expect(resolveImageUrl(`https://drive.google.com/open?id=${ID}`).url).toBe(direct);
      expect(resolveImageUrl(`https://drive.google.com/uc?export=view&id=${ID}`).url).toBe(direct);
      expect(resolveImageUrl(`https://docs.google.com/uc?id=${ID}`).url).toBe(direct);
    });

    it('reminds the person that the file has to be shared', () => {
      const r = resolveImageUrl(`https://drive.google.com/file/d/${ID}/view`);
      expect(r.source).toBe('drive');
      expect(r.note).toMatch(/anyone with the link/i);
    });

    it('explains a folder or a link with no file in it', () => {
      expect(resolveImageUrl('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQ').note).toMatch(/folder/i);
      expect(resolveImageUrl('https://drive.google.com/drive/my-drive').source).toBe('invalid');
    });
  });

  describe('Imgur', () => {
    it('turns a page link into the picture', () => {
      expect(resolveImageUrl('https://imgur.com/aBc123x')).toMatchObject({
        url: 'https://i.imgur.com/aBc123x.jpg',
        source: 'imgur'
      });
      expect(resolveImageUrl('https://imgur.com/aBc123x.png').url).toBe('https://i.imgur.com/aBc123x.png');
    });

    it('leaves a direct link alone', () => {
      expect(resolveImageUrl('https://i.imgur.com/aBc123x.png').url).toBe('https://i.imgur.com/aBc123x.png');
    });

    it('cannot pick one picture out of an album, and says what to do', () => {
      for (const link of ['https://imgur.com/a/Qwerty1', 'https://imgur.com/gallery/Qwerty1']) {
        const r = resolveImageUrl(link);
        expect(r.url).toBe('');
        expect(r.note).toMatch(/album or gallery/i);
      }
    });
  });

  describe('Pinterest', () => {
    it('accepts the picture itself', () => {
      const link = 'https://i.pinimg.com/736x/ab/cd/ef/abcdef.jpg';
      expect(resolveImageUrl(link)).toEqual({ url: link, source: 'pinterest', note: null });
    });

    it('cannot get a picture out of a pin page, and says what to copy', () => {
      for (const link of [
        'https://www.pinterest.com/pin/123456789/',
        'https://uk.pinterest.com/pin/123456789/',
        'https://www.pinterest.co.uk/pin/123456789/',
        'https://pin.it/abc123'
      ]) {
        const r = resolveImageUrl(link);
        expect(r.url, link).toBe('');
        expect(r.note, link).toMatch(/copy image address/i);
      }
    });
  });
});

describe('Pinterest search', () => {
  it('builds a search on Pinterest itself', () => {
    const url = new URL(pinterestSearchUrl('elf wizard dnd character portrait art'));
    expect(url.origin).toBe('https://www.pinterest.com');
    expect(url.pathname).toBe('/search/pins/');
    expect(url.searchParams.get('q')).toBe('elf wizard dnd character portrait art');
  });

  it('escapes what it is given and squeezes its spaces', () => {
    const url = new URL(pinterestSearchUrl('  half-orc   &  bard  '));
    expect(url.searchParams.get('q')).toBe('half-orc & bard');
  });

  it('looks for what the sheet already says', () => {
    expect(pinterestTerms('portrait', { ancestry: 'Tiefling', class: 'Warlock' })).toBe(
      'Tiefling Warlock dnd character portrait art'
    );
    expect(pinterestTerms('banner', { ancestry: 'Tiefling', class: 'Warlock' })).toMatch(/^Tiefling Warlock fantasy/);
  });

  it('still searches for something on a blank sheet', () => {
    expect(pinterestTerms('portrait', {})).toBe('dnd character portrait art');
    expect(pinterestTerms('banner', { ancestry: '  ' })).toBe('fantasy wide banner wallpaper');
  });
});
