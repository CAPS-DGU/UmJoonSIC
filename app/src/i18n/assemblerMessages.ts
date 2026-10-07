// The assembler's and linker's messages come from SicTools in English (the simulator is not
// changed). In Korean mode the known ones are shown in Korean; the quoted part (the symbol,
// the character) stays as written. Templates from SicTools/src/sic*/asm and the linker.
// Terms as in the Korean Beck and the course (the Korean terminology section of docs/DEVELOPMENT.md):
// 기호 with "(symbol)" attached, 니모닉, 레이블, 위치 카운터, 주소 지정 방식, 제어 섹션.
import type { UiLanguage } from '@shared/ipc';

type Rule = [RegExp, (...groups: string[]) => string];

const KO: Rule[] = [
  [/^Invalid mnemonic '(.*)'$/, s => `잘못된 니모닉 '${s}'`],
  [/^Undefined symbol '(.*)'$/, s => `정의되지 않은 기호(symbol) '${s}'`],
  [/^Duplicate symbol '(.*)'$/, s => `중복 정의된 기호(symbol) '${s}'`],
  [/^Invalid character '(.*)'$/, c => `잘못된 문자 '${c}'`],
  [/^Invalid register '(.*)'$/, c => `잘못된 레지스터 '${c}'`],
  [/^invalid digit '(.*)'$/, c => `잘못된 숫자 '${c}'`],
  [/^Missing mnemonic$/, () => '니모닉이 없습니다'],
  [/^Number expected$/, () => '숫자가 와야 합니다'],
  [/^Symbol expected$/, () => '기호(symbol)가 와야 합니다'],
  [/^Invalid number$/, () => '잘못된 숫자'],
  [/^Expected '(.*)'$/, s => `'${s}' 이(가) 와야 합니다`],
  [/^Expected character (.) not found$/, c => `'${c}' 이(가) 와야 합니다`],
  [/^Expression expected '(.*)'$/, c => `수식이 와야 합니다 ('${c}')`],
  [/^BYTE requires C'\.\.' or X'\.\.'$/, () => "BYTE 에는 C'..' 또는 X'..' 가 와야 합니다"],
  [/^HEX address expected for START$/, () => 'START 에는 16진수 주소가 와야 합니다'],
  [
    /^Invalid HEX address '(.*)' for START$/,
    s => `START 의 16진수 주소 '${s}' 이(가) 잘못되었습니다`,
  ],
  [/^Program name too long$/, () => '프로그램 이름이 너무 깁니다'],
  [/^Multiple STARTs are not allowed$/, () => 'START 는 한 번만 쓸 수 있습니다'],
  [/^START must precede all instructions$/, () => 'START 는 모든 명령어보다 앞에 와야 합니다'],
  [/^Unterminated byte string$/, () => '바이트 문자열이 닫히지 않았습니다'],
  [/^Hexadecimal byte expected$/, () => '16진수 바이트가 와야 합니다'],
  [
    /^Number '(.*)' out of range \[(.*)\.\.(.*)\]$/,
    (n, lo, hi) => `숫자 '${n}' 이(가) 범위 [${lo}..${hi}] 를 벗어났습니다`,
  ],
  [
    /^Expressions are not allowed in pure SIC \(found (.*)\)$/,
    f => `순수 SIC 에서는 수식을 쓸 수 없습니다 (${f})`,
  ],
  [
    /^Location counter '\*' is not allowed in pure SIC operands$/,
    () => "순수 SIC 의 피연산자에는 위치 카운터 '*' 를 쓸 수 없습니다",
  ],
  [
    /^Cannot address symbol '(.*)'$/,
    s => `기호(symbol) '${s}' 의 주소를 지정할 수 없습니다 (거리가 너무 멂)`,
  ],
  [
    /^Cannot address (.*) '(.*)' in pure SIC$/,
    (kind, s) =>
      `순수 SIC 에서는 ${kind === 'value' ? '값' : '기호(symbol)'} '${s}' 의 주소를 지정할 수 없습니다`,
  ],
  [
    /^Indexed addressing not supported here$/,
    () => '여기서는 인덱스 주소 지정 방식을 쓸 수 없습니다',
  ],
  [/^Invalid addressing\.?$/, () => '잘못된 주소 지정 방식'],
  [
    /^External symbol '(.*)' is not allowed here$/,
    s => `외부 기호(symbol) '${s}' 은(는) 여기에 쓸 수 없습니다`,
  ],
  [
    /^Cannot export undefined symbol '(.*)'$/,
    s => `정의되지 않은 기호(symbol) '${s}' 은(는) EXTDEF 할 수 없습니다`,
  ],
  [/^Unknown escape sequence '(.*)'$/, s => `알 수 없는 이스케이프 문자 '${s}'`],
];

/** The message in the interface language (unknown messages stay as they are). */
export function translateAssemblerMessage(message: string, language: UiLanguage): string {
  if (language !== 'ko') return message;
  const trimmed = message.trim();
  for (const [pattern, render] of KO) {
    const m = trimmed.match(pattern);
    if (m) return render(...m.slice(1));
  }
  // The linker: "<symbol> is not defined in any section".
  return trimmed.replace(
    / is not defined in any section/g,
    ' 이(가) 어느 제어 섹션에도 정의되어 있지 않습니다',
  );
}
