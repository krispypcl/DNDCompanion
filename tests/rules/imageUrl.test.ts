import { describe, expect, it } from 'vitest';
import { resolveImageUrl } from '$lib/rules/imageUrl';

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
        expect(r.note, link).toMatch(/copy its image address/i);
      }
    });
  });
});

describe('other hosts', () => {
  it('sharpens a Pinterest thumbnail to the large size', () => {
    expect(resolveImageUrl('https://i.pinimg.com/236x/ab/cd/ef/abcdef.jpg').url).toBe(
      'https://i.pinimg.com/736x/ab/cd/ef/abcdef.jpg'
    );
    expect(resolveImageUrl('https://i.pinimg.com/originals/ab/cd/x.jpg').url).toBe(
      'https://i.pinimg.com/originals/ab/cd/x.jpg'
    );
  });

  it('asks Dropbox for the file rather than its preview', () => {
    const r = resolveImageUrl('https://www.dropbox.com/scl/fi/abc/hero.png?rlkey=xyz&dl=0');
    expect(r.source).toBe('dropbox');
    const u = new URL(r.url);
    expect(u.searchParams.get('raw')).toBe('1');
    expect(u.searchParams.get('dl')).toBeNull();
    expect(u.searchParams.get('rlkey')).toBe('xyz');
  });

  it('turns a OneDrive share link into its content address', () => {
    const r = resolveImageUrl('https://1drv.ms/i/s!AbCdEf');
    expect(r.source).toBe('onedrive');
    expect(r.url).toMatch(/^https:\/\/api\.onedrive\.com\/v1\.0\/shares\/u![A-Za-z0-9_-]+\/root\/content$/);
  });

  it('turns a GitHub file page into the raw file', () => {
    expect(resolveImageUrl('https://github.com/me/art/blob/main/img/hero.png').url).toBe(
      'https://raw.githubusercontent.com/me/art/main/img/hero.png'
    );
  });

  it('takes the picture out of a Google Images result', () => {
    const link = 'https://www.google.com/imgres?imgurl=https%3A%2F%2Fexample.com%2Fa.png&imgrefurl=x';
    expect(resolveImageUrl(link)).toMatchObject({ url: 'https://example.com/a.png', source: 'google' });
  });

  it('turns a Gyazo page into its file', () => {
    expect(resolveImageUrl('https://gyazo.com/0123456789abcdef0123456789abcdef').url).toBe(
      'https://i.gyazo.com/0123456789abcdef0123456789abcdef.png'
    );
  });

  it('passes direct files from image hosts straight through', () => {
    for (const link of [
      'https://i.redd.it/abc.jpg',
      'https://pbs.twimg.com/media/abc.jpg',
      'https://cdna.artstation.com/p/assets/images/x.jpg',
      'https://64.media.tumblr.com/abc/s1280x1920/x.png'
    ]) {
      expect(resolveImageUrl(link), link).toMatchObject({ url: link, source: 'direct' });
    }
  });

  it('warns that Discord links expire', () => {
    expect(resolveImageUrl('https://cdn.discordapp.com/attachments/1/2/a.png').note).toMatch(/day/);
  });

  it('says what to copy from pages that are not pictures', () => {
    for (const link of [
      'https://www.artstation.com/artwork/abc',
      'https://www.deviantart.com/someone/art/x-123',
      'https://ibb.co/abc',
      'https://www.reddit.com/r/DnD/comments/x',
      'https://photos.app.goo.gl/abc'
    ]) {
      const r = resolveImageUrl(link);
      expect(r.url, link).toBe('');
      expect(r.note, link).toMatch(/copy its image address/);
    }
  });
});
