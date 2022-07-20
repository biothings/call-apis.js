exports.globalTimeout = 50000

const apiTimeouts = [
  // {
  //   id: '8956303f273baaa76202ff3195bd6a64',
  //   timeout: 10000
  // }
]

const apiToTimeout = {}
apiTimeouts.forEach(v => apiToTimeout[v.id] = v.timeout)
exports.timeoutByAPI = apiToTimeout