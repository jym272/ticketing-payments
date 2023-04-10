import { TICKET_ATTRIBUTES } from '@utils/constants';
const { MAX_DECIMALS, MAX_INTEGER, MAX_VALID_TITLE_LENGTH } = TICKET_ATTRIBUTES;

export const isValidTitle = (title: string): boolean => {
  const titleRegex = new RegExp(`^.{1,${MAX_VALID_TITLE_LENGTH}}$`);
  return titleRegex.test(title);
};

export const isValidPrice = (price: number): boolean => {
  const priceRegex = new RegExp(`^\\d{1,${MAX_INTEGER}}(\\.\\d{1,${MAX_DECIMALS}})?$`);
  return priceRegex.test(price.toString());
};
