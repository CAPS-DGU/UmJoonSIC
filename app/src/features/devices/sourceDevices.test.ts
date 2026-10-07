import { describe, expect, it } from 'vitest';
import { devicesInSources, sectionsInSource } from './sourceDevices';

describe('devices in the source', () => {
  it('finds RD, WD and TD with the BYTE they name', () => {
    const source = [
      'COPY     START   0',
      '. read a byte and write it',
      'LOOP     TD      INDEV',
      '         JEQ     LOOP',
      '         RD      INDEV',
      '         WD      OUTDEV   . to the output',
      "INDEV    BYTE    X'F1'",
      "OUTDEV   BYTE    X'05'",
      '         END     COPY',
    ].join('\n');
    expect(devicesInSources([source])).toEqual([
      { device: 5, uses: ['write'], labels: ['OUTDEV'] },
      { device: 0xf1, uses: ['test', 'read'], labels: ['INDEV'] },
    ]);
  });

  it('reads tab-separated code, lower case, literals and the extended format', () => {
    const source = [
      'p\tstart\t0',
      '\t+wd\tdev,x',
      "\twd\t=X'06'",
      "dev\tbyte\tx'02'",
      '\tend\tp',
    ].join('\n');
    expect(devicesInSources([source])).toEqual([
      { device: 2, uses: ['write'], labels: ['DEV'] },
      { device: 6, uses: ['write'], labels: [] },
    ]);
  });

  it('joins the files of a program (the BYTE may be in another file)', () => {
    expect(devicesInSources(['\tRD\tIN', "IN\tBYTE\tX'F1'"])).toEqual([
      { device: 0xf1, uses: ['read'], labels: ['IN'] },
    ]);
  });

  it('ignores comments and unknown symbols', () => {
    expect(devicesInSources(['. WD OUTDEV', '\tWD\tNOWHERE'])).toEqual([]);
  });
});

describe('sections in the source', () => {
  it('lists START and CSECT names as written, not comments or other labels', () => {
    const source = [
      '. MAIN START 0',
      'main     START   0',
      'LOOP     J       LOOP',
      'part2    CSECT',
      '         END     main',
    ].join('\n');
    expect(sectionsInSource(source)).toEqual(['main', 'part2']);
  });
});
