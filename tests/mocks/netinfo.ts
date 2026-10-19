export const NetInfoStateType = {
  unknown: 'unknown',
  none: 'none',
  cellular: 'cellular',
  wifi: 'wifi',
  bluetooth: 'bluetooth',
  ethernet: 'ethernet',
  wimax: 'wimax',
  vpn: 'vpn',
  other: 'other',
} as const;

export const defaultState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
  details: null,
};

const NetInfo = {
  fetch: async () => defaultState,
  addEventListener: () => () => {},
};

export default NetInfo;
