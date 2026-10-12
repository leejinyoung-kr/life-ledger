import { describe, it, expect } from 'vitest';
import { countFolders, fromDroppedEntries, isSystemFile, MAX_UPLOAD_BYTES, relDirOf, splitUploadable } from '../../lib/folderUpload';

// 크기만 흉내 낸 File (size 는 읽기 전용이라 정의해서 바꾼다)
function file(name: string, size = 10): File {
  const f = new File(['x'], name);
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('folderUpload', () => {
  it('relDirOf 는 파일이 든 폴더 경로만 남긴다', () => {
    expect(relDirOf('보험/2026/a.pdf')).toBe('보험/2026');
    expect(relDirOf('a.pdf')).toBe('');
  });

  it('isSystemFile 은 OS 숨김·임시 파일을 알아본다', () => {
    expect(['.DS_Store', 'Thumbs.db', 'desktop.ini', '._a.jpg', '~$문서.docx'].every(isSystemFile)).toBe(true);
    expect(isSystemFile('보험증권.pdf')).toBe(false);
  });

  it('splitUploadable 은 시스템 파일을 빼고 50MB 초과를 따로 모은다', () => {
    const items = [
      { file: file('a.pdf'), dir: '보험' },
      { file: file('.DS_Store'), dir: '보험' },
      { file: file('big.mp4', MAX_UPLOAD_BYTES + 1), dir: '' },
    ];
    const { ok, tooBig } = splitUploadable(items);
    expect(ok.map((i) => i.file.name)).toEqual(['a.pdf']);
    expect(tooBig.map((i) => i.file.name)).toEqual(['big.mp4']);
  });

  it('countFolders 는 중간 폴더까지 센다', () => {
    expect(countFolders([{ file: file('a'), dir: '보험/2026' }, { file: file('b'), dir: '보험' }, { file: file('c'), dir: '' }])).toBe(2);
  });

  it('fromDroppedEntries 는 폴더 안쪽까지 내려가며 상대 경로를 붙인다', async () => {
    // 가짜 FileSystemEntry — 폴더 "보험"(a.pdf, 하위 "2026"(b.pdf)) + 낱개 c.txt
    const fileEntry = (name: string) => ({ isFile: true, isDirectory: false, name, file: (ok: (f: File) => void) => ok(file(name)) });
    const dirEntry = (name: string, children: unknown[]) => ({
      isFile: false, isDirectory: true, name,
      createReader: () => {
        let done = false;
        return { readEntries: (ok: (e: unknown[]) => void) => { ok(done ? [] : children); done = true; } };
      },
    });
    const tree = [dirEntry('보험', [fileEntry('a.pdf'), dirEntry('2026', [fileEntry('b.pdf')])]), fileEntry('c.txt')];

    const items = await fromDroppedEntries(tree as unknown as FileSystemEntry[]);

    expect(items.map((i) => `${i.dir}|${i.file.name}`)).toEqual(['보험|a.pdf', '보험/2026|b.pdf', '|c.txt']);
  });
});
