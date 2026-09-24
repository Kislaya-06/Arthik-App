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
