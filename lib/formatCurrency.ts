
// lib/formatCurrency.ts
export const formatCurrency = (amount: number | string | undefined): string => {
  if (amount === undefined || amount === null || amount === '') return '0 دينار عراقي';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0 دينار عراقي';
  
  // Use 'en-US' to ensure Western numerals and commas for thousands
  // maximumFractionDigits: 0 ensures no decimals (e.g., 1,000 instead of 1,000.00)
  const formattedNumber = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return `${formattedNumber} دينار عراقي`;
};
