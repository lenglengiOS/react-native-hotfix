module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath:
          'import com.reactnativehotfix.HotfixPackage;',
        packageInstance: 'new HotfixPackage()',
      },
      ios: {},
    },
  },
};
