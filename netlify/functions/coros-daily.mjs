import { queueSync } from '../../server/coros-state.mjs';
export default async () => { await queueSync(); };
export const config={schedule:'0 2 * * *'};
