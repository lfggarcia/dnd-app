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
