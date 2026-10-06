import { describe, expect, it } from 'vitest';
import { translateAssemblerMessage } from './assemblerMessages';

describe('assembler messages in Korean mode', () => {
  it('translates the known messages and keeps the quoted part', () => {
    expect(translateAssemblerMessage("Invalid mnemonic 'LDAA'", 'ko')).toBe("잘못된 니모닉 'LDAA'");
    expect(translateAssemblerMessage("Undefined symbol 'GAMA'", 'ko')).toBe(
      "정의되지 않은 기호(symbol) 'GAMA'",
    );
    expect(translateAssemblerMessage("Number '9999' out of range [0..4095]", 'ko')).toBe(
      "숫자 '9999' 이(가) 범위 [0..4095] 를 벗어났습니다",
    );
  });
  it('names the kind of operand in the pure SIC message', () => {
    expect(translateAssemblerMessage("Cannot address value '5000' in pure SIC", 'ko')).toBe(
      "순수 SIC 에서는 값 '5000' 의 주소를 지정할 수 없습니다",
    );
  });
  it('keeps unknown messages and English mode as they are', () => {
    expect(translateAssemblerMessage('Something new', 'ko')).toBe('Something new');
    expect(translateAssemblerMessage("Invalid mnemonic 'LDAA'", 'en')).toBe(
      "Invalid mnemonic 'LDAA'",
    );
  });
});
