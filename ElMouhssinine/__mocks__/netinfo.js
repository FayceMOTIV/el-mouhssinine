// Mock pour @react-native-community/netinfo
module.exports = {
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
};
