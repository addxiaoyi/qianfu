const INTEGER_FEN_PATTERN = /^\d+$/;
const YUAN_INPUT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export const fenToYuanNumber = (fen: number): number => {
  const value = Number(fen);
  if (!Number.isSafeInteger(value)) return 0;
  return value / 100;
};

export const fenToYuanText = (fen: number): string => fenToYuanNumber(fen).toFixed(2);

export const formatCnyFromFen = (fen: number): string => `¥${fenToYuanText(fen)}`;

export const parseYuanToFen = (yuan: string | number): number | null => {
  const input = String(yuan).trim();
  if (!YUAN_INPUT_PATTERN.test(input)) return null;

  const [yuanPart, fractionPart = ''] = input.split('.');
  if (!INTEGER_FEN_PATTERN.test(yuanPart)) return null;

  const fen = Number(yuanPart) * 100 + Number(fractionPart.padEnd(2, '0'));
  return Number.isSafeInteger(fen) ? fen : null;
};
