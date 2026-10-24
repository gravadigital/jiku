import 'mocha';
import 'should';
import { contentChecksum } from '../../lib/modules/docs/checksum';

describe('contentChecksum (S-079)', () => {
  const CONTENT = '# Acta\n\nKickoff con Acme.\n';

  it('S-079 · TS-49: sha256 del texto en UTF-8, con prefijo', () => {
    contentChecksum('').should.equal('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    contentChecksum('abc').should.equal('sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    contentChecksum(CONTENT).should.equal('sha256:56ef0169a0ce1c72ce999efd5044f748c00da07d58ec73958f2b9057ab7c87c5');
    // UTF-8, no latin1: con latin1 daria `6329568f...`.
    contentChecksum('Año\n').should.equal('sha256:af8a9a5924d037f8b26da7db93567aef77b6d7a77299d476e3812ff5f8436fd2');
    for (const v of ['', 'abc', CONTENT, 'Año\n']) {
      contentChecksum(v).should.match(/^sha256:[0-9a-f]{64}$/);
    }
  });
});
