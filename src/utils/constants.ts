export const TICKET_ATTRIBUTES = {
  MAX_DECIMALS: 2,
  MAX_INTEGER: 8,
  MAX_VALID_TITLE_LENGTH: 255
};

export const signJwtTokenOptions = {
  ISSUER: 'auth-api',
  AUDIENCE: 'ticketing-frontend'
};

export const STREAM_NOT_FOUND = 'no stream matches subject';

export const rocketEmoji = String.fromCodePoint(0x1f680);
