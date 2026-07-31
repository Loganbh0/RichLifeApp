export function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '$0.00';
  const negative = n < 0;
  const abs = Math.abs(n);
  const [dollars, cents] = abs.toFixed(2).split('.');
  const withCommas = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${withCommas}.${cents}`;
}

export function splitMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return { sign: '', dollars: '0', cents: '00' };
  const negative = n < 0;
  const abs = Math.abs(n);
  const [dollars, cents] = abs.toFixed(2).split('.');
  return {
    sign: negative ? '-' : '',
    dollars: dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    cents,
  };
}
