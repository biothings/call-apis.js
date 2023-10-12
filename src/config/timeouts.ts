export const globalTimeout = 50000;

export const apiTimeouts = [
  // {
  //   id: '8956303f273baaa76202ff3195bd6a64',
  //   timeout: 10000
  // }
];

const apiToTimeout = {};
apiTimeouts.forEach(v => (apiToTimeout[v.id] = v.timeout));
export { apiToTimeout as timeoutByAPI };
