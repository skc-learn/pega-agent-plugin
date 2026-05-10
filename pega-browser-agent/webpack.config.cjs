const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'source-map',

  entry: {
    sw: './src/service-worker/sw.ts',
    content: './src/content-scripts/index.ts',
    panel: './src/side-panel/panel.ts',
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public/*.html', to: '[name][ext]' },
        { from: 'public/*.js', to: '[name][ext]' },
        { from: 'public/icons', to: 'icons' },
        { from: 'public/manifest.json', to: 'manifest.json' },
      ],
    }),
  ],

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
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@config': path.resolve(__dirname, 'src/config'),
    },
  },

  optimization: {
    minimize: process.env.NODE_ENV === 'production',
  },

  performance: {
    maxAssetSize: 500000,
    maxEntrypointSize: 500000,
  },
};
