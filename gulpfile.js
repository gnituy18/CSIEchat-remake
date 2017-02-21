var gulp = require('gulp')
var browserify = require('browserify')
var babelify = require('babelify')
var source = require('vinyl-source-stream')
var nodemon = require('gulp-nodemon')

gulp.task('build', function () {
  return browserify('./client/app.js')
  .transform(babelify, {'presets': ['es2015']})
  .bundle()
  .pipe(source('app.js'))
  .pipe(gulp.dest('./public/js'))
})

gulp.task('watch', ['build'], function () {
  gulp.watch('./client/**/*.js', ['build'])
  nodemon({
    'script': 'server/server.js',
    'ignore': [ 'views/', 'client/', 'public/', 'gulpfile.js' ],
    'env': {'PORT': '3000'}
  })
})

gulp.task('default', [ 'build', 'watch' ])
