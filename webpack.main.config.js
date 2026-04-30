module.exports = {
  target: 'electron-main',
  entry: './src/main/main.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: {
    'electron': 'commonjs electron',
    'electron-store': 'commonjs electron-store',
    'geo-tz': 'commonjs geo-tz',
  },
};
