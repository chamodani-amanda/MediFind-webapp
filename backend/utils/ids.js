import { randomUUID } from 'node:crypto';
export const createPublicId = (prefix) => `${prefix}-${randomUUID().split('-')[0].toUpperCase()}`;
