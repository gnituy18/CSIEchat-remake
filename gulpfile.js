var gulp = require('gulp')
var browserify = require('gulp-browserify')
var nodemon = require('gulp-nodemon')

gulp.task('build', function () {
  return gulp.src('./client/main.js')
  .pipe(browserify({'debug': !gulp.env.production}))
  .pipe(gulp.dest('./public/js'))
})

gulp.task('watch', ['build'], function () {
  gulp.watch('./client/**/*.js', ['build'])
  nodemon({
    'script': 'server/server.js',
    'ignore': [ 'views/', 'client/', 'public/', 'gulpfile.js' ]
  })
})

gulp.task('default', [ 'build', 'watch' ])
