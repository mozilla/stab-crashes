var ghpages = require('gh-pages');
var path = require('path');
var fs = require('fs-extra');

fs.removeSync('dist');
fs.mkdirSync('dist');
[
  'index.html', 'dash.js', 'style.css',
  'exclamation_mark.svg', 'question_mark.svg', 'rocket_fly.png',
  'release.json', 'release-startup.json', 'beta.json', 'beta-startup.json', 'aurora.json', 'aurora-startup.json',
].forEach(file => fs.copySync(file, path.join('dist', file)));

ghpages.publish('dist', err => {
  if (err) {
    console.error('Error while publishing to gh-pages');
    console.error(err);
  }
});
