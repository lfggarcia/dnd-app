// TEST-001: Mock op-sqlite native module — not available in Jest/Node environment
jest.mock('@op-engineering/op-sqlite', () => {
  const mockDb = {
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    executeSync: jest.fn().mockReturnValue({ rows: [] }),
    executeAsync: jest.fn().mockResolvedValue({ rows: [] }),
    close: jest.fn(),
    transaction: jest.fn(async (fn) => fn(mockDb)),
  };
  return {
    open: jest.fn(() => mockDb),
    OPSQLite: { open: jest.fn(() => mockDb) },
  };
});

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/documents',
  exists: jest.fn().mockResolvedValue(false),
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
  copyFile: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn().mockReturnValue({ promise: Promise.resolve({ statusCode: 200 }) }),
}));

jest.mock('@oguzhnatly/react-native-image-manipulator', () => ({
  __esModule: true,
  default: {
    manipulate: jest.fn().mockResolvedValue({ uri: 'mock://image.jpg' }),
  },
}));

jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: {
      View,
      Text: require('react-native').Text,
      createAnimatedComponent: (comp) => comp,
    },
    useSharedValue: (init) => ({ value: init }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v) => v,
    withTiming: (v) => v,
    withSequence: (v) => v,
    withDelay: (_, v) => v,
    Easing: { inOut: () => {}, linear: {} },
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    FadeInDown: { duration: () => ({ delay: () => ({}) }) },
    FadeInUp: { duration: () => ({ delay: () => ({}) }) },
    SlideInLeft: { duration: () => ({ delay: () => ({}) }) },
    SlideInRight: { duration: () => ({ delay: () => ({}) }) },
    cancelAnimation: () => {},
  };
});

jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: View,
    GestureDetector: View,
    Gesture: {
      Pan: () => ({ onUpdate: () => ({ onEnd: () => ({}) }) }),
    },
    Directions: {},
  };
});
