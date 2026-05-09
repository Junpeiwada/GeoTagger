const path = require('path');
const fs = require('fs');

// geo-tzのデータファイルをwebpack出力ディレクトリにコピーするプラグイン。
// geo-tzはバンドル後も __dirname/../data/ からデータファイルを読もうとするため。
class CopyGeoTzDataPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync('CopyGeoTzDataPlugin', (compilation, callback) => {
      const outputPath = compiler.options.output.path; // .webpack/main
      const destDir = path.join(outputPath, '..', 'data'); // .webpack/data
      const srcDir = path.join(__dirname, 'node_modules', 'geo-tz', 'data');

      if (!fs.existsSync(srcDir)) {
        callback();
        return;
      }

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      try {
        for (const file of fs.readdirSync(srcDir)) {
          const src = path.join(srcDir, file);
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, path.join(destDir, file));
          }
        }
        callback();
      } catch (err) {
        callback(err);
      }
    });
  }
}

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
  },
  plugins: [new CopyGeoTzDataPlugin()],
};
