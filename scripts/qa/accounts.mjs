import { createHash } from 'node:crypto';
import { K, ZONE_MIN } from '../../lib/pressure/config.ts';

export const QA_MARKER = 'boilerplate-qa-v1';
export const DEFAULT_NAMESPACE = 'regression';
export const uuidFor = (value) => {
  const h = createHash('sha256').update(`${QA_MARKER}:${value}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const zoneForScore = (score) => Object.entries(ZONE_MIN).reverse().find(([, min]) => score >= min)[0];

/** Public synthetic personas. Passwords are generated only by the private provisioning script. */
export function accountBank(namespace = DEFAULT_NAMESPACE) {
  if (!/^[a-z0-9-]{1,32}$/.test(namespace)) throw new Error('Namespace must be 1–32 lowercase letters, digits, or hyphens');
  const teams = ['class', 'work'].map((type) => ({
    key: type, id: uuidFor(`${namespace}:team:${type}`), name: `QA ${namespace} ${type}`, type,
    inviteCode: createHash('sha256').update(`${namespace}:${type}`).digest('hex').slice(0, 6).toUpperCase(),
  }));
  const users = Array.from({ length: 32 }, (_, i) => {
    const team = i < 16 ? 'class' : i < 31 ? 'work' : null;
    const index = team === 'work' ? i - 16 : i;
    const role = team && index < 2 ? 'lead' : 'member';
    const key = team ? `${team}-${role}-${String(index + 1).padStart(2, '0')}` : 'outsider';
    const score = [0, 39, 40, 69, 70, 89, 90, 100][i % 8];
    return {
      key, id: uuidFor(`${namespace}:user:${key}`), email: `bp-qa+${namespace}.${key}@example.test`,
      name: `QA ${key.replaceAll('-', ' ')}`, team, role,
      visibility: ['hidden', 'lead', 'everyone'][index % 3],
      status: ['open', 'heads_down', 'running_hot', 'away'][i % 4],
      note: i % 5 === 0 ? 'QA Unicode ✓ — synthetic data only' : `QA fixture ${key}`,
      score, raw: -K * Math.log(1 - Math.min(score, 99.9) / 100), zone: zoneForScore(score),
      hasSnapshot: i % 11 !== 0, ageHours: i % 7 === 0 ? 80 : i % 5 === 0 ? 30 : 1,
    };
  });
  return { marker: QA_MARKER, namespace, teams, users };
}
